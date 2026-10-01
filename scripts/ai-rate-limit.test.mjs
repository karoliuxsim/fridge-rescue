import {test,mock,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {state,resetRedis} from './test-helpers/upstash-mock.mjs';
mock.module('server-only',{namedExports:{}});
const {createAiLimiter}=await import('../src/lib/ai-rate-limit.ts');
let time=0;mock.method(Date,'now',()=>time);
beforeEach(()=>{resetRedis();time=0;process.env.UPSTASH_REDIS_REST_URL='https://redis-test.invalid';process.env.UPSTASH_REDIS_REST_TOKEN='FAKE_REDIS_SECRET';});
test('two instances share caller and global concurrency; release is idempotent',async()=>{
 const a=createAiLimiter(),b=createAiLimiter();const first=await a.acquire('a');
 assert.ok('retryAfter'in await b.acquire('a'));
 const second=await b.acquire('b');assert.ok('retryAfter'in await a.acquire('c'));
 await first.release();await first.release();const third=await b.acquire('c');assert.ok('release'in third);
 await second.release();await third.release();
});
test('5 per caller, 20 global, shared across instances; reset works',async()=>{
 const a=createAiLimiter(),b=createAiLimiter();
 for(let i=0;i<5;i++)await(await a.acquire('a')).release();
 assert.ok('retryAfter'in await b.acquire('a'));
 for(let i=0;i<15;i++)await(await b.acquire('user'+i)).release();
 assert.ok('retryAfter'in await a.acquire('new'));
 time=60001;await(await b.acquire('a')).release();
});
test('expired lease recovers killed worker; old owner cannot release new lease',async()=>{
 const a=createAiLimiter(),b=createAiLimiter(),old=await a.acquire('a');
 time=61000;assert.ok('retryAfter'in await b.acquire('a'));
 time=90001;const current=await b.acquire('a');await old.release();
 assert.ok('retryAfter'in await a.acquire('a'));await current.release();
});
for(const failure of ['redis','quota','timeout'])test('fails closed on '+failure,async()=>{
 const limiter=createAiLimiter();state.failure=failure;
 await assert.rejects(limiter.acquire('a'),e=>!e.message.includes('FAKE_REDIS_SECRET'));
 state.failure=null;await(await limiter.acquire('a')).release();
});
test('release failure retains expiring lease without throwing or exposing secrets',async()=>{
 const limiter=createAiLimiter(),permit=await limiter.acquire('a');state.failure='release';
 await permit.release();state.failure=null;assert.ok('retryAfter'in await limiter.acquire('a'));
 time=90001;await(await limiter.acquire('a')).release();
});
test('missing or invalid configuration fails closed',async()=>{
 for(const url of ['', 'http://redis.invalid','https://user:secret@redis.invalid','https://redis.invalid/?secret=x']){
 process.env.UPSTASH_REDIS_REST_URL=url;await assert.rejects(createAiLimiter().acquire('a'));}
 process.env.UPSTASH_REDIS_REST_URL='https://redis-test.invalid';delete process.env.UPSTASH_REDIS_REST_TOKEN;
 await assert.rejects(createAiLimiter().acquire('a'));
});
test('no analytics, memory cache or automatic Redis retries',async()=>{
 await(await createAiLimiter().acquire('a')).release();
 const configs=state.configs.slice(-3);assert.equal(configs[0].retry,false);
 for(const c of configs.slice(1)){assert.equal(c.analytics,false);assert.equal(c.ephemeralCache,false);assert.equal(c.timeout,1000);}
});

test('TEST ONLY prefix isolates counters and locks; default namespace remains unchanged',async()=>{
 const normal=createAiLimiter(),isolated=createAiLimiter('fridge-rescue:TEST-ONLY:unit');
 const first=await normal.acquire('shared');
 const second=await isolated.acquire('shared');
 assert.ok('release'in second);
 assert.ok([...state.leases.keys()].some(key=>key.startsWith('fridge-rescue:ai:v1:')));
 assert.ok([...state.leases.keys()].some(key=>key.startsWith('fridge-rescue:TEST-ONLY:unit:')));
 await first.release();await second.release();
 for(const prefix of ['', 'fridge-rescue:ai:v1:production','fridge-rescue:TEST-ONLY:*'])assert.throws(()=>createAiLimiter(prefix));
});
