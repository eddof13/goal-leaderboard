import { test, expect } from "@playwright/test";
import { signInAsTestUser, deleteTestUser } from "./helpers/auth";

test.describe("goal posting", () => {
  const email = `e2e-goals-${Date.now()}@example.com`;

  test.afterAll(async () => {
    await deleteTestUser(email);
  });

  test("authenticated user can post a cadence goal and see it on the home page", async ({
    page,
  }) => {
    await signInAsTestUser(page, email);

    await page.goto("/goals/new");
    await page.getByLabel("Title").fill("Gym 3x/week");
    await page.getByLabel("Times per").fill("3");
    await page.getByLabel("Period").selectOption("weekly");
    await page.getByLabel("Deadline", { exact: true }).fill("2026-12-31");
    await page.getByRole("button", { name: "Post goal" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByText("Gym 3x/week")).toBeVisible();
    await expect(page.getByText(/3x Weekly/)).toBeVisible();
  });

  test("authenticated user can post a target goal", async ({ page }) => {
    await signInAsTestUser(page, email);

    await page.goto("/goals/new");
    await page.getByLabel("Title").fill("Read 12 books");
    await page.getByLabel(/Target — single count/).check();
    await page.getByLabel("Target count").fill("12");
    await page.getByLabel("Deadline", { exact: true }).fill("2026-12-31");
    await page.getByRole("button", { name: "Post goal" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByText("Read 12 books")).toBeVisible();
    await expect(page.getByText(/12 total by deadline/)).toBeVisible();
  });

  test("unauthenticated visitor cannot reach the new-goal form's data (RLS)", async ({
    page,
  }) => {
    // The route itself isn't auth-gated (only / and the insert are), so this
    // confirms the DB won't accept a write without a session rather than
    // relying on UI redirects alone.
    const response = await page.request.post(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/goals`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          "Content-Type": "application/json",
        },
        data: {
          user_id: "00000000-0000-0000-0000-000000000000",
          category: "fitness",
          title: "should be rejected",
          goal_type: "target",
          target_count: 1,
          deadline: "2026-12-31",
        },
      },
    );
    expect(response.status()).toBe(401);
  });
});
