import { useEffect, useState, type CSSProperties } from "react";
import { Alert, Button, Spinner } from "@/components/ds";
import { loadWidget } from "./load-widget";
import type { WidgetAttribute, WidgetTag } from "./snippets";

type LoadState = { status: "loading" } | { status: "ready" } | { status: "failed"; message: string };

export interface WidgetPreviewProps {
  tag: WidgetTag;
  attributes: readonly WidgetAttribute[];
  accent: string | null;
}

/**
 * The real custom element, rendered through JSX exactly as the React snippet
 * tells integrators to, so the preview also proves that snippet works.
 */
export function WidgetPreview({ tag, attributes, accent }: WidgetPreviewProps) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    loadWidget().then(
      () => live && setLoad({ status: "ready" }),
      (error: unknown) =>
        live && setLoad({ status: "failed", message: error instanceof Error ? error.message : String(error) }),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  if (load.status === "loading") {
    return (
      <div className="flex items-center gap-2 text-body-sm text-ink-muted">
        <Spinner size="sm" decorative />
        <span role="status">Loading the widget…</span>
      </div>
    );
  }

  if (load.status === "failed") {
    return (
      <Alert
        tone="danger"
        title="The widget did not load"
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setLoad({ status: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        }
      >
        The preview runs the same script your page would. {load.message}
      </Alert>
    );
  }

  const props = {
    ...Object.fromEntries(attributes),
    style: accent ? ({ "--pb-accent": accent } as CSSProperties) : undefined,
  };
  return tag === "praytify-daily" ? <praytify-daily {...props} /> : <praytify-verse {...props} />;
}
