import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Field } from "../Field";
import { SearchSelect } from "../SearchSelect";

const versions = [
  { value: "WEB", label: "World English Bible", description: "English" },
  { value: "LSG", label: "Louis Segond", description: "Français", keywords: "genèse" },
  { value: "RVR", label: "Reina-Valera", description: "Español" },
  ...Array.from({ length: 1285 }, (_, i) => ({ value: `V${i}`, label: `Version ${i}`, description: "Test" })),
];

describe("SearchSelect", () => {
  it("names the trigger with the label and the current value", () => {
    render(
      <Field label="Version">
        <SearchSelect options={versions} value="WEB" onValueChange={vi.fn()} />
      </Field>,
    );
    expect(screen.getByRole("button", { name: "Version World English Bible" })).toBeInTheDocument();
  });

  it("caps rendered rows and says how many match", async () => {
    const user = userEvent.setup();
    render(<SearchSelect aria-label="Version" options={versions} value={null} onValueChange={vi.fn()} maxResults={50} />);

    await user.click(screen.getByRole("button", { name: /Version/ }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(50);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 50 of 1,288. Keep typing to narrow the list.");
  });

  it("filters without regard to case or accents and selects with Enter", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SearchSelect aria-label="Version" options={versions} value={null} onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: /Version/ }));
    await user.keyboard("FRANCAIS");
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("1 result");

    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("LSG");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("tracks the active option for screen readers as arrows move", async () => {
    const user = userEvent.setup();
    render(<SearchSelect aria-label="Version" options={versions} value={null} onValueChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Version/ }));
    const input = screen.getByRole("combobox", { name: "Search" });
    await user.keyboard("{ArrowDown}{ArrowDown}");
    const activeId = input.getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();
    expect(document.getElementById(activeId!)).toHaveTextContent("Reina-Valera");
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    render(<SearchSelect aria-label="Version" options={versions} value={null} onValueChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Version/ }));
    await user.keyboard("zzzz");
    expect(screen.getByRole("status")).toHaveTextContent("Nothing matches that search.");
  });
});
