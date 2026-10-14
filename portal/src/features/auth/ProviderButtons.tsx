import { useState } from "react";
import { Alert, Button } from "@/components/ds";
import { signIn } from "@/lib/auth";
import googleMark from "./google-g.svg";

type Provider = "github" | "google";

const labels: Record<Provider, string> = { github: "Continue with GitHub", google: "Continue with Google" };

// GitHub's mark is single-colour, so it follows the text colour in both themes.
function GitHubMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

// Google's "G" must keep its four brand colours, so it ships as an asset rather than themed markup.
function GoogleMark() {
  return <img src={googleMark} alt="" className="size-4" />;
}

export interface ProviderButtonsProps {
  github: boolean;
  google: boolean;
  /** Absolute URL on the portal's own origin (must-not-regress 2). */
  callbackURL: string;
}

export function ProviderButtons({ github, google, callbackURL }: ProviderButtonsProps) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(provider: Provider) {
    setPending(provider);
    setError(null);
    try {
      // On success the browser leaves for the provider, so pending stays on until it does.
      const result = await signIn.social({ provider, callbackURL });
      if (result.error) {
        setError(result.error.message || `${labels[provider]} is unavailable right now.`);
        setPending(null);
      }
    } catch {
      setError("We could not reach the sign-in service. Check your connection and try again.");
      setPending(null);
    }
  }

  const providers = (["github", "google"] as const).filter((p) => (p === "github" ? github : google));

  return (
    <div className="flex flex-col gap-3">
      {providers.map((provider) => (
        <Button
          key={provider}
          variant="secondary"
          size="lg"
          className="w-full"
          loading={pending === provider}
          disabled={pending !== null && pending !== provider}
          leadingIcon={provider === "github" ? <GitHubMark /> : <GoogleMark />}
          onClick={() => start(provider)}
        >
          {labels[provider]}
        </Button>
      ))}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
