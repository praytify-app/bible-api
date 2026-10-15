import {
  Link,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyRound } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Button } from "../Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../DropdownMenu";

function AccountMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">Account</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild icon={<KeyRound />}>
          <Link to="/dashboard/keys">API keys</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/dashboard/usage">Usage</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// A minimal router with the app's real paths, so Link renders real hrefs.
function renderWithRouter() {
  const root = createRootRoute({ component: AccountMenu });
  const routeTree = root.addChildren([
    createRoute({ getParentRoute: () => root, path: "/dashboard/keys" }),
    createRoute({ getParentRoute: () => root, path: "/dashboard/usage" }),
  ]);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/"] }) });
  render(<RouterProvider router={router} />);
  return router;
}

describe("DropdownMenuItem asChild", () => {
  it("renders TanStack Links as menu items with real hrefs, with or without an icon", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(await screen.findByRole("button", { name: "Account" }));
    const menu = await screen.findByRole("menu");
    const [keys, usage] = within(menu).getAllByRole("menuitem");

    expect(keys.tagName).toBe("A");
    expect(keys).toHaveAttribute("href", "/dashboard/keys");
    expect(keys).toHaveAccessibleName("API keys");
    expect(keys.querySelector("svg")).not.toBeNull();

    expect(usage.tagName).toBe("A");
    expect(usage).toHaveAttribute("href", "/dashboard/usage");
    expect(usage.querySelector("svg")).toBeNull();
  });

  it("navigates when an item is chosen with the keyboard", async () => {
    const user = userEvent.setup();
    const router = renderWithRouter();

    (await screen.findByRole("button", { name: "Account" })).focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard/usage"));
  });
});
