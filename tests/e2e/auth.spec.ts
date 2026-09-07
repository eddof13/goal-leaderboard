import { test, expect } from "@playwright/test";
import { signInAsTestUser, deleteTestUser } from "./helpers/auth";

test("unauthenticated visitor is redirected from / to /login", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Goal Leaderboard" })).toBeVisible();
});

test("login page has an email field and submit button", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send magic link" })).toBeVisible();
});

test("submitting the login form calls the OTP endpoint with the typed email and shows confirmation", async ({
  page,
}) => {
  // Mocks the network call rather than hitting live Supabase: this test is
  // about the form's own wiring (does it call the right endpoint with the
  // right payload, does it show the right state), not about Supabase's email
  // delivery. Hitting the real endpoint would send a real email on every
  // test run. Live Supabase connectivity is covered by tests/e2e/db.spec.ts.
  const testEmail = `e2e-test-${Date.now()}@example.com`;
  let requestBody: unknown;

  await page.goto("/login");
  await page.route("**/auth/v1/otp*", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
      return;
    }
    requestBody = request.postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "{}",
    });
  });

  await page.getByPlaceholder("you@example.com").fill(testEmail);
  await page.getByRole("button", { name: "Send magic link" }).click();

  await expect(page.getByText("Check your email for a sign-in link.")).toBeVisible();
  expect(requestBody).toMatchObject({ email: testEmail });
});

test("signing out clears the session and redirects back to /login", async ({
  page,
}) => {
  const email = `e2e-signout-${Date.now()}@example.com`;
  await signInAsTestUser(page, email);

  try {
    await page.goto("/");
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // The session should actually be gone, not just a client-side redirect.
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    await deleteTestUser(email);
  }
});
