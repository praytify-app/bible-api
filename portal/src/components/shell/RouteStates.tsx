import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Button, PageHeader, Spinner } from "@/components/ds";

/** Shown by the router while a lazy page's code loads (after its pending delay). */
export function RoutePending() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size="lg" label="Loading page" />
    </div>
  );
}

export function NotFoundPage({ home = "/" }: { home?: "/" | "/dashboard" }) {
  const inDashboard = home === "/dashboard";
  return (
    <div className="mx-auto max-w-content px-4 py-16 sm:px-6 sm:py-24">
      <PageHeader
        eyebrow="Page not found"
        title="We could not find that page."
        description="The link may be out of date, or the address may have a typo."
        actions={
          <>
            <Button asChild>
              <Link to={home}>{inDashboard ? "Back to the overview" : "Go to the home page"}</Link>
            </Button>
            {!inDashboard && (
              <Button asChild variant="secondary">
                <Link to="/read">Open the reader</Link>
              </Button>
            )}
          </>
        }
      />
    </div>
  );
}

// After a deploy, an open tab can ask for a page chunk that no longer exists.
// Reloading fetches the new build, so say that instead of a generic failure.
// Chrome and Firefox say "dynamically imported module"; Safari says "Importing a module script failed".
const STALE_CHUNK = /dynamically imported module|importing a module script failed/i;

export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const staleBuild = error instanceof Error && STALE_CHUNK.test(error.message);
  return (
    <div className="mx-auto max-w-content px-4 py-16 sm:px-6 sm:py-24">
      <PageHeader
        eyebrow="Something went wrong"
        title={staleBuild ? "This page has been updated." : "This page could not load."}
        description={
          staleBuild
            ? "A newer version of the site is available. Reload to get it."
            : "Try again. If it keeps happening, reload the page."
        }
        actions={
          <>
            {staleBuild ? null : (
              <Button
                onClick={() => {
                  reset();
                  void router.invalidate();
                }}
              >
                Try again
              </Button>
            )}
            <Button variant={staleBuild ? "primary" : "secondary"} onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </>
        }
      />
      {!staleBuild && error instanceof Error && error.message && (
        <details className="mt-8 max-w-measure text-body-sm text-ink-secondary">
          <summary className="cursor-pointer font-medium">Technical details</summary>
          <p className="mt-2 break-words font-mono text-caption">{error.message}</p>
        </details>
      )}
    </div>
  );
}
