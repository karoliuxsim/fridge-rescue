// All Gemini calls are mocked. This test never loads .env.local or uses the network.
import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetRedis, state as redisState } from './test-helpers/upstash-mock.mjs';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return next(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return next(specifier, context);
} });
mock.module('server-only', { namedExports: {} });
let options, calls = [], implementation = async () => ({ text: 'Pica skani.' });
class FakeApiError extends Error { constructor(status) { super('FAKE_SECRET_IN_ERROR'); this.status = status; } }
mock.module('@google/genai', { namedExports: {
  ApiError: FakeApiError,
  GoogleGenAI: class { constructor(config) {
    options = config;
    this.models = { generateContent(input) { calls.push(input); return implementation(input); } };
  } },
} });
let clock = 0;
mock.method(Date, 'now', () => clock);
const originalRecipe = { id:'52940',title:'Brown Stew Chicken',ingredients:[{name:'Chicken',measure:'1 kg'},{name:'Onion',measure:'2'}],instructions:'Cook chicken thoroughly.' };
let recipeCalls=[], lookup = async () => structuredClone(originalRecipe);
mock.module(new URL('../src/lib/themealdb.ts', import.meta.url).href, {namedExports:{getRecipeById:async id=>{recipeCalls.push(id);return lookup(id);}}});
const route = await import('../src/app/api/ai/route.ts');
const { POST } = route;
const { safeAiDiagnostic } = await import('../src/lib/gemini.ts');
beforeEach(() => {
  resetRedis(); clock += 61_000; calls = []; process.env.GEMINI_API_KEY = 'FAKE_TEST_KEY';
  implementation = async () => ({ text: 'Pica skani.' });
  recipeCalls=[]; lookup=async()=>structuredClone(originalRecipe);
});
const request = (body = JSON.stringify({ prompt: '  Apie picą.  ' }), headers = {}) => new Request('http://localhost:3001/api/ai', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body,
});
test('valid input: fixed model, one SDK call, safe response, no retries', async () => {
  const res = await POST(request());
  assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await res.json(), { text: 'Pica skani.' });
  assert.equal(calls.length, 1); assert.equal(calls[0].contents, 'Apie picą.');
  assert.equal(calls[0].model, 'gemini-3.8-flash'); assert.equal(calls[0].config.maxOutputTokens, 1024);
  assert.equal(options.httpOptions.retryOptions.attempts, 1); assert.equal(options.httpOptions.timeout, 30000);
  assert.equal((await POST(request())).status, 200);
});
test('all other supported HTTP methods return 405 without SDK calls', async () => {
  for (const method of ['GET','HEAD','PUT','PATCH','DELETE','OPTIONS']) {
    const response = route[method]();
    assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'POST');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls.length, 0);
});
for (const body of ['{', 'null', '[]', '{}', '{"prompt":4}', '{"prompt":" "}', JSON.stringify({prompt:'a'.repeat(2001)}), '{"prompt":"ok","model":"other"}']) {
  test(`invalid input rejected: ${body.slice(0,35)}`, async () => {
    assert.equal((await POST(request(body))).status, 400); assert.equal(calls.length, 0);
  });
}
test('body limit: declared and actual bytes, including multibyte data', async () => {
  assert.equal((await POST(request('{}', {'content-length':'20000'}))).status, 413);
  assert.equal((await POST(request(JSON.stringify({prompt:'ą'.repeat(9000)})))).status, 413);
  assert.equal(calls.length, 0);
});
test('media type and foreign origin rejected; same origin accepted', async () => {
  assert.equal((await POST(request('{}', {'content-type':'text/plain'}))).status, 415);
  assert.equal((await POST(request(undefined, {origin:'https://other.invalid'}))).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await POST(request(undefined, {origin:'http://localhost:3001'}))).status, 200);
});
test('missing key fails safely', async () => {
  delete process.env.GEMINI_API_KEY;
  assert.equal((await POST(request())).status, 503); assert.equal(calls.length, 0);
});
for (const [upstream, status, code] of [[401,502,'AI_AUTH_ERROR'],[403,502,'AI_AUTH_ERROR'],[404,502,'AI_MODEL_UNAVAILABLE'],[429,429,'AI_QUOTA_EXCEEDED'],[500,502,'AI_UNAVAILABLE']]) {
  test(`SDK ${upstream}: safe mapping, allowlisted diagnostic, permit released`, async () => {
    const logs = []; const spy = mock.method(console, 'error', (...args) => logs.push(args));
    implementation = async () => { throw new FakeApiError(upstream); };
    const res = await POST(request()); const body = await res.text();
    assert.equal(res.status, status); assert.equal(JSON.parse(body).error.code, code);
    assert.ok(!body.includes('FAKE_SECRET'));
    assert.deepEqual(logs, [['Gemini failure', {type:'ApiError',code:'UNKNOWN',status:upstream}]]);
    spy.mock.restore();
    implementation = async () => ({text:'Recovered'});
    assert.equal((await POST(request())).status, 200);
  });
}
test('network, empty response and key redaction', async () => {
  implementation = async () => { throw new Error('FAKE_SECRET_IN_ERROR'); };
  assert.equal((await POST(request())).status, 502);
  implementation = async () => ({text:'  '}); assert.equal((await POST(request())).status, 502);
  implementation = async () => ({text:'FAKE_TEST_KEY'});
  assert.deepEqual(await (await POST(request())).json(), {text:'[PASLĖPTA]'});
});
test('diagnostics discard secret names, messages, codes, causes and arbitrary statuses', () => {
  const error = new Error('FAKE_SECRET'); error.name='FAKE_SECRET'; error.code='FAKE_SECRET';
  error.cause={code:'FAKE_SECRET',headers:{authorization:'FAKE_SECRET'}};
  assert.deepEqual(safeAiDiagnostic(error),{type:'Error',code:'UNKNOWN',status:null});
  error.cause.code='ENOTFOUND';
  assert.equal(safeAiDiagnostic(error).code,'ENOTFOUND');
  const api = new FakeApiError(503);
  api.message=JSON.stringify({error:{status:'UNAVAILABLE',message:'FAKE_SECRET'}});
  assert.deepEqual(safeAiDiagnostic(api),{type:'ApiError',code:'UNAVAILABLE',status:503});
  const quota = new FakeApiError(429);
  quota.message=JSON.stringify({error:{status:'RESOURCE_EXHAUSTED',message:'FAKE_SECRET'}});
  assert.deepEqual(safeAiDiagnostic(quota),{type:'ApiError',code:'RESOURCE_EXHAUSTED',status:429});
  api.status='FAKE_SECRET'; assert.equal(safeAiDiagnostic(api).status,null);
});
test('deadline aborts SDK and releases permit', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  implementation = () => new Promise(() => {});
  const pending = POST(request());
  for (let i = 0; i < 100 && !calls.length; i++) await Promise.resolve();
  assert.equal(calls.length, 1);
  t.mock.timers.tick(30001);
  assert.equal((await pending).status, 504); assert.equal(calls[0].config.abortSignal.aborted, true);
  implementation = async () => ({text:'Recovered'}); assert.equal((await POST(request())).status, 200);
});
test('concurrent requests and forged IP headers cannot bypass local bucket', async () => {
  let finish;
  implementation = () => new Promise(resolve => { finish = resolve; });
  const pending = POST(request());
  for (let i = 0; i < 100 && !finish; i++) await Promise.resolve();
  const blocked = await POST(request(undefined, {'x-forwarded-for':'203.0.113.1'}));
  assert.equal(blocked.status, 429); assert.ok(blocked.headers.get('retry-after'));
  finish({text:'OK'}); await pending;
});
test('five requests per minute and window reset', async () => {
  for (let i=0;i<5;i++) assert.equal((await POST(request())).status,200);
  assert.equal((await POST(request())).status,429);
  clock += 60001; assert.equal((await POST(request())).status,200);
});
test('recipe adaptation: anonymous request, server-owned recipe, full ingredients and instructions', async () => {
  const res=await POST(request(JSON.stringify({recipeId:'52940',situation:'  Neturiu svogūnų.  '})));
  assert.equal(res.status,200);assert.deepEqual(recipeCalls,['52940']);assert.equal(calls.length,1);
  const payload=JSON.parse(calls[0].contents.split('RECEPTO IR SITUACIJOS DUOMENYS:\n\n')[1]);
  assert.deepEqual(payload,{originalRecipe:{title:originalRecipe.title,ingredients:originalRecipe.ingredients,instructions:originalRecipe.instructions},situation:'Neturiu svogūnų.',minutes:30,people:2,goal:'kuo panašiau į originalą'});
  assert.equal(calls[0].model,'gemini-3.8-flash');
});
for(const input of [
  {recipeId:'../52940',situation:'Test'}, {recipeId:52940,situation:'Test'},
  {recipeId:'52940',situation:''}, {recipeId:'52940',situation:'a'.repeat(2001)},
  {recipeId:'52940',situation:'Test',model:'other'}, {recipeId:'52940',situation:'Test',title:'Forged'},
  {recipeId:'52940',situation:'Test',prompt:'bypass'}, {recipeId:'52940'},
]) test('invalid adaptation input cannot trigger lookup or Gemini: '+Object.keys(input).join(','),async()=>{
  assert.equal((await POST(request(JSON.stringify(input)))).status,400);
  assert.equal(recipeCalls.length,0);assert.equal(calls.length,0);
});
for(const [kind,status,code] of [['missing',404,'RECIPE_NOT_FOUND'],['failure',502,'RECIPE_UNAVAILABLE'],['oversized',502,'RECIPE_TOO_LARGE']]) {
  test('recipe lookup '+kind+' fails safely without Gemini',async()=>{
    lookup=async()=>{if(kind==='missing')return null;if(kind==='failure')throw new Error('PRIVATE');return {...originalRecipe,instructions:'a'.repeat(24001)};};
    const res=await POST(request(JSON.stringify({recipeId:'52940',situation:'Test'})));
    assert.equal(res.status,status);assert.equal((await res.json()).error.code,code);assert.equal(calls.length,0);
    lookup=async()=>originalRecipe;
    assert.equal((await POST(request(JSON.stringify({recipeId:'52940',situation:'Test'})))).status,200);
  });
}

test('preview never calls Gemini, uses exact generation prompt and returns no key', async()=>{
  const input={recipeId:'52940',situation:'Neturiu svogūnų.',options:{minutes:15,people:4,goal:'cheaper'}};
  const res=await POST(request(JSON.stringify({...input,preview:true})));
  assert.equal(res.status,200);const preview=await res.json();assert.equal(calls.length,0);
  assert.ok(!JSON.stringify(preview).includes('FAKE_TEST_KEY'));
  const data=JSON.parse(preview.prompt.split('RECEPTO IR SITUACIJOS DUOMENYS:\n\n')[1]);
  assert.equal(data.minutes,15);assert.equal(data.people,4);assert.equal(data.goal,'pigiau');
  assert.equal((await POST(request(JSON.stringify({...input,previewHash:preview.previewHash})))).status,200);
  assert.equal(calls[0].contents,preview.prompt);
});
test('changed source cannot generate a different prompt than previewed',async()=>{
  const input={recipeId:'52940',situation:'Test'};
  const preview=await (await POST(request(JSON.stringify({...input,preview:true})))).json();
  lookup=async()=>({...originalRecipe,instructions:'Changed'});
  const res=await POST(request(JSON.stringify({...input,previewHash:preview.previewHash})));
  assert.equal(res.status,409);assert.equal((await res.json()).error.code,'PROMPT_CHANGED');assert.equal(calls.length,0);
});
test('preview works without Gemini key',async()=>{
  delete process.env.GEMINI_API_KEY;
  assert.equal((await POST(request(JSON.stringify({recipeId:'52940',situation:'Test',preview:true})))).status,200);
  assert.equal(calls.length,0);
});
for(const options of [null,{},[],{minutes:20,people:2,goal:'original'},{minutes:'15',people:2,goal:'original'},{minutes:15,people:3,goal:'original'},{minutes:15,people:2,goal:'fake'},{minutes:15,people:2,goal:'toString'},{minutes:15,people:2,goal:'original',model:'other'}]) {
  test('reject invalid options '+JSON.stringify(options),async()=>{
    assert.equal((await POST(request(JSON.stringify({recipeId:'52940',situation:'Test',options,preview:true})))).status,400);
    assert.equal(calls.length,0);assert.equal(recipeCalls.length,0);
  });
}
test('all allowed option values appear in preview',async()=>{
  for(const minutes of [15,30,60])for(const people of [1,2,4])for(const goal of ['simpler','cheaper','healthier','original']){
    clock+=61000;
    const res=await POST(request(JSON.stringify({recipeId:'52940',situation:'Test',options:{minutes,people,goal},preview:true})));
    assert.equal(res.status,200);
  }
  assert.equal(calls.length,0);
});

for (const failure of ['redis','quota','timeout']) test('Redis '+failure+' fails closed before recipe/Gemini with safe 503',async()=>{
  redisState.failure=failure;
  const response=await POST(request(JSON.stringify({recipeId:'52940',situation:'Test'})));
  assert.equal(response.status,503);const body=await response.text();
  assert.equal(JSON.parse(body).error.code,'AI_LIMITER_UNAVAILABLE');
  assert.ok(!body.includes('FAKE_REDIS_SECRET'));assert.equal(calls.length,0);assert.equal(recipeCalls.length,0);
});
