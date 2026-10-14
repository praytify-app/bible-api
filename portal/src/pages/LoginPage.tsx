import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Alert, Button, Card, PageHeader, SkeletonText, Spinner } from "@/components/ds";
import { EmailPasswordForm, type AuthMode } from "@/features/auth/EmailPasswordForm";
import { ProviderButtons } from "@/features/auth/ProviderButtons";
import { safeReturnPath } from "@/features/auth/redirect";
import { authMethods } from "@/lib/api";
import { useSession } from "@/lib/auth";

export function LoginPage() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const search: Record<string, unknown> = useSearch({ strict: false });
  const returnPath = safeReturnPath(search.redirect);
  const [mode, setMode] = useState<AuthMode>("sign-in");

  const methods = useQuery({
    queryKey: ["auth-methods"],
    queryFn: authMethods.get,
    // The gateway caches this for five minutes; it only changes when the operator redeploys.
    staleTime: 5 * 60_000,
  });

  // Signed-in visitors never see the form (must-not-regress 2).
  useEffect(() => {
    if (session?.user) navigate({ href: returnPath, replace: true });
  }, [session, navigate, returnPath]);

  if (session?.user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Opening your dashboard" />
      </div>
    );
  }

  // Built from the portal's origin, never the API's: the provider returns the browser here.
  const callbackURL = `${window.location.origin}${returnPath}`;
  const m = methods.data;
  const hasOAuth = Boolean(m?.github || m?.google);
  const noneConfigured = m && !m.github && !m.google && !m.emailPassword;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-12 sm:py-16">
      <PageHeader
        title={mode === "sign-up" ? "Create an account" : "Sign in"}
        serifLine={mode === "sign-up" ? "for your API keys" : "to your dashboard"}
        description="Reading needs no account. An account gives you API keys for search and downloads, and a quota of your own."
      />

      <Card padding="lg" aria-busy={methods.isPending || undefined}>
        {methods.isError ? (
          <Alert
            tone="danger"
            title="We could not load the sign-in options."
            action={
              <Button variant="secondary" size="sm" loading={methods.isFetching} onClick={() => methods.refetch()}>
                Try again
              </Button>
            }
          >
            The API may be unreachable. Check your connection, then try again.
          </Alert>
        ) : methods.isPending ? (
          <div className="flex flex-col gap-4">
            <SkeletonText lines={4} />
            <p className="sr-only">Loading sign-in options</p>
          </div>
        ) : noneConfigured ? (
          <Alert tone="warning" role="none" title="Sign-in is not configured on this server.">
            Nobody can sign in until the operator enables a method. If you run this server, set GitHub or Google OAuth
            credentials, or <code className="font-mono">EMAIL_PASSWORD_AUTH=true</code>, then restart the gateway.
          </Alert>
        ) : (
          <div className="flex flex-col gap-6">
            {hasOAuth && <ProviderButtons github={m!.github} google={m!.google} callbackURL={callbackURL} />}
            {hasOAuth && m!.emailPassword && (
              <div className="flex items-center gap-3 text-caption text-ink-muted" role="separator" aria-label="or">
                <span className="h-px flex-1 bg-hairline" />
                <span aria-hidden>or</span>
                <span className="h-px flex-1 bg-hairline" />
              </div>
            )}
            {m!.emailPassword && (
              <EmailPasswordForm
                mode={mode}
                onModeChange={setMode}
                onSignedIn={() => navigate({ href: returnPath, replace: true })}
              />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
