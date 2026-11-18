// AUTH-UI — signing in and out the way a person would, plus the redirects around it.
const jwt = require("jsonwebtoken");
const { test, expect, TOKEN_KEY } = require("../../support/fixtures");
const { E2E } = require("../../env");

async function fillLogin(page, username, password) {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
}

test.describe("Login & logout", () => {
  test("[AUTH-UI-01] login page shows the form; Sign in stays disabled until both fields are filled", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    const signIn = page.getByRole("button", { name: "Sign in" });
    await expect(signIn).toBeDisabled();
    await page.getByLabel("Username").fill("de.dev1");
    await expect(signIn).toBeDisabled();
    await page.getByLabel("Password").fill("password");
    await expect(signIn).toBeEnabled();
    await page.getByLabel("Username").fill(""); // clearing a field disables it again
    await expect(signIn).toBeDisabled();
    await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  });

  test("[AUTH-UI-02] valid credentials land on Home", async ({ page }) => {
    await page.goto("/login");
    await fillLogin(page, "de.dev1", "password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();
  });

  test("[AUTH-UI-03] wrong password shows an inline error and keeps the user on /login", async ({ page }) => {
    await page.goto("/login");
    await fillLogin(page, "de.dev1", "letmein");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid username, email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Password")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Your session expired")).toHaveCount(0); // a wrong password isn't an expired session
    // The button comes back so they can retry.
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  test("[AUTH-UI-04] unknown user gets the same error (no hint which usernames exist)", async ({ page }) => {
    await page.goto("/login");
    await fillLogin(page, "ghost.user", "password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid username, email or password")).toBeVisible();
  });

  test("[AUTH-UI-05] retry after a failed attempt succeeds and clears the error", async ({ page }) => {
    await page.goto("/login");
    await fillLogin(page, "de.lead", "nope");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid username, email or password")).toBeVisible();
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();
  });

  test("[AUTH-UI-06] mixed-case username with spaces still signs in", async ({ page }) => {
    await page.goto("/login");
    await fillLogin(page, "  QA.Lead ", "password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();
  });

  test("[AUTH-UI-07] pressing Enter in the password field submits the form", async ({ page }) => {
    await page.goto("/login");
    await fillLogin(page, "de.manager", "password");
    await page.getByLabel("Password").press("Enter");
    await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();
  });

  test("[AUTH-UI-08] picking a demo user fills the form, and signing in works", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Demo users")).toBeVisible();
    await page.getByRole("button", { name: /cert\.admin/ }).click();
    await expect(page.getByLabel("Username")).toHaveValue("cert.admin");
    await expect(page.getByLabel("Password")).toHaveValue("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();
  });

  test("[AUTH-UI-09] 'Continue with Google' explains it isn't available yet", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Continue with Google/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Google sign-in is not available yet" })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  for (const path of ["/", "/settings", "/practices", "/access-control", "/ai-tracker", "/practices/contributions/new"]) {
    test(`[AUTH-UI-10] signed-out visit to ${path} redirects to /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
  }

  test("[AUTH-UI-11] a signed-in user opening /login is sent to Home", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();
  });

  test("[AUTH-UI-12] sign out from the user menu clears the session; Back and reload don't restore it", async ({ page }) => {
    await page.goto("/login");
    await fillLogin(page, "de.dev1", "password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("link", { name: "Settings" }).first().click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.getByRole("button", { name: /Riley Patel/ }).click();
    await expect(page.getByRole("menu")).toContainText("Practitioner @ Digital Engineering");
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY)).toBeNull();
    await page.goBack();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("[AUTH-UI-13] an expired or tampered token in storage is discarded and the user is asked to sign in", async ({ page }) => {
    await page.addInitScript((k) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.tampered");
        sessionStorage.setItem("seeded", "1");
      }
    }, TOKEN_KEY);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY)).toBeNull();
  });

  test("[AUTH-UI-14] user menu closes with Escape and shows every role for a multi-role user", async ({ page, loginAs }) => {
    await loginAs("multi.user");
    await page.goto("/");
    await page.getByRole("button", { name: /Alex Rivera/ }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toContainText("Practice Lead @ QA");
    await expect(menu).toContainText("Practitioner @ AI");
    await expect(menu).toContainText("AI Member @ AI Tracker");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("[AUTH-UI-15] a session that expires while the tab is open sends the user back to sign in", async ({ page, as }) => {
    // Sessions last 8h; leaving a tab open overnight is normal. Simulate it by swapping in an expired token mid-use.
    const id = (await (await as("de.dev1")).me()).id;
    await page.goto("/login");
    await page.getByLabel("Username").fill("de.dev1");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Practices" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Practices" })).toBeVisible();
    await page.getByRole("tab", { name: "Contributions" }).click();
    await expect(page.getByRole("heading", { name: "Practice contributions" })).toBeVisible();
    const expired = jwt.sign({ sub: id, exp: Math.floor(Date.now() / 1000) - 60 }, E2E.jwtSecret);
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [TOKEN_KEY, expired]);
    await page.getByRole("link", { name: "Start a contribution" }).click(); // client-side navigation → API answers 401
    await expect(page, "user should be asked to sign in again, not shown a misleading page").toHaveURL(/\/login$/, { timeout: 8_000 });
    await expect(page.getByText("Your session expired. Sign in again to continue.")).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY)).toBeNull();
    // Signing back in works and clears the notice.
    await page.getByLabel("Username").fill("de.dev1");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();
  });

  test("[AUTH-UI-16] a session that expires during an action (upload) also returns the user to sign in", async ({ page, loginAs, as }) => {
    const id = (await (await as("ai.dev1")).me()).id;
    await loginAs("ai.dev1");
    await page.goto("/ai-tracker");
    await expect(page.getByRole("heading", { name: "Claude usage reports" })).toBeVisible();
    // The token runs out while the upload form is open.
    const expired = jwt.sign({ sub: id, exp: Math.floor(Date.now() / 1000) - 60 }, E2E.jwtSecret);
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [TOKEN_KEY, expired]);
    await page.getByLabel("Report PDF").setInputFiles({ name: "r.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
    await page.getByRole("button", { name: "Upload report" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Your session expired. Sign in again to continue.")).toBeVisible();
  });
});

