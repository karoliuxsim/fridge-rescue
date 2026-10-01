import { test, expect } from '@playwright/test';

const result={recipes:[{id:'52940',title:'Brown Stew Chicken',imageUrl:'https://www.themealdb.com/images/media/meals/sypxpx1515365095.jpg'}]};

test('Developer Mode pagal nutylėjimą išjungtas, 6 laukai, išvalymas ir perkrovimas',async({page})=>{
 let requests=0;
 await page.route('**/api/recipes?**',route=>{requests++;return route.fulfill({json:result});});
 await page.goto('/');const toggle=page.getByRole('switch',{name:'Developer Mode'});
 await expect(toggle).not.toBeChecked();await expect(page.getByRole('heading',{name:'Naršyklės API užklausos'})).toHaveCount(0);
 await page.locator('#ingredient').fill('chicken');await page.getByRole('button',{name:'Ieškoti'}).click();await expect(page.locator('.recipe-card')).toHaveCount(1);
 await toggle.check();const table=page.locator('.developer-panel table');
 for(const heading of ['API sistema / operacija','Endpoint','HTTP metodas','HTTP statusas','Sėkmė','Trukmė'])await expect(table.getByRole('columnheader',{name:heading,exact:true})).toBeVisible();
 await expect(table.locator('tbody tr')).toHaveCount(0);
 await page.getByRole('button',{name:'Ieškoti'}).click();await expect(table.locator('tbody tr')).toHaveCount(1);expect(requests).toBe(2);
 await expect(table.locator('tbody tr')).toContainText('/api/recipes');await expect(table.locator('tbody tr')).toContainText('200');await expect(table.locator('tbody tr')).toContainText('Taip');
 await page.getByRole('button',{name:'Išvalyti',exact:true}).click();await expect(table.locator('tbody tr')).toHaveCount(0);
 await page.getByRole('button',{name:'Ieškoti'}).click();await expect(table.locator('tbody tr')).toHaveCount(1);
 await toggle.uncheck();await toggle.check();await expect(table.locator('tbody tr')).toHaveCount(0);
 await page.reload();await expect(toggle).not.toBeChecked();
});

test('HTTP klaidos ir tinklo klaida rodomos, query ir atsakymai nepatenka į lentelę',async({page})=>{
 let count=0;
 await page.route('**/api/recipes?**',route=>{const status=[401,429,502][count++];return status?route.fulfill({status,json:{error:'RESPONSE_SECRET'}}):route.abort();});
 await page.goto('/');await page.getByRole('switch',{name:'Developer Mode'}).check();
 await page.locator('#ingredient').fill('QUERY_SECRET');
 for(const status of ['401','429','502','Negautas (tinklo klaida)']){
   await page.getByRole('button',{name:'Ieškoti'}).click();
   await expect(page.locator('.developer-panel tbody tr').first()).toContainText(status);
   await expect(page.getByRole('button',{name:'Ieškoti'})).toBeEnabled();
 }
 const diagnostics=await page.locator('.developer-panel').innerText();expect(diagnostics).not.toContain('QUERY_SECRET');expect(diagnostics).not.toContain('RESPONSE_SECRET');expect(count).toBe(4);
});

test('globali būsena pereina į receptą, prompt ir AI tekstas diagnostikoje nerodomi',async({page})=>{
 await page.route('**/api/ai',route=>route.fulfill({json:route.request().postDataJSON().preview?{prompt:'PROMPT_SECRET',previewHash:'a'.repeat(64)}:{text:'AI_RESPONSE_SECRET'}}));
 await page.goto('/');await page.getByRole('switch',{name:'Developer Mode'}).check();
 await page.route('**/api/recipes?**',route=>route.fulfill({json:result}));
 await page.locator('#ingredient').fill('chicken');await page.getByRole('button',{name:'Ieškoti'}).click();
 await page.locator('.recipe-card a').click();await expect(page.getByRole('switch',{name:'Developer Mode'})).toBeChecked();
 await page.getByLabel('Mano situacija').fill('SITUATION_SECRET');await page.getByRole('button',{name:'Peržiūrėti galutinį prompt'}).click();
 await expect(page.locator('.developer-panel tbody tr').first()).toContainText('prompt peržiūra');
 await page.getByRole('button',{name:'✨ Pritaikyti receptą'}).click();await expect(page.getByText('AI_RESPONSE_SECRET',{exact:true})).toBeVisible();
 const panel=await page.locator('.developer-panel').innerText();for(const secret of ['SITUATION_SECRET','PROMPT_SECRET','AI_RESPONSE_SECRET'])expect(panel).not.toContain(secret);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
