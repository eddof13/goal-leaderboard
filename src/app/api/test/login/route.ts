import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Test-only: lets Playwright establish a real session without clicking an
// email link. `next build`/`next start` always set NODE_ENV=production
// (including on every Vercel deployment, preview or production), so this
// route only ever exists under local `next dev` — never on a live deploy.
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }

  const { tokenHash } = await request.json();
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
