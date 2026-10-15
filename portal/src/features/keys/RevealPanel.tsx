import { KeyRound } from "lucide-react";
import { useId, type Ref } from "react";
import { Alert, Badge, Button, Card, CodeBlock, CopyButton } from "@/components/ds";
import { API_URL } from "@/lib/api";
import { KIND_INFO, kindOf, usageSnippets } from "./kinds";
import type { Revealed } from "./queries";

export interface RevealPanelProps {
  revealed: Revealed;
  onDismiss: () => void;
  /** The heading takes focus when the panel appears (the page moves it here). */
  headingRef?: Ref<HTMLHeadingElement>;
}

/**
 * The only place the full key ever appears. It lives in the page's state and is
 * gone when this panel is dismissed or the page unmounts: never in the query
 * cache, storage, or a toast (AUDIT must-not-regress 4).
 */
export function RevealPanel({ revealed, onDismiss, headingRef }: RevealPanelProps) {
  const headingId = useId();
  const { meta, secret, reason, replacedPrefix } = revealed;
  const kind = kindOf(meta);
  const info = KIND_INFO[kind];
  const origins = meta.allowedOrigins ?? [];

  return (
    <Card as="section" aria-labelledby={headingId} padding="lg" className="flex flex-col gap-5 border-accent">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={info.badgeTone}>{info.label}</Badge>
          <span className="text-body-sm text-ink-secondary">{meta.name}</span>
        </div>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-h3 font-semibold text-ink">
          {reason === "rolled" ? "Your replacement key is ready" : "Your new key is ready"}
        </h2>
      </div>

      <Alert tone="warning" role="none" title="Copy it now. It will not be shown again.">
        We store only a hash of the key, so nobody can show it to you later.
        {kind === "secret" ? " Put it in a secrets manager or an environment variable, never in client code." : null}
        {reason === "rolled" && replacedPrefix ? (
          <>
            {" "}
            The old key <span className="font-mono">{replacedPrefix}</span> has stopped working.
          </>
        ) : null}
      </Alert>

      <div className="flex flex-col gap-2">
        <span className="text-body-sm font-semibold text-ink">API key</span>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Selectable text beside the button, so a failed clipboard write is still recoverable. */}
          <code
            data-testid="revealed-key"
            className="min-w-0 flex-1 select-all break-all rounded-input bg-surface-sunken px-3.5 py-3 font-mono text-body-sm text-ink"
          >
            {secret}
          </code>
          <CopyButton value={secret} label="Copy key" copiedLabel="Key copied" variant="primary" size="md" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-h4 font-semibold text-ink">Use it</h3>
        {kind === "publishable" && (
          <p className="text-body-sm text-ink-secondary">
            Works only from a browser on{" "}
            {origins.length > 0 ? origins.map((o, i) => (
              <span key={o}>
                {i > 0 ? ", " : null}
                <span className="font-mono">{o}</span>
              </span>
            )) : "an allowed origin"}
            . The gateway checks the page's <span className="font-mono">Origin</span> header and answers any other site
            with 403.
          </p>
        )}
        <CodeBlock tabs={usageSnippets(kind, secret, API_URL, origins)} />
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-caption text-ink-muted">
          <KeyRound aria-hidden className="mt-px size-4 shrink-0" />
          <span>
            The list shows only the prefix <span className="font-mono">{meta.prefix}</span> from now on.
          </span>
        </p>
        <Button variant="secondary" onClick={onDismiss}>
          I have stored it, hide the key
        </Button>
      </div>
    </Card>
  );
}
