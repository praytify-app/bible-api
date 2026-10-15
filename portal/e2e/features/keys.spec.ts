import type { Locator, Page } from "@playwright/test";
import { API_URL, clipboardReader, expect, expectAccessible, signUp, test, useTheme, type Theme } from "../support/fixtures";

// The key manager end to end against the real local gateway: a key made in the
// UI must work against /v1, show its use in the list, and stop working the
// moment it is rolled or revoked. Each test signs up a fresh account.

const SEARCH = `${API_URL}/v1/search?q=love&version=WEB`;

async function callSearch(page: Page, key: string, origin?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (origin) headers.Origin = origin;
  return page.request.get(SEARCH, { headers });
}

async function openKeys(page: Page) {
  await page.goto("/dashboard/keys");
  await expect(page.getByRole("heading", { level: 1, name: /API keys/ })).toBeVisible();
}

interface NewKey {
  kind: "Secret" | "Publishable";
  name: string;
  origins?: string[];
  expiry?: "In 30 days" | "In 90 days" | "In 365 days";
}

/** The kind radios are visually hidden inside cards; click the card, as a person would. */
async function chooseKind(dialog: Locator, kind: "Secret" | "Publishable") {
  const radio = dialog.getByRole("radio", { name: new RegExp(`^${kind}`) });
  await radio.locator("xpath=..").click();
  await expect(radio).toBeChecked();
}

/** Create through the dialog and return the key from the one-time reveal panel. */
async function createKey(page: Page, { kind, name, origins = [], expiry }: NewKey): Promise<string> {
  await page.getByRole("button", { name: /^Create (key|your first key)$/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "Create an API key" });
  await dialog.getByRole("textbox", { name: "Name" }).fill(name);
  await chooseKind(dialog, kind);
  for (const [i, origin] of origins.entries()) {
    if (i > 0) await dialog.getByRole("button", { name: "Add origin" }).click();
    await dialog.getByRole("textbox", { name: `Allowed origin ${i + 1}` }).fill(origin);
  }
  if (expiry) {
    await dialog.getByRole("combobox", { name: "Expires" }).click();
    await page.getByRole("option", { name: expiry }).click();
  }
  await dialog.getByRole("button", { name: "Create key" }).click();
  await expect(dialog).toBeHidden();

  const panel = page.getByRole("region", { name: "Your new key is ready" });
  await expect(panel).toBeVisible();
  // Focus moves to the new key so keyboard and screen reader users land on it.
  await expect(panel.getByRole("heading", { name: "Your new key is ready" })).toBeFocused();
  const key = (await panel.getByTestId("revealed-key").textContent())?.trim() ?? "";
  expect(key).toMatch(kind === "Secret" ? /^pb_sk_/ : /^pb_pk_/);
  return key;
}

async function dismissReveal(page: Page, key: string) {
  await page.getByRole("button", { name: "I have stored it, hide the key" }).click();
  await expect(page.getByTestId("revealed-key")).toHaveCount(0);
  await expect(page.getByText(key)).toHaveCount(0);
}

function rowFor(page: Page, name: string): Locator {
  return page.locator("tbody tr", { hasText: name });
}

async function rowAction(page: Page, name: string, action: RegExp) {
  await rowFor(page, name).getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: action }).click();
}

test.describe("key manager", () => {
  test("secret key: create, copy, use, last used, roll, revoke", async ({ page, baseURL, browserName }) => {
    const readClipboard = await clipboardReader(page, browserName, baseURL!);
    await signUp(page, baseURL!);
    await openKeys(page);
    await expect(page.getByText("No API keys yet")).toBeVisible();

    const name = "E2E server";
    const key = await createKey(page, { kind: "Secret", name });

    // Honest copy: the label changes only after the clipboard write resolves.
    await page.getByRole("button", { name: "Copy key" }).click();
    await expect(page.getByRole("button", { name: "Key copied" })).toBeVisible();
    expect(await readClipboard()).toBe(key);

    // Show-once (AUDIT must-not-regress 4): never in storage, gone after dismissal.
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(stored).not.toContain(key);
    await dismissReveal(page, key);

    const row = rowFor(page, name);
    await expect(row.getByText("Secret", { exact: true })).toBeVisible();
    await expect(row.getByText(key.slice(0, 12))).toBeVisible();
    await expect(row.getByTestId("last-used")).toHaveText("Never");

    expect((await callSearch(page, key)).status()).toBe(200);

    // The gateway writes last_used_at asynchronously (at most once a minute per key).
    await expect(async () => {
      await page.reload();
      await expect(rowFor(page, name).getByTestId("last-used")).not.toHaveText("Never", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    // Roll: confirmation names the key, then a replacement is revealed and the old key dies at once.
    await rowAction(page, name, /^Roll key$/);
    const confirm = page.getByRole("alertdialog", { name: "Roll this key?" });
    await expect(confirm).toContainText(name);
    await expect(confirm).toContainText(key.slice(0, 12));
    await expect(confirm).toContainText("stops working immediately");
    await confirm.getByRole("button", { name: "Roll key" }).click();
    await expect(confirm).toBeHidden();

    const replaced = page.getByRole("region", { name: "Your replacement key is ready" });
    await expect(replaced).toBeVisible();
    await expect(replaced.getByRole("heading", { name: "Your replacement key is ready" })).toBeFocused();
    const rolled = (await replaced.getByTestId("revealed-key").textContent())?.trim() ?? "";
    expect(rolled).toMatch(/^pb_sk_/);
    expect(rolled).not.toBe(key);

    expect((await callSearch(page, key)).status()).toBe(401);
    expect((await callSearch(page, rolled)).status()).toBe(200);
    await dismissReveal(page, rolled);
    await expect(rowFor(page, name)).toHaveCount(1);

    // Revoke: named confirmation, then the row is gone, also after a reload.
    await rowAction(page, name, /^Revoke key$/);
    const revoke = page.getByRole("alertdialog", { name: "Revoke this key?" });
    await expect(revoke).toContainText(name);
    await expect(revoke).toContainText(rolled.slice(0, 12));
    await revoke.getByRole("button", { name: "Revoke key" }).click();
    await expect(revoke).toBeHidden();
    await expect(rowFor(page, name)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Active keys" })).toBeFocused();

    await page.reload();
    await expect(page.getByText("No API keys yet")).toBeVisible();
    expect((await callSearch(page, rolled)).status()).toBe(401);
  });

  test("publishable key: origin allowlist is enforced and a rename survives reload", async ({ page, baseURL }) => {
    await signUp(page, baseURL!);
    await openKeys(page);

    const allowed = new URL(baseURL!).origin; // http://localhost:5199 by default
    const name = "E2E website";

    // Client validation matches the gateway: a path is rejected in place, before any request.
    await page.getByRole("button", { name: /^Create (key|your first key)$/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Create an API key" });
    await chooseKind(dialog, "Publishable");
    await dialog.getByRole("textbox", { name: "Allowed origin 1" }).fill("https://example.org/path");
    await dialog.getByRole("button", { name: "Create key" }).click();
    await expect(dialog.getByText(/scheme and host only/)).toBeVisible();
    // Plain http on a real host is allowed but flagged.
    await dialog.getByRole("textbox", { name: "Allowed origin 1" }).fill("http://church.example.org");
    await expect(dialog.getByText(/Plain http is unencrypted/)).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    const key = await createKey(page, { kind: "Publishable", name, origins: [allowed] });
    await expect(page.getByRole("region", { name: "Your new key is ready" })).toContainText(allowed);
    await dismissReveal(page, key);
    await expect(rowFor(page, name)).toContainText(allowed);

    expect((await callSearch(page, key, allowed)).status()).toBe(200);
    const evil = await callSearch(page, key, "https://evil.example");
    expect(evil.status()).toBe(403);
    expect((await evil.json()).error.code).toBe("ORIGIN_NOT_ALLOWED");

    // Rename, then confirm the server kept it.
    await rowAction(page, name, /^Rename or edit origins$/);
    const edit = page.getByRole("dialog", { name: "Edit key" });
    await edit.getByRole("textbox", { name: "Name" }).fill("E2E website renamed");
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(edit).toBeHidden();
    await expect(rowFor(page, "E2E website renamed")).toHaveCount(1);
    await page.reload();
    await expect(rowFor(page, "E2E website renamed")).toContainText(allowed);
  });

  test("expiring key: create with a 30-day lifetime, then roll it", async ({ page, baseURL }) => {
    await signUp(page, baseURL!);
    await openKeys(page);

    const name = "E2E expiring";
    const key = await createKey(page, { kind: "Secret", name, expiry: "In 30 days" });
    await dismissReveal(page, key);
    const expires = rowFor(page, name).getByTestId("expires");
    await expect(expires).not.toHaveText("Never");
    expect((await callSearch(page, key)).status()).toBe(200);

    // A roll keeps the same lifetime, measured from now.
    await rowAction(page, name, /^Roll key$/);
    await page.getByRole("alertdialog", { name: "Roll this key?" }).getByRole("button", { name: "Roll key" }).click();
    await expect(page.getByRole("region", { name: "Your replacement key is ready" })).toBeVisible();
    await expect(rowFor(page, name).getByTestId("expires")).not.toHaveText("Never");
  });

  for (const theme of ["light", "dark"] as Theme[]) {
    test(`keys page, create dialog, and reveal panel pass axe (${theme})`, async ({ page, baseURL }) => {
      await useTheme(page, theme);
      await signUp(page, baseURL!);
      await openKeys(page);
      await expectAccessible(page, `empty keys page, ${theme}`);

      // A blank name is not sent, so the gateway's default ("Untitled key") is the one that shows.
      await createKey(page, { kind: "Publishable", name: "", origins: ["https://example.org"] });
      await expect(rowFor(page, "Untitled key")).toHaveCount(1);
      await expectAccessible(page, `reveal panel and table, ${theme}`);

      await page.getByRole("button", { name: "Create key", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Create an API key" });
      await chooseKind(dialog, "Publishable");
      await expectAccessible(page, `create dialog, ${theme}`);
    });
  }
});
