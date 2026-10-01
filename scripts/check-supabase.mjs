import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });

try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey?.startsWith("sb_publishable_")) throw new Error("Invalid configuration");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("Invalid URL");
  console.log("Supabase aplinkos kintamieji: yra, netušti, tinkamo formato.");

  // Auth settings is a read-only endpoint: no users, sessions or tables are created.
  const response = await fetch(new URL("/auth/v1/settings", url), {
    headers: { apikey: publishableKey },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    console.error(`Supabase ryšio patikra nepavyko: HTTP ${response.status}.`);
    process.exitCode = 1;
  } else {
    const settings = await response.json();
    if (!settings || typeof settings !== "object" || typeof settings.external !== "object" || settings.external === null) {
      throw new Error("Unexpected settings response");
    }
    console.log("Supabase ryšys: HTTP 200, gautas tinkamas Auth nustatymų atsakymas.");
    console.log("Atlikta tik GET užklausa. Vartotojai ir lentelės nekurti. Reikšmės nerodomos.");
  }
} catch {
  console.error("Supabase patikra nepavyko. Patikrinkite nustatymus, projekto būseną ir tinklo prieigą. Reikšmės nerodomos.");
  process.exitCode = 1;
}
