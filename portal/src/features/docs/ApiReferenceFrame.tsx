import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Spinner, cx } from "@/components/ds";
import { apiReference } from "@/lib/api";

/** After this long without a `load` event, say so instead of showing a spinner forever. */
const SLOW_AFTER_MS = 15_000;

export interface ApiReferenceFrameProps {
  src: string;
}

/**
 * An iframe cannot report a dead API (the browser fires `load` on its own
 * error page), so the spec the reference renders is probed alongside it.
 * The frame shows only once both the probe and the frame have succeeded.
 */
export function ApiReferenceFrame({ src }: ApiReferenceFrameProps) {
  const spec = useQuery({
    queryKey: ["api-reference-spec"],
    queryFn: ({ signal }) => apiReference.spec(signal),
    staleTime: 5 * 60_000,
  });
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const ready = loaded && spec.isSuccess;

  useEffect(() => {
    if (ready || spec.isError) return;
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [ready, spec.isError]);

  const openDirect = (
    <Button asChild variant="secondary" size="sm">
      <a href={src} target="_blank" rel="noopener noreferrer">
        Open it in a new tab
      </a>
    </Button>
  );

  if (spec.isError) {
    return (
      <Alert
        tone="danger"
        title="The API reference is unavailable right now."
        action={
          <>
            <Button
              variant="secondary"
              size="sm"
              loading={spec.isFetching}
              onClick={() => {
                setLoaded(false);
                spec.refetch();
              }}
            >
              Try again
            </Button>
            {openDirect}
          </>
        }
      >
        We could not load the API specification, so the reference would be blank. The API may be down or
        unreachable from here.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {slow && !ready && (
        <Alert tone="warning" title="The API reference is taking longer than usual." action={openDirect}>
          The API may be slow or unreachable. You can keep waiting or open the reference directly.
        </Alert>
      )}
      <div
        aria-busy={!ready || undefined}
        className="relative h-[80dvh] min-h-[32rem] overflow-hidden rounded-card border border-hairline bg-surface-raised"
      >
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-raised">
            <Spinner label="Loading the API reference" />
          </div>
        )}
        <iframe
          src={src}
          title="Praytify Bible API reference"
          onLoad={() => setLoaded(true)}
          className={cx("size-full border-0", !ready && "invisible")}
          // Must-not-regress 14: the reference runs third-party code (Scalar), so it stays sandboxed.
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
