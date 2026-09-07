import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { deleteTestUser, getSessionForTestUser } from "./helpers/auth";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// These check that being *signed in* isn't enough — RLS must also stop one
// user from writing into another user's data. Regression coverage for a
// real bug: the original proof_entries insert policy checked only that the
// submitter owned the proof row, never that they owned the goal it pointed at.
test.describe("cross-user RLS boundaries", () => {
  const ownerEmail = `e2e-rls-owner-${Date.now()}@example.com`;
  const attackerEmail = `e2e-rls-attacker-${Date.now()}@example.com`;
  let ownerId: string;
  let goalId: string;
  let attackerId: string;
  let attackerToken: string;

  test.beforeAll(async () => {
    const { data: ownerUser, error: ownerError } = await admin.auth.admin.createUser({
      email: ownerEmail,
      email_confirm: true,
    });
    if (ownerError) throw ownerError;
    ownerId = ownerUser.user.id;

    const { data: goal, error: goalError } = await admin
      .from("goals")
      .insert({
        user_id: ownerId,
        category: "fitness",
        title: "Owner's goal",
        goal_type: "target",
        target_count: 5,
        deadline: "2026-12-31",
      })
      .select()
      .single();
    if (goalError) throw goalError;
    goalId = goal.id;

    const attacker = await getSessionForTestUser(attackerEmail);
    attackerId = attacker.userId;
    attackerToken = attacker.accessToken;
  });

  test.afterAll(async () => {
    await deleteTestUser(ownerEmail);
    await deleteTestUser(attackerEmail);
  });

  function authedHeaders() {
    return {
      apikey: anonKey,
      Authorization: `Bearer ${attackerToken}`,
      "Content-Type": "application/json",
    };
  }

  test("cannot submit proof against another user's goal", async ({ request }) => {
    const response = await request.post(`${supabaseUrl}/rest/v1/proof_entries`, {
      headers: authedHeaders(),
      data: {
        goal_id: goalId,
        user_id: attackerId,
        occurred_at: "2026-07-15",
        photo_url: "https://example.com/fake.png",
      },
    });
    expect(response.status()).toBe(403);

    const { data: entries } = await admin
      .from("proof_entries")
      .select("id")
      .eq("goal_id", goalId);
    expect(entries).toHaveLength(0);
  });

  test("cannot update another user's goal", async ({ request }) => {
    const response = await request.patch(
      `${supabaseUrl}/rest/v1/goals?id=eq.${goalId}`,
      {
        headers: { ...authedHeaders(), Prefer: "return=representation" },
        data: { title: "hacked" },
      },
    );
    // RLS's USING clause filters the row out rather than erroring: 200 with
    // zero rows affected, not a 4xx.
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual([]);

    const { data: unchanged } = await admin
      .from("goals")
      .select("title")
      .eq("id", goalId)
      .single();
    expect(unchanged?.title).toBe("Owner's goal");
  });

  test("cannot delete another user's goal", async ({ request }) => {
    const response = await request.delete(
      `${supabaseUrl}/rest/v1/goals?id=eq.${goalId}`,
      { headers: { ...authedHeaders(), Prefer: "return=representation" } },
    );
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual([]);

    const { data: stillExists } = await admin
      .from("goals")
      .select("id")
      .eq("id", goalId)
      .single();
    expect(stillExists?.id).toBe(goalId);
  });

  test("cannot upload a photo into another user's storage folder", async ({
    request,
  }) => {
    const response = await request.post(
      `${supabaseUrl}/storage/v1/object/proof-photos/${ownerId}/${goalId}/hacked.png`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${attackerToken}`,
          "Content-Type": "image/png",
        },
        data: Buffer.from("fake-image-bytes"),
      },
    );
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain("row-level security");
  });
});
