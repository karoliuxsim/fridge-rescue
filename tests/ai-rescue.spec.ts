import { test, expect } from "@playwright/test";

test("neprisijungus: siunčia tik ID ir situaciją, originalas nepakeistas, AI tekstas saugus", async ({ page }) => {
  let body: unknown;
  await page.route("**/api/ai", async route => {
    body = route.request().postDataJSON();
    await route.fulfill({ json: { text: 'Vištiena be svogūnų\nIngredientai: vištiena.\n<script>alert(1)</script>' } });
  });
  await page.goto("/recipes/52940");
  const original = await page.locator("article").innerText();
  await page.getByLabel("Mano situacija").fill(" Neturiu svogūnų. ");
  await page.getByRole("button", { name: "✨ Pritaikyti receptą" }).click();
  await expect(page.getByRole("region", { name: "AI pritaikytas receptas" })).toContainText("Vištiena be svogūnų");
  expect(body).toEqual({ recipeId: "52940", situation: "Neturiu svogūnų.", options: { minutes: 30, people: 2, goal: "original" } });
  expect(await page.locator("article").innerText()).toBe(original);
  await expect(page.locator(".rescue-result script")).toHaveCount(0);
  await page.screenshot({path:"test-results/ai-rescue-desktop.png",fullPage:true});
});

test("tuščia situacija nesiunčia užklausos", async ({ page }) => {
  let calls=0;
  await page.route("**/api/ai", route=>{calls++;return route.fulfill({json:{text:"Unexpected"}});});
  await page.goto("/recipes/52940");
  for(const value of ["", "   "]) {
    await page.getByLabel("Mano situacija").fill(value);
    await page.getByRole("button",{name:"✨ Pritaikyti receptą"}).click();
    await expect(page.locator(".rescue-panel [role=alert]")).toContainText("Aprašyk savo situaciją");
  }
  expect(calls).toBe(0);
  await expect(page.getByLabel("Mano situacija")).toHaveAttribute("maxlength","2000");
});

test("greiti paspaudimai siunčia vieną užklausą ir rodo laukimą", async ({ page }) => {
  let calls=0; let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/api/ai",async route=>{calls++;await gate;await route.fulfill({json:{text:"Pritaikytas receptas"}});});
  await page.goto("/recipes/52940");
  await page.getByLabel("Mano situacija").fill("Neturiu svogūnų.");
  await page.locator(".rescue-panel form").evaluate(form=>{
    for(let i=0;i<5;i++)(form as HTMLFormElement).requestSubmit();
  });
  await expect(page.getByText("Pritaikomas receptas...",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"✨ Pritaikyti receptą"})).toBeDisabled();
  await expect(page.getByLabel("Mano situacija")).toBeDisabled();
  await expect.poll(()=>calls).toBe(1);
  release();
  await expect(page.getByRole("heading",{name:"AI pritaikytas receptas"})).toBeVisible();
  await expect(page.getByRole("button",{name:"✨ Pritaikyti receptą"})).toBeEnabled();
  expect(calls).toBe(1);
});

test("API, limito, tuščio atsakymo ir tinklo klaidos aiškios, automatiškai nekartoja", async ({ page }) => {
  let calls=0;
  const failures=[
    {status:502,json:{error:{code:"AI_UNAVAILABLE"}}},
    {status:429,json:{error:{code:"AI_RATE_LIMITED"}}},
    {status:504,json:{error:{code:"AI_TIMEOUT"}}},
    {status:404,json:{error:{code:"RECIPE_NOT_FOUND"}}},
    {status:200,json:{text:" "}},
  ];
  await page.route("**/api/ai",route=>{const failure=failures[calls++];return failure?route.fulfill(failure):route.abort();});
  await page.goto("/recipes/52940");
  await page.getByLabel("Mano situacija").fill("Neturiu svogūnų.");
  for(let i=0;i<6;i++) {
    await page.getByRole("button",{name:"✨ Pritaikyti receptą"}).click();
    await expect(page.locator(".rescue-panel [role=alert]")).toBeVisible();
    await expect(page.getByRole("button",{name:"✨ Pritaikyti receptą"})).toBeEnabled();
    expect(calls).toBe(i+1);
  }
  await expect(page.locator(".rescue-result")).toHaveCount(0);
});

test("Gemini prieigos, kvotos ir nepasiekiamumo klaidos turi aiškius pranešimus", async ({ page }) => {
  const failures = [
    { status: 502, json: { error: { code: "AI_AUTH_ERROR" } }, message: "AI paslaugos prieigos klaida" },
    { status: 429, json: { error: { code: "AI_QUOTA_EXCEEDED" } }, message: "Pasiektas AI paslaugos naudojimo limitas" },
    { status: 502, json: { error: { code: "AI_UNAVAILABLE" } }, message: "AI paslauga laikinai nepasiekiama" },
  ];
  let calls = 0;
  await page.route("**/api/ai", route => route.fulfill(failures[calls++]));
  await page.goto("/recipes/52940");
  await page.getByLabel("Mano situacija").fill("Neturiu svogūnų.");
  for (const failure of failures) {
    await page.getByRole("button", { name: "✨ Pritaikyti receptą" }).click();
    await expect(page.locator(".rescue-panel [role=alert]")).toContainText(failure.message);
    await expect(page.getByRole("button", { name: "✨ Pritaikyti receptą" })).toBeEnabled();
  }
});

test("mobilus vaizdas ir grįžimas į paiešką",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/recipes/52940");
  await page.getByLabel("Mano situacija").scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:"test-results/ai-rescue-mobile.png",fullPage:true});
  await page.getByRole("link",{name:"Grįžti į paiešką"}).click();
  await expect(page.getByLabel("Paieškos būdas")).toBeVisible();
});

test("pasirinkimai, prompt peržiūra ir pasenusios peržiūros pašalinimas",async({page})=>{
  let calls=0;
  await page.route("**/api/ai",async route=>{
    calls++; const body=route.request().postDataJSON();
    expect(body).toMatchObject({recipeId:"52940",situation:"Neturiu svogūnų.",options:{minutes:15,people:4,goal:"cheaper"},preview:true});
    await route.fulfill({json:{prompt:"Tikslus serverio prompt\n15 min. 4 žmonės, pigiau.",previewHash:"a".repeat(64)}});
  });
  await page.goto("/recipes/52940");
  await page.getByLabel("Mano situacija").fill("Neturiu svogūnų.");
  await page.getByLabel("Laikas",{exact:true}).selectOption("15");
  await page.getByLabel("Žmonių skaičius").selectOption("4");
  await page.getByLabel("Tikslas").selectOption("cheaper");
  await page.getByRole("button",{name:"Peržiūrėti galutinį prompt"}).click();
  await expect(page.getByRole("region",{name:"Galutinis prompt",exact:true})).toContainText("Tikslus serverio prompt");
  await expect(page.locator(".rescue-result pre")).toHaveText("Tikslus serverio prompt\n15 min. 4 žmonės, pigiau.");
  expect(calls).toBe(1);
  await page.getByLabel("Tikslas").selectOption("healthier");
  await expect(page.getByRole("region",{name:"Galutinis prompt",exact:true})).toHaveCount(0);
});
