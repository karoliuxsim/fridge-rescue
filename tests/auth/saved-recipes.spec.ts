import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email = "test@example.com") {
  await page.goto("/login");
  await page.getByLabel("El. paštas", { exact: true }).fill(email);
  await page.getByLabel("Slaptažodis", { exact: true }).fill("TestPassword123!");
  await page.locator(".auth-panel").getByRole("button", { name: "Prisijungti", exact: true }).click();
  await expect(page.getByText(`Prisijungęs: ${email}`, { exact: true })).toBeVisible();
}

test("išsaugojimas, dublikatas, perkrovimas, kortelė ir pašalinimas", async ({ page }) => {
  await login(page);
  await page.goto("/recipes/52940");
  const button = page.getByRole("button", { name: "❤️ Išsaugoti", exact: true });
  let posts = 0;
  page.on("request", request => { if (request.method() === "POST" && request.url().endsWith("/api/saved-recipes")) posts++; });
  await button.evaluate(element => { for (let i = 0; i < 6; i++) (element as HTMLButtonElement).click(); });
  await expect(page.getByRole("button", { name: "❤️ Išsaugota", exact: true })).toBeDisabled();
  expect(posts).toBe(1);
  const duplicate = await page.request.post("/api/saved-recipes", { data: { mealId: "52940" } });
  expect(duplicate.status()).toBe(200);
  expect((await duplicate.json()).alreadySaved).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "❤️ Išsaugota", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "Mano receptai", exact: true }).click();
  await expect(page.locator(".saved-card")).toHaveCount(1);
  await expect(page.locator(".saved-card")).toContainText("Brown Stew Chicken");
  await expect(page.locator(".saved-card a")).toHaveAttribute("href", "/recipes/52940");
  await page.getByRole("button", { name: "Pašalinti Brown Stew Chicken" }).click();
  await expect(page.getByText("Receptas pašalintas.")).toBeVisible();
  await expect(page.getByText("Dar nėra išsaugotų receptų.")).toBeVisible();
  await page.reload();
  await expect(page.locator(".saved-card")).toHaveCount(0);
});

test("atsijungęs vartotojas neturi prieigos, įvestis tikrinama", async ({ page, request }) => {
  for (const response of [await request.get("/api/saved-recipes"), await request.post("/api/saved-recipes", { data: { mealId: "52940" } }), await request.delete("/api/saved-recipes/aaaaaaaa-aaaa-4aaa-8aaa-000000000001")]) {
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  await page.goto("/my-recipes");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/recipes/52940");
  await expect(page.getByRole("link", { name: "Prisijunk, kad išsaugotum" })).toBeVisible();
  await login(page);
  expect((await page.request.post("/api/saved-recipes", { data: { mealId: "abc" } })).status()).toBe(400);
  expect((await page.request.delete("/api/saved-recipes/invalid")).status()).toBe(400);
  expect((await page.request.post("/api/saved-recipes", { headers: { origin: "https://other.example" }, data: { mealId: "52940" } })).status()).toBe(403);
});

test("sesija perduodama, savininkas ir recepto turinys nustatomi serveryje", async ({ page, browser }) => {
  await login(page);
  const saved = await page.request.post("/api/saved-recipes", { data: { mealId: "52940", user_id: "22222222-2222-4222-8222-222222222222", title: "Forged", image_url: "https://other.example" } });
  expect(saved.status()).toBe(201);
  const a = await page.request.get("/api/saved-recipes");
  const recipes = (await a.json()).recipes;
  expect(recipes).toHaveLength(1);
  expect(recipes[0].title).toBe("Brown Stew Chicken");
  expect(recipes[0].image_url).toContain("themealdb.com");
  const bContext = await browser.newContext({ baseURL: "http://localhost:3107" });
  try {
    const bPage = await bContext.newPage();
    await login(bPage, "second@example.com");
    expect((await (await bContext.request.get("/api/saved-recipes")).json()).recipes).toHaveLength(0);
    expect((await bContext.request.delete(`/api/saved-recipes/${recipes[0].id}`)).status()).toBe(404);
    expect((await (await page.request.get("/api/saved-recipes")).json()).recipes).toHaveLength(1);
  } finally { await bContext.close(); }
  expect((await page.request.delete(`/api/saved-recipes/${recipes[0].id}`)).status()).toBe(200);
});

test("permission denied rodomas saugiai, sėkmė neimituojama", async ({ page }) => {
  await login(page, "denied@example.com");
  const response = await page.request.get("/api/saved-recipes");
  expect(response.status()).toBe(403);
  expect((await response.json()).code).toBe("RECIPES_ACCESS_DENIED");
  await page.goto("/my-recipes");
  await expect(page.locator("main").getByRole("alert")).toContainText("42501");
  await expect(page.getByRole("link", { name: "Bandyti dar kartą" })).toBeVisible();
  await page.goto("/recipes/52940");
  await page.getByRole("button", { name: "❤️ Išsaugoti", exact: true }).click();
  await expect(page.locator(".save-control").getByRole("alert")).toContainText("42501");
  await expect(page.getByRole("button", { name: "❤️ Išsaugota", exact: true })).toHaveCount(0);
});

test("laukimas, tinklo klaidos ir sesijos pasibaigimas", async ({ page, context }) => {
  await login(page);
  await page.goto("/recipes/52940");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/saved-recipes", async route => { await gate; await route.abort(); });
  await page.getByRole("button", { name: "❤️ Išsaugoti", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saugoma..." })).toBeDisabled();
  release();
  await expect(page.locator(".save-control").getByRole("alert")).toContainText("Patikrinkite ryšį");
  await page.unroute("**/api/saved-recipes");
  await context.clearCookies();
  await page.getByRole("button", { name: "❤️ Išsaugoti", exact: true }).click();
  await expect(page.locator(".save-control").getByRole("alert")).toContainText("Prisijunkite");
  await expect(page.locator(".save-control").getByRole("link", { name: "Prisijungti" })).toBeVisible();
});

test("nepavykęs pašalinimas palieka kortelę ir leidžia kartoti", async ({ page }) => {
  await login(page);
  expect((await page.request.post("/api/saved-recipes", { data: { mealId: "52940" } })).status()).toBe(201);
  await page.goto("/my-recipes");
  await page.route("**/api/saved-recipes/*", route => route.fulfill({ status: 503, json: { error: "Nepavyko pašalinti recepto." } }));
  await page.getByRole("button", { name: "Pašalinti Brown Stew Chicken" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Nepavyko pašalinti");
  await expect(page.locator(".saved-card")).toHaveCount(1);
  await page.unroute("**/api/saved-recipes/*");
  await page.getByRole("button", { name: "Pašalinti Brown Stew Chicken" }).click();
  await expect(page.locator(".saved-card")).toHaveCount(0);
});
