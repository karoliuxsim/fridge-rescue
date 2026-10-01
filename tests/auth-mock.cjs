// Test-server preload only. Never imported by application code.
// All Auth traffic is intercepted: these tests cannot create real Supabase users.
const { createHash } = require('node:crypto');
const originalFetch = globalThis.fetch;
const tokens = new Map();
const refreshTokens = new Map();
const refreshedSessions = new Map();
const challenges = new Set();
const usedHashes = new Set();
let sequence = 0;
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'test@example.com', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z', identities: [] };
const userB = { ...user, id: '22222222-2222-4222-8222-222222222222', email: 'second@example.com' };
const deniedUser = { ...user, id: '33333333-3333-4333-8333-333333333333', email: 'denied@example.com' };
const savedRows = new Map();
const aiRows = new Map();
process.env.APP_URL = 'https://auth.fridge.example';
process.env.UPSTASH_REDIS_REST_URL = 'https://redis-test.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-redis-token';
process.env.AI_RECIPE_SIGNING_SECRET = 'test-only-signing-secret-32-bytes-not-real';
let rowSequence = 0;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' } });
const fail = (code, status = 400) => json({ code, msg: 'Synthetic test failure' }, status);
function session(activeUser = user) {
  sequence++;
  const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: activeUser.id, exp: Math.floor(Date.now() / 1000) + 3600, seq: sequence })}.test-signature`;
  const refresh = `test-refresh-${sequence}`;
  tokens.set(token, activeUser);
  refreshTokens.set(refresh, activeUser);
  return { access_token: token, refresh_token: refresh, token_type: 'bearer', expires_in: 3600, user: activeUser };
}
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  // Real SDK transport, synthetic Redis responses only; never contact Upstash.
  if (url.hostname === 'redis-test.invalid') {
    const command = value => {
      if (!Array.isArray(value)) throw new Error('Unexpected Redis test command');
      const kind=String(value[0]).toLowerCase();
      if(kind==='evalsha') return {error:'NOSCRIPT No matching script'};
      if(kind==='eval') {
        if(String(value[1]).startsWith('-- ')) return {result:1};
        return {result:[1,20]};
      }
      throw new Error('Unexpected Redis test operation');
    };
    const inputBody=JSON.parse(init.body);
    return json(Array.isArray(inputBody[0])?inputBody.map(command):command(inputBody));
  }
  if (url.hostname === 'generativelanguage.googleapis.com') return json({candidates:[{content:{role:'model',parts:[{text:'AI bandomasis receptas\nVištiena be svogūnų. Iškepkite iki saugios temperatūros.'}]}}]});
  if (!url.pathname.startsWith('/auth/v1/') && !url.pathname.startsWith('/rest/v1/')) return originalFetch(input, init);
  const body = init.body ? JSON.parse(init.body) : {};
  const headers = new Headers(init.headers);
  const token = (headers.get('authorization') || '').replace(/^Bearer /, '');
  if (url.pathname.startsWith('/rest/v1/')) {
    // No test Data API request is ever forwarded to the real database.
    const actor = tokens.get(token);
    if (!actor) return json({ code: '42501', message: 'permission denied for table saved_recipes' }, 401);
    if (actor.id === deniedUser.id) return json({ code: '42501', message: 'permission denied for table saved_recipes' }, 403);
    const isAi = url.pathname === '/rest/v1/saved_ai_recipes';
    if (!isAi && url.pathname !== '/rest/v1/saved_recipes') return json({ code: 'PGRST205' }, 404);
    const tableRows = isAi ? aiRows : savedRows;
    const method = init.method || 'GET';
    if (method === 'POST') {
      if (body.user_id !== actor.id) return json({ code: '42501', message: 'RLS rejected insert' }, 403);
      if ([...tableRows.values()].some(row => row.user_id === actor.id && (isAi ? row.generation_id === body.generation_id : row.meal_id === body.meal_id))) return json({ code: '23505' }, 409);
      const id = `aaaaaaaa-aaaa-4aaa-8aaa-${String(++rowSequence).padStart(12, '0')}`;
      tableRows.set(id, { ...body, id, created_at: new Date().toISOString() });
      return json(isAi ? { id } : null, 201);
    }
    if (url.searchParams.get('user_id') !== `eq.${actor.id}`) return json({ code: '42501', message: 'Missing owner filter in test' }, 403);
    let rows = [...tableRows.values()].filter(row => row.user_id === actor.id);
    for (const field of ['id', 'meal_id', 'generation_id']) {
      const filter = url.searchParams.get(field);
      if (filter) rows = rows.filter(row => `eq.${row[field]}` === filter);
    }
    if (method === 'DELETE') rows.forEach(row => tableRows.delete(row.id));
    else if (method !== 'GET') return json({ code: '42501' }, 403);
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const fields = (url.searchParams.get('select') || '*').split(',');
    const selected = rows.map(row => fields[0] === '*' ? row : Object.fromEntries(fields.map(field => [field, row[field]])));
    return json(headers.get('accept')?.includes('application/vnd.pgrst.object+json') ? (selected[0] || null) : selected);
  }
  if (url.pathname.endsWith('/signup')) {
    await new Promise(resolve => setTimeout(resolve, 150));
    if (url.searchParams.get('redirect_to') !== 'https://auth.fridge.example/auth/confirm') return fail('bad_redirect');
    if (body.email === 'exists@example.com') return fail('user_already_exists');
    if (body.email === 'weak@example.com') return fail('weak_password', 422);
    if (body.email === 'limit@example.com') return fail('over_email_send_rate_limit', 429);
    if (!body.code_challenge || body.code_challenge_method !== 's256') return fail('missing_pkce');
    challenges.add(body.code_challenge);
    return json({ ...user, email: body.email, email_confirmed_at: null });
  }
  if (url.pathname.endsWith('/token')) {
    if (url.searchParams.get('grant_type') === 'pkce') {
      const hash = createHash('sha256').update(body.code_verifier || '').digest('base64url');
      if (body.auth_code !== 'valid-code' || !challenges.delete(hash)) return fail('flow_state_not_found');
      return json(session());
    }
    if (url.searchParams.get('grant_type') === 'refresh_token') {
      // Match Supabase's short reuse window for concurrent page/prefetch requests.
      const previous = refreshedSessions.get(body.refresh_token);
      if (previous && Date.now() - previous.created < 10000) return json(previous.value);
      const actor = refreshTokens.get(body.refresh_token);
      if (!actor) return fail('refresh_token_not_found');
      refreshTokens.delete(body.refresh_token);
      const value = session(actor);
      refreshedSessions.set(body.refresh_token, { created: Date.now(), value });
      return json(value);
    }
    await new Promise(resolve => setTimeout(resolve, 150));
    if (body.email === 'unconfirmed@example.com') return fail('email_not_confirmed');
    const actor = [user, userB, deniedUser].find(candidate => candidate.email === body.email);
    if (!actor || body.password !== 'TestPassword123!') return fail('invalid_credentials');
    return json(session(actor));
  }
  if (url.pathname.endsWith('/user')) return tokens.has(token) ? json(tokens.get(token)) : fail('bad_jwt', 401);
  if (url.pathname.endsWith('/logout')) { tokens.delete(token); return new Response(null, { status: 204 }); }
  if (url.pathname.endsWith('/verify')) {
    if (body.type !== 'email' || body.token_hash !== 'valid-hash' || usedHashes.has(body.token_hash)) return fail('otp_expired');
    usedHashes.add(body.token_hash);
    return json(session());
  }
  return fail('unexpected_test_auth_request');
};
