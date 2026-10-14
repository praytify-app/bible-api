import { API_URL, expect, expectAccessible, signUp, test } from "../support/fixtures";

test("a developer can download their data and delete their account", async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const user = await signUp(page, baseURL!);
  const created = await page.request.post(`${API_URL}/api/dashboard/keys`, {
    data: { name: "Doomed key" },
    headers: { origin },
  });
  expect(created.ok()).toBeTruthy();
  const key = (await created.json()).key.key as string;

  await page.goto("/dashboard/settings");
  const section = page.getByRole("region", { name: "Your data" });
  await expect(section).toBeVisible();
  await expectAccessible(page, "settings with data rights");

  // Export: a real file, with the account's data and none of its secrets.
  const downloading = page.waitForEvent("download");
  await section.getByRole("button", { name: "Download my data" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^praytify-bible-account-\d{4}-\d{2}-\d{2}\.json$/);
  const chunks: Buffer[] = [];
  for await (const chunk of (await download.createReadStream())!) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  const data = JSON.parse(text);
  expect(data.user.email).toBe(user.email);
  expect(data.apiKeys.map((k: { name: string }) => k.name)).toContain("Doomed key");
  expect(text).not.toContain(key);
  await expect(section.getByText("Your data file has been downloaded.")).toBeVisible();

  // Deletion needs the exact email.
  await section.getByRole("button", { name: "Delete account" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Type your account email to confirm").fill("someone-else@example.test");
  await dialog.getByRole("button", { name: "Delete account" }).click();
  await expect(dialog.getByText("Type your account email exactly to confirm.")).toBeVisible();

  await dialog.getByLabel("Type your account email to confirm").fill(user.email.toUpperCase());
  await dialog.getByRole("button", { name: "Delete account" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  // The key and the session are gone at once.
  const keyed = await page.request.get(`${API_URL}/v1/search?q=love&version=WEB`, { headers: { authorization: `Bearer ${key}` } });
  expect(keyed.status()).toBe(401);
  const session = await page.request.get(`${API_URL}/api/dashboard/keys`, { headers: { origin } });
  expect(session.status()).toBe(401);
});
