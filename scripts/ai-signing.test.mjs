import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('@/'))return next(new URL(`../src/${specifier.slice(2)}.ts`,import.meta.url).href,context);return next(specifier,context);}});
mock.module('server-only',{namedExports:{}});
const {signAiRecipe,verifyAiReceipt}=await import('../src/lib/ai-recipe-signing.ts');
const key='test-only-signing-secret-32-bytes-not-real';
process.env.AI_RECIPE_SIGNING_SECRET=key;
const input={originalMealId:'52940',originalTitle:'Brown Stew Chicken',situation:'Be svogūnų',options:{minutes:30,people:2,goal:'original'},text:'Visas AI tekstas\nAntra eilutė.'};
function resign(data){const payload=Buffer.from(JSON.stringify(data)).toString('base64url');return {payload,signature:createHmac('sha256',key).update(payload).digest('hex')};}
test('HMAC round trip preserves full text and original metadata',()=>{
 const receipt=signAiRecipe(input);const data=verifyAiReceipt(receipt);
 for(const name of Object.keys(input))assert.deepEqual(data[name],input[name]);
 assert.equal(data.version,1);assert.ok(data.generationId);assert.ok(data.generatedAt);
 assert.ok(!JSON.stringify(receipt).includes(key));
});
for(const field of ['text','options','originalTitle','originalMealId','situation','generationId','generatedAt'])test('tampered '+field+' rejected',()=>{
 const receipt=signAiRecipe(input);const data=JSON.parse(Buffer.from(receipt.payload,'base64url'));
 data[field]='changed';receipt.payload=Buffer.from(JSON.stringify(data)).toString('base64url');
 assert.throws(()=>verifyAiReceipt(receipt),e=>e.code==='INVALID_RECEIPT');
});
test('invalid signature, extra fields and malformed payload rejected',()=>{
 const receipt=signAiRecipe(input);
 for(const value of [null,{}, {...receipt,signature:'0'.repeat(64)},{...receipt,signature:'x'},{...receipt,user_id:'foreign'},{...receipt,payload:'%%%'}])assert.throws(()=>verifyAiReceipt(value));
});
test('expiry, future date and signed invalid fields rejected',()=>{
 const data=verifyAiReceipt(signAiRecipe(input));
 assert.throws(()=>verifyAiReceipt(resign({...data,generatedAt:new Date(Date.now()-8*86400000).toISOString()})),e=>e.code==='RECEIPT_EXPIRED');
 for(const change of [{generatedAt:new Date(Date.now()+86400000).toISOString()},{version:2},{options:{minutes:20,people:2,goal:'original'}},{text:' '},{text:'a'.repeat(100001)},{situation:'a'.repeat(2001)},{user_id:'foreign'}])assert.throws(()=>verifyAiReceipt(resign({...data,...change})));
});
test('key rotation invalidates old receipts and missing key fails closed',()=>{
 const receipt=signAiRecipe(input);
 process.env.AI_RECIPE_SIGNING_SECRET='another-test-only-signing-secret-32-bytes';assert.throws(()=>verifyAiReceipt(receipt));
 delete process.env.AI_RECIPE_SIGNING_SECRET;assert.throws(()=>verifyAiReceipt(receipt),e=>e.code==='SIGNING_UNAVAILABLE');
 assert.throws(()=>signAiRecipe(input));process.env.AI_RECIPE_SIGNING_SECRET=key;
});
