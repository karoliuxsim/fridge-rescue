export function getSupabaseConfig() {
  // Explicit property access is required for Next.js browser environment variables.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error("Trūksta Supabase nustatymų: patikrinkite abu NEXT_PUBLIC_SUPABASE kintamuosius.");
  }
  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error("Supabase klientui reikia Publishable key. Slapti serverio raktai neleidžiami.");
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error();
  } catch {
    throw new Error("Netinkamas Supabase projekto URL: reikalingas HTTPS adresas.");
  }

  return { url, publishableKey };
}
