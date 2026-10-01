import { test, expect, type Page } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';
const key='test-only-signing-secret-32-bytes-not-real';
function receipt(){
  const data={version:1,generationId:randomUUID(),originalMealId:'52940',originalTitle:'Brown Stew Chicken',situation:'Neturiu svogūnų.',options:{minutes:30,people:2,goal:'original'},text:'Visas AI atsakymas\nVištiena be svogūnų.',generatedAt:new Date().toISOString()};
  const payload=Buffer.from(JSON.stringify(data)).toString('base64url');
  return {payload,signature:createHmac('sha256',key).update(payload).digest('hex')};
}
async function login(page:Page,email='test@example.com'){
 await page.goto('/login');await page.getByLabel('El. paštas',{exact:true}).fill(email);await page.getByLabel('Slaptažodis',{exact:true}).fill('TestPassword123!');
 await page.locator('.auth-panel').getByRole('button',{name:'Prisijungti',exact:true}).click();await expect(page.getByText(`Prisijungęs: ${email}`,{exact:true})).toBeVisible();
}
test('pasirašytas generavimas, formos pakeitimas, išsaugojimas, detalė ir pašalinimas',async({page})=>{
 await login(page);await page.goto('/recipes/52940');await page.getByLabel('Mano situacija').fill('Neturiu svogūnų.');
 const generated=page.waitForResponse(r=>r.url().endsWith('/api/ai')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'✨ Pritaikyti receptą'}).click();const data=await (await generated).json();expect(data.receipt).toBeTruthy();
 const save=page.getByRole('button',{name:'💾 Išsaugoti pritaikytą receptą'});await expect(save).toBeVisible();
 await page.getByLabel('Laikas',{exact:true}).selectOption('15');await page.getByLabel('Mano situacija').fill('Kita situacija');
 let posts=0;page.on('request',r=>{if(r.url().endsWith('/api/ai-recipes')&&r.method()==='POST')posts++;});
 await save.evaluate(button=>{for(let i=0;i<5;i++)(button as HTMLButtonElement).click();});
 await expect(page.getByRole('button',{name:'Išsaugota',exact:true})).toBeDisabled();expect(posts).toBe(1);
 const duplicate=await page.request.post('/api/ai-recipes',{data:{receipt:data.receipt}});expect(duplicate.status()).toBe(200);expect((await duplicate.json()).alreadySaved).toBe(true);
 await page.getByRole('link',{name:'Atidaryti išsaugotą AI receptą'}).click();await expect(page.getByRole('heading',{name:'Brown Stew Chicken',exact:true})).toBeVisible();
 await expect(page.getByText('Neturiu svogūnų.',{exact:true})).toBeVisible();await expect(page.getByText(/AI pritaikytas receptas · 30 min./)).toBeVisible();
 await page.reload();await expect(page.getByText(/AI bandomasis receptas/)).toBeVisible();
 await page.getByRole('button',{name:'Pašalinti AI receptą'}).click();await expect(page).toHaveURL(/\/my-ai-recipes$/);
});
test('anoniminis išsaugojimas ir svetimi įrašai neprieinami',async({page,browser,request})=>{
 expect((await request.get('/api/ai-recipes')).status()).toBe(401);
 expect((await request.post('/api/ai-recipes',{data:{receipt:receipt()}})).status()).toBe(401);
 expect((await request.delete('/api/ai-recipes/aaaaaaaa-aaaa-4aaa-8aaa-000000000001')).status()).toBe(401);
 await login(page);const result=await page.request.post('/api/ai-recipes',{data:{receipt:receipt()}});expect(result.status()).toBe(201);const {id}=await result.json();
 const context=await browser.newContext();const b=await context.newPage();await login(b,'second@example.com');
 expect((await b.request.get(`/api/ai-recipes/${id}`)).status()).toBe(404);
 expect((await b.request.delete(`/api/ai-recipes/${id}`)).status()).toBe(404);
 const list=await (await b.request.get('/api/ai-recipes')).json();expect(list.recipes.some((row:{id:string})=>row.id===id)).toBe(false);
 expect((await page.request.get(`/api/ai-recipes/${id}`)).status()).toBe(200);
 await page.request.delete(`/api/ai-recipes/${id}`);await context.close();
});
test('pakeistas rezultatas, svetimas user_id, Origin ir kūno ribos atmetami',async({page})=>{
 await login(page);const signed=receipt();const data=JSON.parse(Buffer.from(signed.payload,'base64url').toString());data.text='Forged';
 expect((await page.request.post('/api/ai-recipes',{data:{receipt:{...signed,payload:Buffer.from(JSON.stringify(data)).toString('base64url')}}})).status()).toBe(400);
 expect((await page.request.post('/api/ai-recipes',{data:{receipt:signed,user_id:'foreign'}})).status()).toBe(400);
 expect((await page.request.post('/api/ai-recipes',{data:{receipt:signed},headers:{origin:'https://other.invalid'}})).status()).toBe(403);
 expect((await page.request.post('/api/ai-recipes',{data:'x'.repeat(1024*1024+1),headers:{'content-type':'application/json'}})).status()).toBe(413);
});
test('DB prieigos ir pašalinimo klaidos parodomos saugiai',async({page})=>{
 await login(page,'denied@example.com');expect((await page.request.post('/api/ai-recipes',{data:{receipt:receipt()}})).status()).toBe(403);
 await login(page);const saved=await (await page.request.post('/api/ai-recipes',{data:{receipt:receipt()}})).json();
 await page.goto(`/my-ai-recipes/${saved.id}`);
 await page.route(`**/api/ai-recipes/${saved.id}`,r=>r.abort());
 await page.getByRole('button',{name:'Pašalinti AI receptą'}).click();await expect(page.locator('.my-recipes p[role="alert"]')).toContainText('Nepavyko pašalinti');
 await expect(page.getByText('Visas AI atsakymas',{exact:false})).toBeVisible();
 await page.unroute(`**/api/ai-recipes/${saved.id}`);await page.request.delete(`/api/ai-recipes/${saved.id}`);
});
test('neprisijungus rodomas prisijungimas, nesėkmingas išsaugojimas išlaiko atsakymą',async({page})=>{
 const signed=receipt();
 await page.route('**/api/ai',r=>r.fulfill({json:{text:'Naujas AI tekstas',receipt:signed}}));
 await page.goto('/recipes/52940');await page.getByLabel('Mano situacija').fill('Test');await page.getByRole('button',{name:'✨ Pritaikyti receptą'}).click();
 await expect(page.locator('.rescue-result a',{hasText:'Prisijunk, kad išsaugotum'})).toHaveAttribute('target','_blank');
 await login(page);await page.goto('/recipes/52940');await page.getByLabel('Mano situacija').fill('Test');await page.getByRole('button',{name:'✨ Pritaikyti receptą'}).click();
 await page.route('**/api/ai-recipes',r=>r.request().method()==='POST'?r.abort():r.continue());
 await page.getByRole('button',{name:'💾 Išsaugoti pritaikytą receptą'}).click();await expect(page.locator('.rescue-result [role=alert]')).toContainText('Nepavyko išsaugoti');
 await expect(page.getByText('Naujas AI tekstas',{exact:true})).toBeVisible();
});
