import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";

export async function GET(request: NextRequest) {
  let appUrl: string;
  try { appUrl = getAppUrl(); }
  catch {
    return NextResponse.json({ error: "Autentifikacijos grįžimo adresas nesukonfigūruotas." },
      { status: 503, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  }
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  let success = false;
  try {
    const supabase = await createClient();
    if (!params.has("error") && code && code.length <= 4096) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      success = !error;
    } else if (!params.has("error") && tokenHash && tokenHash.length <= 4096 && params.get("type") === "email") {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
      success = !error;
    }
  } catch { /* Never expose tokens or raw provider errors. */ }
  // Fixed destinations prevent open redirects and discard verification tokens from the URL.
  const response = NextResponse.redirect(new URL(success ? "/" : "/login?confirmation=error", appUrl));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
