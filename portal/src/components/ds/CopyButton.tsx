import { Check, Copy, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { writeClipboard } from "./clipboard";
import { cx } from "./cx";
import { IconButton } from "./IconButton";

type CopyState = "idle" | "copied" | "failed";

export interface CopyButtonProps {
  /** Text to copy, or a function read at click time. */
  value: string | (() => string);
  /** Visible label (button) or accessible name (icon): "Copy", "Copy API key". */
  label?: string;
  copiedLabel?: string;
  failedLabel?: string;
  display?: "button" | "icon";
  size?: "sm" | "md";
  variant?: "secondary" | "ghost" | "primary";
  onCopied?: () => void;
  onFailed?: (error: unknown) => void;
  className?: string;
}

const RESET_AFTER: Record<Exclude<CopyState, "idle">, number> = { copied: 2000, failed: 5000 };

/**
 * Reports success only when the Clipboard API confirms the write. Anything else
 * (insecure context, denied permission, unfocused page) shows a failure the
 * person can act on, visibly and through a live region.
 */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  failedLabel = "Copy failed",
  display = "button",
  size = "sm",
  variant = "secondary",
  onCopied,
  onFailed,
  className,
}: CopyButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function handleClick() {
    window.clearTimeout(timer.current);
    let next: Exclude<CopyState, "idle">;
    try {
      await writeClipboard(typeof value === "function" ? value() : value);
      next = "copied";
      onCopied?.();
    } catch (error) {
      next = "failed";
      onFailed?.(error);
    }
    setState(next);
    timer.current = window.setTimeout(() => setState("idle"), RESET_AFTER[next]);
  }

  const icon = state === "copied" ? <Check /> : state === "failed" ? <TriangleAlert /> : <Copy />;
  const announcement =
    state === "copied"
      ? "Copied to clipboard"
      : state === "failed"
        ? "Copy failed. Select the text and copy it manually."
        : "";

  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      {display === "icon" ? (
        <>
          {state !== "idle" && (
            <span aria-hidden className={cx("text-caption font-semibold", state === "copied" ? "text-success" : "text-danger")}>
              {state === "copied" ? copiedLabel : failedLabel}
            </span>
          )}
          <IconButton
            label={label}
            icon={icon}
            size={size}
            variant={variant}
            onClick={handleClick}
            className={cx(state === "copied" && "text-success", state === "failed" && "text-danger")}
          />
        </>
      ) : (
        <Button
          variant={variant}
          size={size}
          leadingIcon={icon}
          onClick={handleClick}
          className={cx(state === "copied" && "text-success", state === "failed" && "text-danger")}
        >
          {state === "copied" ? copiedLabel : state === "failed" ? failedLabel : label}
        </Button>
      )}
      {/* Outside the button so the announcement never becomes part of its name. */}
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </span>
  );
}
