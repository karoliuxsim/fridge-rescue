// Unit-test-only shared Redis simulation; no network or real credentials.
import { mock } from 'node:test';
export const state = { leases: new Map(), counts: new Map(), failure: null, configs: [] };
export function resetRedis() { state.leases.clear(); state.counts.clear(); state.failure=null; }
process.env.UPSTASH_REDIS_REST_URL='https://redis-test.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN='FAKE_REDIS_SECRET';
mock.module('@upstash/redis', {namedExports:{Redis:class {
  constructor(config){state.configs.push(config);}
  async eval(script,keys,args){
    const releasing=script.startsWith('-- release');
    if(state.failure==='redis'||(releasing&&state.failure==='release'))throw new Error('FAKE_REDIS_SECRET');
    for(const key of keys){if(!state.leases.has(key))state.leases.set(key,new Map());}
    if(releasing){for(const key of keys)state.leases.get(key).delete(args[0]);return 1;}
    for(const key of keys)for(const [owner,expiry]of state.leases.get(key))if(expiry<=Date.now())state.leases.get(key).delete(owner);
    if(state.leases.get(keys[0]).size>=2||state.leases.get(keys[1]).size>=1)return 0;
    for(const key of keys)state.leases.get(key).set(args[0],Date.now()+90000);
    return 1;
  }
}}});
mock.module('@upstash/ratelimit',{namedExports:{Ratelimit:class{
  constructor(config){this.config=config;state.configs.push(config);}
  static fixedWindow(tokens){return tokens;}
  async limit(id){
    if(state.failure==='quota')throw new Error('FAKE_REDIS_SECRET');
    const reset=(Math.floor(Date.now()/60000)+1)*60000;
    if(state.failure==='timeout')return {success:true,reason:'timeout',reset,pending:Promise.resolve()};
    const key=`${this.config.prefix}:${id}:${reset}`;
    const n=(state.counts.get(key)||0)+1;state.counts.set(key,n);
    return {success:n<=this.config.limiter,reset,pending:Promise.resolve()};
  }
}}});
