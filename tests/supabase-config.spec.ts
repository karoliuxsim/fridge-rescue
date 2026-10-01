import { test, expect } from "@playwright/test";
import { getSupabaseConfig } from "../src/lib/supabase/config";

test("Supabase konfigūracija priima viešą raktą ir neatskleidžia klaidingų reikšmių", () => {
  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const savedKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    // Synthetic values only; never use real credentials in assertion output.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_only";
    expect(getSupabaseConfig().publishableKey.startsWith("sb_publishable_")).toBe(true);

    for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) {
      const previous = process.env[name];
      for (const value of [undefined, "", "   "]) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
        expect(() => getSupabaseConfig()).toThrow(/Trūksta Supabase nustatymų/);
      }
      process.env[name] = previous;
    }

    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_secret_test_only";
    expect(() => getSupabaseConfig()).toThrow(/Slapti serverio raktai neleidžiami/);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_only";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "private-invalid-value";
    let message = "";
    try { getSupabaseConfig(); } catch (error) { message = (error as Error).message; }
    expect(message).toContain("Netinkamas Supabase projekto URL");
    expect(message).not.toContain("private-invalid-value");
    expect(message).not.toContain("sb_publishable_test_only");
  } finally {
    if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = savedKey;
  }
});
