import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Dialog, DialogContent } from "../Dialog";
import { Field, Input } from "../Field";

describe("DialogContent", () => {
  it("is named by its title and starts focus on the first field, not Close", async () => {
    render(
      <Dialog open>
        <DialogContent title="Create an API key" description="Choose secret or publishable.">
          <Field label="Key name">
            <Input />
          </Field>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole("dialog", { name: "Create an API key" })).toHaveAccessibleDescription(
      "Choose secret or publishable.",
    );
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Key name" })).toHaveFocus());
  });

  it("closes with Escape and with the labelled Close button", async () => {
    const user = userEvent.setup();
    function Harness() {
      return (
        <Dialog defaultOpen>
          <DialogContent title="Rename key">body</DialogContent>
        </Dialog>
      );
    }
    const { unmount } = render(<Harness />);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();

    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
