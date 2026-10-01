import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
mock.module('server-only',{namedExports:{}});
const {getAppUrl,getAuthConfirmUrl}=await import('../src/lib/app-url.ts');
test('development defaults to localhost:3001',()=>{
 process.env.NODE_ENV='development';delete process.env.APP_URL;
 assert.equal(getAppUrl(),'http://localhost:3001');assert.equal(getAuthConfirmUrl(),'http://localhost:3001/auth/confirm');
});
test('production accepts HTTPS origin and forms exact confirmation URL',()=>{
 process.env.NODE_ENV='production';process.env.APP_URL=' https://fridge.example/ ';
 assert.equal(getAppUrl(),'https://fridge.example');assert.equal(getAuthConfirmUrl(),'https://fridge.example/auth/confirm');
});
for(const value of [undefined,'',' ','invalid','http://fridge.example','https://localhost','https://u:secret@fridge.example','https://fridge.example/path','https://fridge.example/?x=secret','https://fridge.example/#secret'])test('production rejects invalid configuration '+String(value),()=>{
 process.env.NODE_ENV='production';if(value===undefined)delete process.env.APP_URL;else process.env.APP_URL=value;
 assert.throws(getAppUrl,e=>!e.message.includes('secret'));
});
test('development accepts explicit local origin but rejects remote HTTP',()=>{
 process.env.NODE_ENV='development';process.env.APP_URL='http://127.0.0.1:3107';assert.equal(getAppUrl(),process.env.APP_URL);
 process.env.APP_URL='http://fridge.example';assert.throws(getAppUrl);
});
