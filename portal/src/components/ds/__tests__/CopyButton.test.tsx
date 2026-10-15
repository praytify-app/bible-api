import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "../CopyButton";

// user-event installs its own clipboard stub in setup(), so spy after it.
function setup() {
  const user = userEvent.setup();
  return { user, writeText: vi.spyOn(navigator.clipboard, "writeText") };
}

describe("CopyButton", () => {
  afterEach(() => vi.useRealTimers());

  it("reports success only after the clipboard write resolves", async () => {
    const { user, writeText } = setup();
    writeText.mockResolvedValue(undefined);
    const onCopied = vi.fn();
    render(<CopyButton value="pb_live_secret" label="Copy API key" onCopied={onCopied} />);

    await user.click(screen.getByRole("button", { name: "Copy API key" }));

    expect(writeText).toHaveBeenCalledWith("pb_live_secret");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Copied to clipboard");
    expect(onCopied).toHaveBeenCalledOnce();
  });

  it("shows a visible and announced failure when the write rejects", async () => {
    const { user, writeText } = setup();
    writeText.mockRejectedValue(new DOMException("Document is not focused", "NotAllowedError"));
    const onFailed = vi.fn();
    render(<CopyButton value="pb_live_secret" onFailed={onFailed} />);

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(screen.getByRole("button", { name: "Copy failed" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Copy failed. Select the text and copy it manually.");
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
    expect(onFailed).toHaveBeenCalledOnce();
  });

  it("fails honestly when the Clipboard API is missing (insecure context)", async () => {
    const user = userEvent.setup();
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    try {
      render(<CopyButton value="x" display="icon" label="Copy key" />);
      await user.click(screen.getByRole("button", { name: "Copy key" }));
      expect(screen.getByText("Copy failed")).toBeInTheDocument();
    } finally {
      if (original) Object.defineProperty(navigator, "clipboard", original);
    }
  });

  it("reads a function value at click time and resets after a delay", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    let current = "first";
    render(<CopyButton value={() => current} />);
    current = "second";

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("second");

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });
});
