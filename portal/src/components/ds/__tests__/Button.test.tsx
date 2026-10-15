import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../Button";
import { IconButton } from "../IconButton";

describe("Button", () => {
  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("ignores clicks while loading but stays focusable", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Create key
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Create key" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders its child with button styling when asChild", () => {
    render(
      <Button asChild variant="secondary">
        <a href="/docs">Read the docs</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Read the docs" });
    expect(link).not.toHaveAttribute("type");
    expect(link.className).toContain("rounded-pill");
  });
});

describe("IconButton", () => {
  it("is named by its required label", () => {
    render(<IconButton label="Dismiss" icon={<svg />} />);
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });
});
