import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Field } from "../Field";
import { Select } from "../Select";

const tiers = [
  { value: "secret", label: "Secret key" },
  { value: "publishable", label: "Publishable key" },
  { value: "legacy", label: "Legacy key", disabled: true },
];

describe("Select", () => {
  it("opens, moves and selects with the keyboard alone", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Field label="Key type">
        <Select options={tiers} onValueChange={onValueChange} placeholder="Choose a type" />
      </Field>,
    );

    const trigger = screen.getByRole("combobox", { name: "Key type" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("publishable");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("Publishable key");
  });

  it("skips disabled options", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Select aria-label="Key type" options={tiers} defaultValue="publishable" onValueChange={onValueChange} />);

    screen.getByRole("combobox", { name: "Key type" }).focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onValueChange).not.toHaveBeenCalledWith("legacy");
  });
});
