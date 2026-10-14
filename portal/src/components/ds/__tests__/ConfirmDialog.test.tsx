import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog, type ConfirmDialogProps } from "../ConfirmDialog";

function Harness(props: Partial<ConfirmDialogProps> & Pick<ConfirmDialogProps, "onConfirm">) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <p data-testid="state">{open ? "open" : "closed"}</p>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Revoke this key?"
        subject="Production web (pb_live_a1b2)"
        description="Apps using it will get 401 errors right away."
        confirmLabel="Revoke key"
        {...props}
      />
    </>
  );
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ConfirmDialog", () => {
  it("names the exact thing being acted on", () => {
    render(<Harness onConfirm={vi.fn()} />);
    const dialog = screen.getByRole("alertdialog", { name: "Revoke this key?" });
    expect(dialog).toHaveTextContent("Production web (pb_live_a1b2)");
    expect(dialog).toHaveTextContent("Apps using it will get 401 errors right away.");
  });

  it("shows pending, blocks closing, then closes when the promise resolves", async () => {
    const user = userEvent.setup();
    const request = deferred();
    render(<Harness onConfirm={() => request.promise} />);

    await user.click(screen.getByRole("button", { name: "Revoke key" }));
    const confirm = screen.getByRole("button", { name: "Revoke key" });
    expect(confirm).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await user.keyboard("{Escape}");
    expect(screen.getByTestId("state")).toHaveTextContent("open");

    request.resolve();
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("closed"));
  });

  it("stays open and shows the error when the promise rejects", async () => {
    const user = userEvent.setup();
    render(<Harness onConfirm={() => Promise.reject(new Error("Key not found"))} />);

    await user.click(screen.getByRole("button", { name: "Revoke key" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Key not found");
    expect(screen.getByTestId("state")).toHaveTextContent("open");
    expect(screen.getByRole("button", { name: "Revoke key" })).not.toHaveAttribute("aria-busy");
  });

  it("accepts pending and error driven by the caller", () => {
    render(<Harness onConfirm={vi.fn()} pending error="Network unreachable" />);
    expect(screen.getByRole("button", { name: "Revoke key" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Network unreachable");
  });

  it("puts initial focus on Cancel so Enter never confirms by accident", async () => {
    render(<Harness onConfirm={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });
});
