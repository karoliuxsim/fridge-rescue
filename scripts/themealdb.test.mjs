import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return next(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return next(specifier, context);
} });
mock.module('server-only', { namedExports: {} });
const { getRecipeById, searchByIngredient, searchByName } = await import('../src/lib/themealdb.ts');

afterEach(() => mock.restoreAll());

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('TheMealDB lookup naudoja tikėtą endpointą ir priima galiojantį receptą', async () => {
  let requested;
  mock.method(globalThis, 'fetch', async (input) => {
    requested = new URL(input);
    return response({ meals: [{
      idMeal: '52940', strMeal: 'Brown Stew Chicken', strMealThumb: 'https://example.test/meal.jpg',
      strCategory: 'Chicken', strArea: 'Jamaican', strInstructions: 'Cook it.', strIngredient1: 'Chicken', strMeasure1: '1 kg',
    }] });
  });
  const recipe = await getRecipeById('52940');
  assert.equal(requested.href, 'https://www.themealdb.com/api/json/v1/1/lookup.php?i=52940');
  assert.equal(recipe.title, 'Brown Stew Chicken');
});

test('neteisingas TheMealDB endpointas arba HTTP klaida sustabdoma saugiai', async () => {
  mock.method(globalThis, 'fetch', async (input) => {
    assert.match(new URL(input).pathname, /lookup\.php$/);
    return new Response('not found', { status: 404 });
  });
  await assert.rejects(() => getRecipeById('52940'), /TheMealDB lookup failed/);
});

test('sugadintas JSON atsakymas atmetamas', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('{', { status: 200 }));
  await assert.rejects(() => getRecipeById('52940'));
});

test('trūkstama arba netinkama atsakymo struktūra atmetama', async () => {
  mock.method(globalThis, 'fetch', async () => response({ meals: { idMeal: '52940' } }));
  await assert.rejects(() => getRecipeById('52940'), /Invalid meal list/);
  mock.restoreAll();
  mock.method(globalThis, 'fetch', async () => response({ meals: [{ idMeal: '52940', strMeal: 'Only title' }] }));
  await assert.rejects(() => getRecipeById('52940'), /Invalid meal details/);
  mock.restoreAll();
  mock.method(globalThis, 'fetch', async () => response({ data: [] }));
  await assert.rejects(() => searchByIngredient('chicken'), /Invalid TheMealDB response/);
});

test('paieška pagal ingredientą ir pavadinimą saugiai apdoroja tuščius rezultatus', async () => {
  const requests = [];
  mock.method(globalThis, 'fetch', async (input) => {
    requests.push(new URL(input));
    return response({ meals: null });
  });
  assert.deepEqual(await searchByIngredient(' chicken '), []);
  assert.deepEqual(await searchByName(' Arrabiata '), []);
  assert.equal(requests[0].pathname, '/api/json/v1/1/filter.php');
  assert.equal(requests[0].searchParams.get('i'), 'chicken');
  assert.equal(requests[1].pathname, '/api/json/v1/1/search.php');
  assert.equal(requests[1].searchParams.get('s'), 'Arrabiata');
});

test('neteisingas recepto ID nesukelia išorinio kvietimo', async () => {
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => { calls++; return response({ meals: null }); });
  assert.equal(await getRecipeById('../52940'), null);
  assert.equal(calls, 0);
});
