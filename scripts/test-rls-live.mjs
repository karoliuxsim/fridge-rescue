import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createInterface } from "node:readline/promises";
import { checkAnonymous, runRlsChecks } from "./rls/checks.mjs";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const print = result => console.log(`${result.test ? `${result.test}. ` : ""}${result.name ?? "Anoniminė SELECT prieiga"}: ${result.status}. ${result.detail}`);
let browser;
let terminal;
const clients = [];
try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key?.startsWith("sb_publishable_") || new URL(url).protocol !== "https:") throw new Error();
  const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  if (process.argv.includes("--anon-only")) {
    console.log("TIKRA SUPABASE PATIKRA: tik anoniminė GET užklausa; jokių duomenų pakeitimų.");
    const result = await checkAnonymous(anon);
    print(result);
    if (result.status !== "PASS") process.exitCode = 1;
  } else {
    if (!process.stdin.isTTY) throw new Error();
    terminal = createInterface({ input: process.stdin, output: process.stdout });
    console.log("TIKRA SUPABASE PATIKRA. Esami receptai nebus liečiami.");
    console.log("Bus sukurti ir pašalinti tik šio paleidimo bandomieji įrašai.");
    console.log("Prisijunkite dviejuose naujuose Chromium languose, NE terminale. Nesiųskite slaptažodžių ar žetonų pokalbyje.");
    const { chromium } = await import("@playwright/test");
    browser = await chromium.launch({ headless: false });
    const identities = [];
    for (const label of ["A", "B"]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto("http://localhost:3001/login");
      await page.bringToFront();
      await terminal.question(`Prisijunkite vartotoju ${label} naujame naršyklės lange, tada čia spauskite Enter (nieko neįveskite): `);
      // Cookies stay in memory; no storageState, trace, screenshots or credential logging.
      const jar = new Map((await context.cookies("http://localhost:3001")).map(cookie => [cookie.name, cookie.value]));
      const client = createServerClient(url, key, {
        cookies: {
          getAll: () => [...jar].map(([name, value]) => ({ name, value })),
          setAll: values => values.forEach(({ name, value }) => value ? jar.set(name, value) : jar.delete(name)),
        },
      });
      clients.push(client);
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) throw new Error();
      identities.push(data.user.id);
      console.log(`Vartotojo ${label} sesija patikrinta (duomenys nerodomi).`);
    }
    if (identities[0] === identities[1]) { console.log("A ir B turi būti skirtingos paskyros. Duomenų testai nepradėti."); process.exitCode = 1; }
    else {
      const consent = await terminal.question("Pradėti tik bandomųjų įrašų testus ir jų valymą? Įrašykite TAIP: ");
      if (consent === "TAIP") {
        const { results, cleanup } = await runRlsChecks({ a: clients[0], b: clients[1], anon, aId: identities[0], bId: identities[1], report: print });
        if (cleanup !== "PASS" || results.some(result => result.status !== "PASS")) process.exitCode = 1;
      } else { console.log("Testai atšaukti; bandomieji įrašai nekurti."); }
    }
  }
} catch {
  console.error("Patikra neužbaigta. Patikrinkite serverį localhost:3001, tinklą ir prisijungimą atskiruose languose. Slapti duomenys nerodomi.");
  process.exitCode = 1;
} finally {
  for (const client of clients) {
    try { await client.auth.signOut({ scope: "local" }); } catch { /* No credential output. */ }
  }
  terminal?.close();
  await browser?.close();
}
