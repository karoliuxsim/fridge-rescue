"use server";

import { createClient } from "@/lib/supabase/server";
import { authErrorMessage, validateCredentials } from "@/lib/auth";
import { getAuthConfirmUrl } from "@/lib/app-url";

export async function authenticate(mode: "login" | "register", form: FormData): Promise<{ error?: string; message?: string; signedIn?: boolean }> {
  if (mode !== "login" && mode !== "register") return { error: "Netinkamas veiksmas." };
  const email = typeof form.get("email") === "string" ? String(form.get("email")).trim() : "";
  const password = typeof form.get("password") === "string" ? String(form.get("password")) : "";
  const invalid = validateCredentials(email, password, mode === "register");
  if (invalid) return { error: invalid };
  try {
    const supabase = await createClient();
    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: getAuthConfirmUrl() } });
      if (error) return { error: authErrorMessage(error) };
      if (data.session) return { signedIn: true };
      // Supabase may intentionally return an indistinguishable response for an existing account.
      return { message: "Patikrinkite el. paštą ir patvirtinkite paskyrą laiške esančia nuoroda. Jei paskyra jau patvirtinta, prisijunkite. Laiško ieškokite ir šlamšto aplanke." };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: authErrorMessage(error) } : { signedIn: true };
  } catch {
    return { error: authErrorMessage({}) };
  }
}

export async function signOut(): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    return error ? { error: authErrorMessage(error) } : {};
  } catch {
    return { error: authErrorMessage({}) };
  }
}
