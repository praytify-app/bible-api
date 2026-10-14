import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";

export const API_URL = process.env.E2E_API_URL ?? "http://localhost:3200";

export type Theme = "light" | "dark";

/** Force a theme before the app boots (the no-flash script reads pb-theme). */
export async function useTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("pb-theme", t);
    } catch {
      /* storage blocked: the app falls back to the OS preference */
    }
  }, theme);
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
