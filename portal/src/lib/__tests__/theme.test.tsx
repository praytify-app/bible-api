import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, THEME_STORAGE_KEY, resolveTheme, useTheme } from "../theme";

// A controllable prefers-color-scheme query.
function mockSystemTheme(initiallyDark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: initiallyDark,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal("matchMedia", vi.fn(() => query));
  return {
    setDark(dark: boolean) {
      query.matches = dark;
      listeners.forEach((listener) => listener());
    },
  };
}

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <>
      <p data-testid="theme">{theme}</p>
      <p data-testid="resolved">{resolvedTheme}</p>
      <button onClick={() => setTheme("dark")}>Dark</button>
      <button onClick={() => setTheme("light")}>Light</button>
      <button onClick={() => setTheme("system")}>System</button>
    </>
  );
}

const html = () => document.documentElement;

describe("ThemeProvider", () => {
  beforeEach(() => mockSystemTheme(false));
  afterEach(() => vi.restoreAllMocks());

  it("defaults to the device setting", () => {
    mockSystemTheme(true);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(html()).toHaveAttribute("data-theme", "dark");
  });

  it("persists the choice to localStorage under pb-theme and applies it", async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);

    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(html()).toHaveAttribute("data-theme", "dark");
  });

  it("restores a stored choice on load", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(html()).toHaveAttribute("data-theme", "dark");
  });

  it("ignores a corrupted stored value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
  });

  it("follows the device live while set to system, and stops when overridden", async () => {
    const user = userEvent.setup();
    const system = mockSystemTheme(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(html()).toHaveAttribute("data-theme", "light");

    act(() => system.setDark(true));
    expect(html()).toHaveAttribute("data-theme", "dark");

    await user.click(screen.getByRole("button", { name: "Light" }));
    act(() => system.setDark(true));
    expect(html()).toHaveAttribute("data-theme", "light");
  });

  it("keeps working when storage throws (private mode, blocked site data)", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "QuotaExceededError");
    });

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(html()).toHaveAttribute("data-theme", "dark");
  });

  it("follows a change made in another tab", () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" }));
    });
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("throws a clear error outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow("useTheme must be used inside <ThemeProvider>");
  });
});

describe("resolveTheme", () => {
  it("maps system to the device and leaves explicit choices alone", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
