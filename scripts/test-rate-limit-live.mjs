// Explicit opt-in live Redis test. Real POST handler + real limiter + real SDKs.
// Gemini is replaced before importing the handler. No HTTP server/deploy needed.
import { mock } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return next(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return next(specifier, context);
} });
mock.module('server-only', { namedExports: {} });
const prefixes = ['quota','concurrent'].map(name => `fridge-rescue:TEST-ONLY:${randomUUID()}:${name}`);
let redis, stage = 'configuration', mockCalls = 0, activeLimiter;
let generate = async () => 'TEST ONLY';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let originalFetch;

async function matchingKeys(prefix) {
  const found = new Set(); let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, {match: `${prefix}:*`, count: 100});
    for (const key of keys) {
      if (typeof key !== 'string' || !key.startsWith(`${prefix}:`)) throw new Error('UnsafeCleanup');
      found.add(key);
    }
    cursor = String(next);
  } while (cursor !== '0');
  return [...found];
}

try {
  process.loadEnvFile('.env.local');
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  const parsed = new URL(url);
  assert.ok(token && parsed.protocol === 'https:' && !parsed.username && !parsed.password);
  // Never allow this test process to send Gemini, Supabase or other requests.
  delete process.env.GEMINI_API_KEY;
  delete process.env.AI_RECIPE_SIGNING_SECRET;
  originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (target.origin !== parsed.origin) throw new Error('ExternalNetworkBlocked');
    return originalFetch(input, {...init, redirect: 'error'});
  };
  redis = new Redis({url, token, retry: false, signal: () => AbortSignal.timeout(10000)});
  const {createAiLimiter, AiLimiterUnavailable} = await import('../src/lib/ai-rate-limit.ts');
  // Replace only the singleton selected by the real route, not limiter behavior.
  mock.module(new URL('../src/lib/ai-rate-limit.ts', import.meta.url).href, {namedExports:{
    createAiLimiter, AiLimiterUnavailable, aiLimiter: {acquire: key => activeLimiter.acquire(key)},
  }});
  mock.module(new URL('../src/lib/gemini.ts', import.meta.url).href, {namedExports:{
    AiError: class extends Error {},
    generateAiText: async () => {mockCalls++; return generate();},
  }});
  const {POST} = await import('../src/app/api/ai/route.ts');
  const request = () => new Request('http://localhost:3001/api/ai', {
    method:'POST', headers:{'content-type':'application/json',origin:'http://localhost:3001'},
    body:JSON.stringify({prompt:'TEST ONLY: mocked generation'}),
  });
  async function check(response, status, label) {
    console.log(`${label}: HTTP ${response.status}`);
    assert.equal(response.status,status);
    const body = await response.json();
    if(status===429){assert.equal(body.error.code,'AI_RATE_LIMITED');assert.ok(Number(response.headers.get('retry-after'))>0);}
    else assert.deepEqual(body,{text:'TEST ONLY'});
  }

  stage = '5/min';
  activeLimiter = createAiLimiter(prefixes[0]);
  // Keep six requests in the SAME real fixed window; do not fake Date.now.
  const remaining = 60000 - Date.now()%60000;
  if(remaining<20000){console.log('Laukiama naujo minutės lango (iki 20 s).');await sleep(remaining+100);}
  const window = Math.floor(Date.now()/60000);
  for(let i=1;i<=5;i++) await check(await POST(request()),200,`5/min bandymas ${i}`);
  await check(await POST(request()),429,'5/min bandymas 6');
  assert.equal(Math.floor(Date.now()/60000),window);
  assert.equal(mockCalls,5);
  console.log('5/min: PASS; 429 kodas AI_RATE_LIMITED ir Retry-After patikrinti.');

  stage = 'concurrent';
  activeLimiter = createAiLimiter(prefixes[1]);
  let entered, finish;
  const enteredPromise = new Promise(resolve => {entered=resolve;});
  const gate = new Promise(resolve => {finish=resolve;});
  generate = async () => {entered();await gate;return 'TEST ONLY';};
  const first = POST(request());
  let timer;
  try {
    await Promise.race([enteredPromise,first.then(()=>{throw new Error('DidNotAcquire');}),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('TestTimeout')),10000);})]);
    clearTimeout(timer);
    await check(await POST(request()),429,'Aktyvus lock, kita užklausa');
    assert.equal(mockCalls,6);
  } finally {clearTimeout(timer);finish();}
  await check(await first,200,'Pirmos užklausos užbaigimas ir release');
  generate = async () => 'TEST ONLY';
  await check(await POST(request()),200,'Po release kita užklausa');
  assert.equal(mockCalls,7);
  console.log('Concurrent lock ir release: PASS. Tikrų Gemini kvietimų: 0.');
} catch {
  console.log(`Testas nepraėjo; etapas: ${stage}. Klaidos objektas ir slaptos reikšmės nerodomi.`);
  process.exitCode=1;
} finally {
  if(redis) {
    try {
      let removed=0;
      for(const prefix of prefixes) {
        const keys=await matchingKeys(prefix);
        for(const key of keys) {
          const ttl=await redis.pttl(key);
          assert.ok(ttl===-2 || (ttl>0 && ttl<=90000));
          removed+=await redis.del(key);
        }
        assert.equal((await matchingKeys(prefix)).length,0);
      }
      console.log(`Valymas: PASS; pašalinta TEST ONLY raktų: ${removed}; liko: 0. TTL patikrintas.`);
    } catch {
      console.log('Valymas nepatvirtintas. Tik TEST ONLY raktams nustatyti 60/90 s TTL; kiti raktai neliesti.');
      process.exitCode=1;
    }
  }
  if(originalFetch)globalThis.fetch=originalFetch;
}
