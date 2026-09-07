import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInAsTestUser, deleteTestUser } from "./helpers/auth";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

test.describe("leaderboard", () => {
  const email = `e2e-leaderboard-${Date.now()}@example.com`;
  const goalTitle = `E2E Leaderboard Goal ${Date.now()}`;

  test.afterAll(async () => {
    await deleteTestUser(email);
  });

  test("a goal with proof entries appears on the leaderboard with a computed rank and completion rate", async ({
    page,
  }) => {
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (userError) throw userError;

    const { data: goal, error: goalError } = await admin
      .from("goals")
      .insert({
        user_id: userData.user.id,
        category: "reading",
        title: goalTitle,
        goal_type: "target",
        target_count: 2,
        deadline: "2026-12-31",
      })
      .select()
      .single();
    if (goalError) throw goalError;

    const { error: proofError } = await admin.from("proof_entries").insert({
      goal_id: goal.id,
      user_id: userData.user.id,
      occurred_at: "2026-07-14",
      photo_url: "https://example.com/book.png",
    });
    if (proofError) throw proofError;

    await signInAsTestUser(page, email);
    await page.goto("/leaderboard");

    await expect(page.getByText(goalTitle)).toBeVisible();
    // 1 of 2 target proofs logged => 50%.
    const row = page.locator("li", { hasText: goalTitle });
    await expect(row.getByText("50%")).toBeVisible();
    await expect(row.getByText(/1 proof/)).toBeVisible();
  });
});
