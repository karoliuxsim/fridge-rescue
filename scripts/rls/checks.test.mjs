import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { checkAnonymous, runRlsChecks } from "./checks.mjs";

const aId = "11111111-1111-4111-8111-111111111111";
const bId = "22222222-2222-4222-8222-222222222222";

function environment(options = {}) {
  const original = { id: "99999999-9999-4999-8999-999999999999", user_id: aId, meal_id: "52940", title: "Existing recipe - never touch", image_url: "https://example.invalid/original.png" };
  const rows = new Map([[original.id, { ...original }]]);
  const requests = [];
  const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
  const client = role => createClient("https://example.supabase.co", "sb_publishable_synthetic_test", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-test-role": role }, fetch: async (input, init) => {
      const url = new URL(input);
      const method = init.method || "GET";
      const owner = role === "a" ? aId : bId;
      requests.push({ role, method, params: url.searchParams });
      if (role === "anon") return options.anonAllowed ? response([]) : response({ code: "42501" }, 401);
      if (options.unavailable) return response({ code: "PGRST205" }, 404);
      if (options.noBDelete && role === "b" && method === "DELETE") return response({ code: "42501" }, 403);
      if (method === "POST") {
        const row = JSON.parse(init.body);
        if (row.user_id !== owner && !options.insertLeak) return response({ code: "42501" }, 403);
        rows.set(row.id, row);
        return response(null, 201);
      }
      const leak = role === "b" && (method === "GET" ? options.readLeak : options.deleteLeak);
      let selected = [...rows.values()].filter(row => leak || row.user_id === owner);
      for (const [key, value] of url.searchParams) {
        if (value.startsWith("eq.")) selected = selected.filter(row => String(row[key]) === value.slice(3));
      }
      if (method === "DELETE") selected.forEach(row => rows.delete(row.id));
      return response(selected);
    } },
  });
  return { a: client("a"), b: client("b"), anon: client("anon"), rows, original, requests };
}

test("IMITUOTA: visi penki scenarijai ir valymas, esamas receptas nepaliestas", async () => {
  const env = environment();
  const result = await runRlsChecks({ ...env, aId, bId });
  assert.deepEqual(result.results.map(r => r.status), Array(5).fill("PASS"));
  assert.equal(result.cleanup, "PASS");
  assert.equal(env.rows.size, 1);
  assert.deepEqual(env.rows.get(env.original.id), env.original);
  assert.ok(env.requests.some(r => r.role === "b" && r.method === "DELETE" && !r.params.has("user_id")));
  assert.ok(env.requests.every(r => r.method !== "DELETE" || r.params.get("id") !== `eq.${env.original.id}`));
});

for (const [option, failedTests] of [["readLeak", [0]], ["deleteLeak", [1, 4]], ["insertLeak", [2]], ["anonAllowed", [3]]]) {
  test(`IMITUOTA: aptinka nesaugią ${option} konfigūraciją`, async () => {
    const env = environment({ [option]: true });
    const result = await runRlsChecks({ ...env, aId, bId });
    for (const index of failedTests) assert.equal(result.results[index].status, "FAIL");
    assert.equal(result.cleanup, "PASS");
    assert.equal(env.rows.size, 1);
    assert.deepEqual(env.rows.get(env.original.id), env.original);
  });
}

test("IMITUOTA: trūkstamos B DELETE teisės nėra klaidingas RLS PASS", async () => {
  const env = environment({ noBDelete: true });
  const result = await runRlsChecks({ ...env, aId, bId });
  assert.ok(result.results.every(r => r.status === "INCONCLUSIVE"));
  assert.equal(result.cleanup, "INCONCLUSIVE");
  assert.deepEqual(env.rows.get(env.original.id), env.original);
});

test("IMITUOTA: neprieinama lentelė nėra RLS sėkmė", async () => {
  const env = environment({ unavailable: true });
  const result = await runRlsChecks({ ...env, aId, bId });
  assert.ok(result.results.every(r => r.status === "INCONCLUSIVE"));
});

test("IMITUOTA: vienodos paskyros atmetamos prieš bet kokią užklausą", async () => {
  const env = environment();
  await assert.rejects(runRlsChecks({ ...env, aId, bId: aId }));
  assert.equal(env.requests.length, 0);
});

test("IMITUOTA: anoniminė patikra vykdo tik SELECT su limit=0", async () => {
  const env = environment();
  assert.equal((await checkAnonymous(env.anon)).status, "PASS");
  assert.equal(env.requests.length, 1);
  assert.equal(env.requests[0].method, "GET");
  assert.equal(env.requests[0].params.get("limit"), "0");
});
