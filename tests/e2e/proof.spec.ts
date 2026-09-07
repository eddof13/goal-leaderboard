import path from "path";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInAsTestUser, deleteTestUser } from "./helpers/auth";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

test.describe("proof submission", () => {
  const email = `e2e-proof-${Date.now()}@example.com`;
  let goalId: string;

  test.beforeAll(async () => {
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (userError) throw userError;

    // Created directly via the service-role client (bypassing RLS/the UI) so
    // this suite tests proof submission in isolation from goal-posting.
    const { data: goal, error: goalError } = await admin
      .from("goals")
      .insert({
        user_id: userData.user.id,
        category: "fitness",
        title: "Gym 3x/week",
        goal_type: "cadence",
        cadence_period: "weekly",
        cadence_count: 3,
        deadline: "2026-12-31",
      })
      .select()
      .single();
    if (goalError) throw goalError;
    goalId = goal.id;
  });

  test.afterAll(async () => {
    await deleteTestUser(email);
  });

  test("authenticated user can submit proof with a photo and see it counted on the home page", async ({
    page,
  }) => {
    await signInAsTestUser(page, email);

    await page.goto(`/goals/${goalId}/proof`);
    await expect(page.getByText("for Gym 3x/week")).toBeVisible();

    await page
      .locator('input[type="file"]')
      .setInputFiles(path.join(__dirname, "fixtures", "test-photo.png"));
    await page.getByLabel("Note (optional)").fill("Leg day");
    await page.getByRole("button", { name: "Submit proof" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByText("1 proof entry")).toBeVisible();
  });

  test("unauthenticated proof insert is rejected by RLS", async ({ page }) => {
    const response = await page.request.post(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/proof_entries`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          "Content-Type": "application/json",
        },
        data: {
          goal_id: goalId,
          user_id: "00000000-0000-0000-0000-000000000000",
          occurred_at: "2026-07-14",
          photo_url: "https://example.com/fake.png",
        },
      },
    );
    expect(response.status()).toBe(401);
  });

  test("visiting the proof form for a nonexistent goal shows an error instead of crashing", async ({
    page,
  }) => {
    await signInAsTestUser(page, email);
    await page.goto("/goals/00000000-0000-0000-0000-000000000000/proof");
    await expect(page.getByText("Goal not found.")).toBeVisible();
  });
});
