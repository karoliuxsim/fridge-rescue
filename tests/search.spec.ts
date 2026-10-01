import { test, expect } from "@playwright/test";

const result = (title: string, id = "52940") => ({ recipes: [{
  id, title, imageUrl: "https://www.themealdb.com/images/media/meals/sypxpx1515365095.jpg",
}] });

test("chicken: tikras API, kortelės, recepto atidarymas ir grįžimas", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Kokį ingredientą turi?").fill("chicken");
  await page.getByRole("button", { name: "Ieškoti" }).click();
  const card = page.locator(".recipe-card").filter({ hasText: "Brown Stew Chicken" });
  await expect(card).toBeVisible({ timeout: 20000 });
  await expect(card).toContainText("52940");
  await expect(card.getByRole("img")).toHaveAttribute("src", /themealdb/);
  await expect.poll(() => card.getByRole("img").evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: "test-results/ingredient-desktop.png" });
  await card.getByRole("link").click();
  await expect(page).toHaveURL(/\/recipes\/52940$/);
  await expect(page.getByRole("heading", { name: "Brown Stew Chicken" })).toBeVisible();
  await page.getByRole("link", { name: "Grįžti į paiešką" }).click();
  await expect(page.getByLabel("Paieškos būdas")).toBeVisible();
});

test("Arrabiata: tikras API ir mobilus kortelių vaizdas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Paieškos būdas").selectOption("name");
  await page.getByLabel("Kokio patiekalo ieškai?").fill("Arrabiata");
  await page.getByRole("button", { name: "Ieškoti" }).click();
  const card = page.locator(".recipe-card").filter({ hasText: "Spicy Arrabiata Penne" });
  await expect(card).toBeVisible({ timeout: 20000 });
  await expect(card).toContainText("52771");
  await expect(card.getByRole("link")).toHaveAttribute("href", "/recipes/52771");
  await expect(card.getByRole("img")).toHaveAttribute("src", /themealdb/);
  await card.scrollIntoViewIfNeeded();
  await expect.poll(() => card.getByRole("img").evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/name-mobile.png", fullPage: true });
});

test("tuščia ir vien tarpų įvestis: pranešimas be API užklausos", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/recipes?**", route => { requests++; return route.fulfill({ json: result("Unexpected") }); });
  await page.goto("/");
  for (const mode of ["ingredient", "name"]) {
    await page.getByLabel("Paieškos būdas").selectOption(mode);
    for (const value of ["", "   "]) {
      await page.locator("#ingredient").fill(value);
      await page.getByRole("button", { name: "Ieškoti" }).click();
      await expect(page.getByRole("region", { name: "Paieškos rezultatai" }).getByRole("alert")).toHaveText(mode === "ingredient" ? "Įveskite ingredientą." : "Įveskite patiekalo pavadinimą.");
    }
  }
  expect(requests).toBe(0);
});

test("neegzistuojantis pavadinimas: tikras API grąžina tuščią sąrašą", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Paieškos būdas").selectOption("name");
  await page.locator("#ingredient").fill("zzzzFridgeRescueNoSuchMeal987654");
  await page.getByRole("button", { name: "Ieškoti" }).click();
  await expect(page.getByText("Receptų nerasta", { exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".recipe-card")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Paieškos rezultatai" }).getByRole("alert")).toHaveCount(0);
});

test("API 502 ir tinklo klaida: aiškus pranešimas, galima kartoti", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/recipes?**", route => {
    calls++;
    return calls === 1 ? route.fulfill({ status: 502, json: { error: "API failed" } }) : route.abort();
  });
  await page.goto("/");
  await page.locator("#ingredient").fill("chicken");
  for (let index = 0; index < 2; index++) {
    await page.getByRole("button", { name: "Ieškoti" }).click();
    await expect(page.getByRole("region", { name: "Paieškos rezultatai" }).getByRole("alert")).toContainText("Nepavyko gauti receptų");
    await expect(page.getByRole("button", { name: "Ieškoti" })).toBeEnabled();
    await expect(page.locator(".recipe-card")).toHaveCount(0);
  }
  expect(calls).toBe(2);
});

test("greiti paspaudimai ir formos siuntimai vykdo vieną užklausą", async ({ page }) => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/recipes?**", async route => {
    calls++;
    await gate;
    await route.fulfill({ json: result("Chicken result") });
  });
  await page.goto("/");
  await page.locator("#ingredient").fill("chicken");
  await page.locator("form").evaluate(form => {
    const button = form.querySelector("button")!;
    for (let index = 0; index < 5; index++) button.click();
    for (let index = 0; index < 5; index++) (form as HTMLFormElement).requestSubmit();
  });
  await expect.poll(() => calls).toBe(1);
  await expect(page.getByRole("button", { name: "Ieškoma..." })).toBeDisabled();
  await expect(page.getByText("Ieškoma...", { exact: true })).toBeVisible();
  release();
  await expect(page.getByRole("heading", { name: "Chicken result" })).toBeVisible();
  expect(calls).toBe(1);
});

test("vėluojantis senas atsakymas neperrašo naujos paieškos", async ({ page }) => {
  // Deliberately ignore cancellation to verify the stale-response guard too.
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => originalFetch(input, { ...init, signal: undefined });
  });
  let release!: () => void;
  let oldStarted = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/recipes?**", async route => {
    if (new URL(route.request().url()).searchParams.get("mode") === "ingredient") {
      oldStarted = true;
      await gate;
      await route.fulfill({ json: result("OLD chicken") });
    } else {
      await route.fulfill({ json: result("NEW Arrabiata", "52771") });
    }
  });
  await page.goto("/");
  await page.locator("#ingredient").fill("chicken");
  await page.getByRole("button", { name: "Ieškoti" }).click();
  await expect.poll(() => oldStarted).toBe(true);
  await page.getByLabel("Paieškos būdas").selectOption("name");
  await page.locator("#ingredient").fill("Arrabiata");
  await page.getByRole("button", { name: "Ieškoti" }).click();
  await expect(page.getByRole("heading", { name: "NEW Arrabiata" })).toBeVisible();
  const oldFinished = page.waitForEvent("requestfinished", request => request.url().includes("mode=ingredient"));
  release();
  await oldFinished;
  await page.waitForTimeout(200);
  await expect(page.getByRole("heading", { name: "NEW Arrabiata" })).toBeVisible();
  await expect(page.getByText("OLD chicken")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Paieškos rezultatai" }).getByRole("alert")).toHaveCount(0);
});

test("serverio validacija ir senas ingredient API adresas", async ({ request }) => {
  for (const url of ["/api/recipes?mode=name&q=", "/api/recipes?mode=unknown&q=chicken", "/api/recipes?mode=name&q=" + "a".repeat(101)]) {
    expect((await request.get(url)).status()).toBe(400);
  }
  const legacy = await request.get("/api/recipes?ingredient=chicken");
  expect(legacy.status()).toBe(200);
  expect((await legacy.json()).recipes.length).toBeGreaterThan(0);
});
