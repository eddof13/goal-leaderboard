import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function signInAsTestUser(page: Page, email: string) {
  await admin.auth.admin.createUser({ email, email_confirm: true });

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;

  const response = await page.request.post("/api/test/login", {
    data: { email, tokenHash: data.properties.hashed_token },
  });
  if (!response.ok()) {
    throw new Error(`test login failed: ${await response.text()}`);
  }
}

export async function deleteTestUser(email: string) {
  const { data } = await admin.auth.admin.listUsers();
  const found = data.users.find((u) => u.email === email);
  if (found) await admin.auth.admin.deleteUser(found.id);
}

// For tests that hit the Supabase REST/Storage APIs directly (no browser
// needed) to check RLS boundaries between two different users.
export async function getSessionForTestUser(
  email: string,
): Promise<{ userId: string; accessToken: string }> {
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (userError) throw userError;

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) throw linkError;

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: verifyData, error: verifyError } = await client.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email",
  });
  if (verifyError) throw verifyError;

  return { userId: userData.user.id, accessToken: verifyData.session!.access_token };
}
