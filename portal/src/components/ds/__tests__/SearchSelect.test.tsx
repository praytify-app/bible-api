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

describe("SearchSelect with server-side search", () => {
  it("reports each query and shows the caller's results unfiltered", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const serverResults = [{ value: "KJV", label: "King James Version", description: "English" }];
    render(
      <SearchSelect
        aria-label="Version"
        options={serverResults}
        value={null}
        onValueChange={vi.fn()}
        onQueryChange={onQueryChange}
        filterOptions={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Version/ }));
    await user.keyboard("kj");
    expect(onQueryChange).toHaveBeenLastCalledWith("kj");
    // "kj" does not appear in "King James Version", but the server matched it.
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(1);
  });

  it("announces a search in progress", async () => {
    const user = userEvent.setup();
    render(<SearchSelect aria-label="Version" options={[]} value={null} onValueChange={vi.fn()} filterOptions={false} loading />);
    await user.click(screen.getByRole("button", { name: /Version/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Searching…");
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-busy", "true");
  });
});

describe("SearchSelect resets the search when it closes", () => {
  const results = [{ value: "KJV", label: "King James Version" }];

  it("tells a server-mode caller to clear its results after Escape, and reopens empty", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <SearchSelect
        aria-label="Version"
        options={results}
        value={null}
        onValueChange={vi.fn()}
        onQueryChange={onQueryChange}
        filterOptions={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Version/ }));
    await user.keyboard("kj{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onQueryChange).toHaveBeenLastCalledWith("");

    await user.click(screen.getByRole("button", { name: /Version/ }));
    expect(screen.getByRole("combobox", { name: "Search" })).toHaveValue("");
  });

  it("also clears after a choice", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <SearchSelect
        aria-label="Version"
        options={results}
        value={null}
        onValueChange={vi.fn()}
        onQueryChange={onQueryChange}
        filterOptions={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Version/ }));
    await user.keyboard("king{Enter}");
    expect(onQueryChange).toHaveBeenLastCalledWith("");
  });

  it("does not call onQueryChange when there was no search to clear", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(<SearchSelect aria-label="Version" options={results} value={null} onValueChange={vi.fn()} onQueryChange={onQueryChange} />);
    await user.click(screen.getByRole("button", { name: /Version/ }));
    await user.keyboard("{Escape}");
    expect(onQueryChange).not.toHaveBeenCalled();
  });
});

describe("SearchSelect selectedLabel", () => {
  it("names the trigger even when the selected option is not in the current results", () => {
    render(
      <Field label="Version">
        <SearchSelect
          options={[{ value: "KJV", label: "King James Version" }]}
          value="WEB"
          selectedLabel="World English Bible"
          onValueChange={vi.fn()}
          filterOptions={false}
        />
      </Field>,
    );
    expect(screen.getByRole("button", { name: "Version World English Bible" })).toBeInTheDocument();
  });
});

describe("SearchSelect onOpenChange and bidirectional text", () => {
  const catalog = [
    { value: "SVD", label: "الكتاب المقدس (SVD)", description: "العربية" },
    { value: "WEB", label: "World English Bible", description: "English" },
  ];

  it("reports opening and every way of closing", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<SearchSelect aria-label="Version" options={catalog} value={null} onValueChange={vi.fn()} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: /Version/ }));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByRole("button", { name: /Version/ }));
    await user.keyboard("{Enter}");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(onOpenChange).toHaveBeenCalledTimes(4);
  });

  it("lets each name and the search box choose their own direction", async () => {
    const user = userEvent.setup();
    render(<SearchSelect aria-label="Version" options={catalog} value="SVD" onValueChange={vi.fn()} />);
    expect(screen.getByText("الكتاب المقدس (SVD)")).toHaveAttribute("dir", "auto");

    await user.click(screen.getByRole("button", { name: /Version/ }));
    expect(screen.getByRole("combobox", { name: "Search" })).toHaveAttribute("dir", "auto");
    const option = within(screen.getByRole("listbox")).getAllByRole("option")[0];
    expect(within(option).getByText("الكتاب المقدس (SVD)")).toHaveAttribute("dir", "auto");
    expect(within(option).getByText("العربية")).toHaveAttribute("dir", "auto");
  });
});
