import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";

export const API_URL = process.env.E2E_API_URL ?? "http://localhost:3200";

export type Theme = "light" | "dark";

/**
 * Force a theme before the app boots (the no-flash script reads pb-theme).
 * Top frame only: Firefox also runs init scripts in a child frame's initial
 * about:blank, which shares the portal's origin, so writing there fired a
 * storage event that the app follows like another tab's theme change.
 */
export async function useTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((t) => {
    if (window !== window.top) return;
    try {
      localStorage.setItem("pb-theme", t);
    } catch {
      /* storage blocked: the app falls back to the OS preference */
    }
  }, theme);
}

/**
 * Read back what the app copied, in every engine. Call before the first
 * navigation. Chromium reads the real clipboard once granted. Firefox reads it
 * without a grant (and rejects clipboard permissions as unknown). WebKit writes
 * for real but never lets a page read the clipboard back, so there an init
 * script wraps navigator.clipboard.writeText: the real write still runs and
 * decides success or failure, and the text is recorded only once it resolves.
 */
export async function clipboardReader(page: Page, browserName: string, origin: string): Promise<() => Promise<string>> {
  if (browserName === "chromium") {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  }
  if (browserName !== "webkit") return () => page.evaluate(() => navigator.clipboard.readText());

  await page.addInitScript(() => {
    const clipboard = navigator.clipboard;
    if (!clipboard?.writeText) return;
    const write = clipboard.writeText.bind(clipboard);
    clipboard.writeText = async (text: string) => {
      await write(text);
      (window as unknown as { __e2eClipboard?: string }).__e2eClipboard = text;
    };
  });
  return () => page.evaluate(() => (window as unknown as { __e2eClipboard?: string }).__e2eClipboard ?? "");
}

/** Fail on serious or critical axe violations, listing each with its targets. */
export async function expectAccessible(page: Page, context = ""): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary, `axe ${context}`).toEqual([]);
}

export interface TestUser {
  email: string;
  password: string;
  name: string;
}

/**
 * Create and sign in a fresh account through the real gateway (email and
 * password sign-in is on in the dev stack). Cookies land in the page's
 * context; cookies ignore ports, so the portal on another localhost port
 * sends them to the API.
 */
export async function signUp(page: Page, baseURL: string): Promise<TestUser> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const user = { email: `e2e-${id}@example.test`, password: `correct horse ${id}`, name: `E2E ${id.slice(-4)}` };
  const res = await page.request.post(`${API_URL}/api/auth/sign-up/email`, {
    data: user,
    headers: { origin: new URL(baseURL).origin },
  });
  expect(res.ok(), `sign-up failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  return user;
}

export const test = base;
export { expect };
