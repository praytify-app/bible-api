import { useEffect, useState } from "react";
import { Alert, Button, Spinner, cx } from "@/components/ds";

/** After this long without a `load` event, say so instead of showing a spinner forever. */
const SLOW_AFTER_MS = 15_000;

export interface ApiReferenceFrameProps {
  src: string;
}

export function ApiReferenceFrame({ src }: ApiReferenceFrameProps) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (loaded) return;
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  return (
    <div className="flex flex-col gap-4">
      {slow && !loaded && (
        <Alert
          tone="warning"
          title="The API reference is taking longer than usual."
          action={
            <Button asChild variant="secondary" size="sm">
              <a href={src} target="_blank" rel="noopener noreferrer">
                Open it in a new tab
              </a>
            </Button>
          }
        >
          The API may be slow or unreachable. You can keep waiting or open the reference directly.
        </Alert>
      )}
      <div
        aria-busy={!loaded || undefined}
        className="relative h-[80dvh] min-h-[32rem] overflow-hidden rounded-card border border-hairline bg-surface-raised"
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-raised">
            <Spinner label="Loading the API reference" />
          </div>
        )}
        <iframe
          src={src}
          title="Praytify Bible API reference"
          onLoad={() => setLoaded(true)}
          className={cx("size-full border-0", !loaded && "invisible")}
          // Must-not-regress 14: the reference runs third-party code (Scalar), so it stays sandboxed.
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
