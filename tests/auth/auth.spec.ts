import { test, expect, type Page } from "@playwright/test";

async function fill(page: Page, email = "test@example.com", password = "TestPassword123!") {
  await page.getByLabel("El. paštas", { exact: true }).fill(email);
  await page.getByLabel("Slaptažodis", { exact: true }).fill(password);
}
const form = (page: Page) => page.locator(".auth-panel");

test("registracija, vienas siuntimas, PKCE patvirtinimas ir production APP_URL grįžimas", async ({ page, context }) => {
  await page.goto("/register");
  await fill(page);
  let posts = 0;
  page.on("request", r => { if (r.method() === "POST" && r.headers()["next-action"]) posts++; });
  await page.locator(".auth-panel form").evaluate(element => {
    for (let index = 0; index < 6; index++) (element as HTMLFormElement).requestSubmit();
  });
  await expect(form(page).getByRole("status")).toContainText("Patikrinkite el. paštą");
  expect(posts).toBe(1);
  await expect(page.getByText("Neprisijungęs", { exact: true })).toBeVisible();
  const response = await context.request.get("/auth/confirm?code=valid-code&next=https://example.com", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("https://auth.fridge.example/");
  expect(response.headers()["cache-control"]).toContain("no-store");
  await page.goto("/");
  await expect(page.getByText("Prisijungęs: test@example.com", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Atsijungti", exact: true })).toBeVisible();
});

test("prisijungimas, perkrovimas, atsijungimas ir vienas greitas siuntimas", async ({ page }) => {
  await page.goto("/login");
  await fill(page);
  let posts = 0;
  page.on("request", r => { if (r.method() === "POST" && r.headers()["next-action"]) posts++; });
  await page.locator(".auth-panel form").evaluate(element => {
    for (let index = 0; index < 6; index++) (element as HTMLFormElement).requestSubmit();
  });
  await expect(page.getByText("Prisijungęs: test@example.com", { exact: true })).toBeVisible();
  expect(posts).toBe(1);
  await page.reload();
  await expect(page.getByText("Prisijungęs: test@example.com", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Atsijungti", exact: true }).click();
  await expect(page.getByText("Neprisijungęs", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Neprisijungęs", { exact: true })).toBeVisible();
});

test("validacija, neteisingi duomenys ir nepatvirtintas el. paštas", async ({ page }) => {
  await page.goto("/register");
  await form(page).getByRole("button", { name: "Registruotis", exact: true }).click();
  await expect(form(page).getByRole("alert")).toContainText("Įveskite el. paštą ir slaptažodį");
  await fill(page, "test@example.com", "short");
  await form(page).getByRole("button", { name: "Registruotis", exact: true }).click();
  await expect(form(page).getByRole("alert")).toContainText("bent 8 simboliai");
  await page.goto("/login");
  await fill(page, "test@example.com", "wrong-password");
  await form(page).getByRole("button", { name: "Prisijungti", exact: true }).click();
  await expect(form(page).getByRole("alert")).toContainText("Neteisingas el. paštas arba slaptažodis");
  await fill(page, "unconfirmed@example.com");
  await form(page).getByRole("button", { name: "Prisijungti", exact: true }).click();
  await expect(form(page).getByRole("alert")).toContainText("Pirmiausia patvirtinkite el. paštą");
});

test("Supabase klaidos ir paskyros egzistavimo privatumas", async ({ page }) => {
  await page.goto("/register");
  for (const [email, message] of [["exists@example.com", "jau egzistuoja"], ["weak@example.com", "per silpnas"], ["limit@example.com", "Per daug bandymų"]]) {
    await fill(page, email);
    await form(page).getByRole("button", { name: "Registruotis", exact: true }).click();
    await expect(form(page).getByRole("alert")).toContainText(message);
  }
  await fill(page, "hidden-existing@example.com");
  await form(page).getByRole("button", { name: "Registruotis", exact: true }).click();
  await expect(form(page).getByRole("status")).toContainText("Jei paskyra jau patvirtinta, prisijunkite");
});

test("netinkamos patvirtinimo nuorodos ir token_hash patvirtinimas", async ({ page, context }) => {
  for (const query of ["", "?code=invalid", "?token_hash=invalid&type=email", "?token_hash=valid-hash&type=recovery", "?error=access_denied"]) {
    const response = await context.request.get(`/auth/confirm${query}`, { maxRedirects: 0 });
    expect(response.headers().location).toBe("https://auth.fridge.example/login?confirmation=error");
  }
  const valid = await context.request.get("/auth/confirm?token_hash=valid-hash&type=email", { maxRedirects: 0 });
  expect(valid.headers().location).toBe("https://auth.fridge.example/");
  await page.goto("/");
  await expect(page.getByText("Prisijungęs: test@example.com", { exact: true })).toBeVisible();
  const reused = await context.request.get("/auth/confirm?token_hash=valid-hash&type=email", { maxRedirects: 0 });
  expect(reused.headers().location).toContain("confirmation=error");
  await page.goto("/login?confirmation=error");
  await expect(page.getByText(/Patvirtinimo nuoroda netinkama/)).toBeVisible();
});

test("Proxy atnaujina pasibaigusią sesiją; suklastotu vartotoju nepasitikima", async ({ page, context }) => {
  await page.goto("/login");
  await fill(page);
  await form(page).getByRole("button", { name: "Prisijungti", exact: true }).click();
  await expect(page.getByText("Prisijungęs: test@example.com", { exact: true })).toBeVisible();
  const cookie = (await context.cookies()).find(c => c.name.endsWith("-auth-token"));
  expect(Boolean(cookie)).toBe(true);
  const session = JSON.parse(Buffer.from(cookie!.value.replace(/^base64-/, ""), "base64url").toString());
  session.expires_at = Math.floor(Date.now() / 1000) - 30;
  await context.addCookies([{ ...cookie!, value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url") }]);
  await page.reload();
  await expect(page.getByText("Prisijungęs: test@example.com", { exact: true })).toBeVisible();
  const refreshed = (await context.cookies()).find(c => c.name === cookie!.name)!;
  const refreshedSession = JSON.parse(Buffer.from(refreshed.value.replace(/^base64-/, ""), "base64url").toString());
  expect(refreshedSession.expires_at > Date.now() / 1000).toBe(true);
  refreshedSession.access_token = "forged-token";
  refreshedSession.user.email = "forged@example.com";
  await context.addCookies([{ ...refreshed, value: "base64-" + Buffer.from(JSON.stringify(refreshedSession)).toString("base64url") }]);
  await page.reload();
  await expect(page.getByText("Neprisijungęs", { exact: true })).toBeVisible();
  await expect(page.getByText(/Prisijungęs:/)).toHaveCount(0);
});
