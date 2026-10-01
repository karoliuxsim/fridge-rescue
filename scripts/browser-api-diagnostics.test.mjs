import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticFetch, getDiagnostics, getServerDiagnostics, setDiagnosticsEnabled, clearDiagnostics, subscribeDiagnostics } from '../src/lib/browser-api-diagnostics.ts';

beforeEach(()=>setDiagnosticsEnabled(false));
afterEach(()=>mock.restoreAll());

test('disabled by default, no collection, fetch receives original arguments and response stays unread', async()=>{
 assert.equal(getDiagnostics().enabled,false);assert.equal(getServerDiagnostics().enabled,false);
 const response=new Response('private body');const init={method:'POST',body:'private request',headers:{Authorization:'secret'}};
 const spy=mock.method(globalThis,'fetch',async(...args)=>{assert.equal(args[0],'/api/ai');assert.equal(args[1],init);return response;});
 const result=await diagnosticFetch('generate','/api/ai',init);
 assert.equal(result,response);assert.equal(result.bodyUsed,false);assert.equal(spy.mock.callCount(),1);assert.deepEqual(getDiagnostics().entries,[]);
});
for(const status of [200,401,429,502])test(`HTTP ${status} recorded without modifying response`,async()=>{
 setDiagnosticsEnabled(true);const response=new Response('BODY_SECRET',{status});
 const spy=mock.method(globalThis,'fetch',async()=>response);
 assert.equal(await diagnosticFetch('search','/api/recipes?q=QUERY_SECRET'),response);
 const [entry]=getDiagnostics().entries;
 assert.equal(entry.status,status);assert.equal(entry.success,status===200);assert.equal(entry.endpoint,'/api/recipes');assert.equal(entry.method,'GET');
 assert.ok(Number.isInteger(entry.durationMs)&&entry.durationMs>=0);assert.equal(spy.mock.callCount(),1);assert.equal(response.bodyUsed,false);
});
test('network and abort errors keep original rejection identity and never log raw details',async()=>{
 setDiagnosticsEnabled(true);const failure=new TypeError('SECRET URL and token');
 mock.method(globalThis,'fetch',async()=>{throw failure;});
 await assert.rejects(diagnosticFetch('search','/api/recipes'),e=>e===failure);
 assert.equal(getDiagnostics().entries[0].outcome,'network-error');assert.equal(getDiagnostics().entries[0].status,null);
 const controller=new AbortController();controller.abort();
 await assert.rejects(diagnosticFetch('search','/api/recipes',{signal:controller.signal}),e=>e===failure);
 assert.equal(getDiagnostics().entries[0].outcome,'aborted');assert.equal(getDiagnostics().entries[0].success,false);
 assert.ok(!JSON.stringify(getDiagnostics()).includes('SECRET'));
});
test('fixed labels remove IDs, URLs, query, headers, body, and credentials',async()=>{
 setDiagnosticsEnabled(true);mock.method(globalThis,'fetch',async()=>new Response('AI_TEXT_SECRET'));
 const id='aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
 await diagnosticFetch('deleteAi',`/api/ai-recipes/${id}?token=QUERY_SECRET`,{method:'DELETE',headers:{Authorization:'AUTH_SECRET',Cookie:'COOKIE_SECRET'},body:'PROMPT_SECRET SIGNATURE_SECRET'});
 const entry=getDiagnostics().entries[0];assert.equal(entry.endpoint,'/api/ai-recipes/[id]');
 const serialized=JSON.stringify(getDiagnostics());for(const secret of [id,'QUERY_SECRET','AUTH_SECRET','COOKIE_SECRET','PROMPT_SECRET','SIGNATURE_SECRET','AI_TEXT_SECRET'])assert.ok(!serialized.includes(secret));
 assert.deepEqual(Object.keys(entry).sort(),['id','system','endpoint','method','status','success','durationMs','outcome'].sort());
});
test('same fetch arguments, signal, response and call count with diagnostics on or off',async()=>{
 const controller=new AbortController();const init={method:'POST',signal:controller.signal,cache:'no-store',body:'test',headers:{'Content-Type':'application/json'}};
 let count=0;mock.method(globalThis,'fetch',async(input,actual)=>{count++;assert.equal(input,'/api/ai');assert.equal(actual,init);return new Response('ok');});
 for(const enabled of [false,true]){setDiagnosticsEnabled(enabled);const response=await diagnosticFetch('preview','/api/ai',init);assert.equal(await response.text(),'ok');}
 assert.equal(count,2);assert.equal(controller.signal.aborted,false);assert.ok(getDiagnostics().entries[0].system.includes('prompt peržiūra'));
});
test('bounded newest-first history, clear retains enabled flag',async()=>{
 setDiagnosticsEnabled(true);mock.method(globalThis,'fetch',async()=>new Response('ok'));
 for(let i=0;i<35;i++)await diagnosticFetch('listAi','/api/ai-recipes');
 const entries=getDiagnostics().entries;assert.equal(entries.length,30);assert.ok(entries[0].id>entries[29].id);
 clearDiagnostics();assert.equal(getDiagnostics().enabled,true);assert.equal(getDiagnostics().entries.length,0);
});
test('late responses cannot restore entries after disable/re-enable or clear',async()=>{
 let release;mock.method(globalThis,'fetch',()=>new Promise(resolve=>{release=resolve;}));
 setDiagnosticsEnabled(true);let pending=diagnosticFetch('search','/api/recipes');
 setDiagnosticsEnabled(false);setDiagnosticsEnabled(true);release(new Response('ok'));await pending;assert.equal(getDiagnostics().entries.length,0);
 pending=diagnosticFetch('search','/api/recipes');clearDiagnostics();release(new Response('ok'));await pending;assert.equal(getDiagnostics().entries.length,0);
 setDiagnosticsEnabled(false);assert.equal(getDiagnostics().enabled,false);
});
test('diagnostic subscriber failure never breaks fetch',async()=>{
 setDiagnosticsEnabled(true);const unsubscribe=subscribeDiagnostics(()=>{throw new Error('test');});
 mock.method(globalThis,'fetch',async()=>new Response('ok'));
 assert.equal((await diagnosticFetch('search','/api/recipes')).status,200);unsubscribe();
});
