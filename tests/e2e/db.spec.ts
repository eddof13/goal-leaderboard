import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

test("new signup gets a profile row via the handle_new_user trigger", async () => {
  const email = `e2e-trigger-test-${Date.now()}@example.com`;

  const { data, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  expect(createError).toBeNull();
  const userId = data.user!.id;

  try {
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, display_name")
      .eq("id", userId)
      .single();

    expect(profileError).toBeNull();
    expect(profile?.id).toBe(userId);
    expect(profile?.display_name).toBe(email.split("@")[0]);
  } finally {
    await admin.auth.admin.deleteUser(userId);
  }
});

test("goals and proof_entries are readable by the anon key (leaderboard read-all policy)", async () => {
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { error: goalsError } = await anon.from("goals").select("id").limit(1);
  const { error: proofError } = await anon
    .from("proof_entries")
    .select("id")
    .limit(1);

  expect(goalsError).toBeNull();
  expect(proofError).toBeNull();
});

test("goals table rejects mismatched cadence/target fields (cadence_fields_required constraint)", async () => {
  // Uses the service-role client, which bypasses RLS but not CHECK
  // constraints — this proves the constraint itself holds even if some
  // future code path skips the client-side form validation.
  const email = `e2e-constraint-${Date.now()}@example.com`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  expect(userError).toBeNull();
  const userId = userData!.user.id;

  try {
    const { error: missingCadenceFields } = await admin.from("goals").insert({
      user_id: userId,
      category: "fitness",
      title: "cadence goal missing cadence fields",
      goal_type: "cadence",
      deadline: "2026-12-31",
    });
    expect(missingCadenceFields?.code).toBe("23514");

    const { error: targetWithCadenceFields } = await admin.from("goals").insert({
      user_id: userId,
      category: "fitness",
      title: "target goal with cadence fields set",
      goal_type: "target",
      target_count: 5,
      cadence_period: "daily",
      cadence_count: 1,
      deadline: "2026-12-31",
    });
    expect(targetWithCadenceFields?.code).toBe("23514");
  } finally {
    await admin.auth.admin.deleteUser(userId);
  }
});
