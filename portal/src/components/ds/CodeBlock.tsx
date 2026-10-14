import { Tabs as RadixTabs } from "radix-ui";
import { useState } from "react";
import { CopyButton } from "./CopyButton";
import { cx } from "./cx";

export interface CodeSnippet {
  /** Tab name: "cURL", "JavaScript". */
  label: string;
  /** Language id for the reader ("bash", "ts"). Shown as a label; there is no highlighting. */
  language: string;
  code: string;
}

export type CodeBlockProps = { className?: string } & (
  | { tabs: CodeSnippet[]; code?: never; language?: never; label?: never }
  | { code: string; language: string; label?: string; tabs?: never }
);

function CodePane({ snippet }: { snippet: CodeSnippet }) {
  // A focusable, named region: long lines scroll horizontally and keyboard users can reach them.
  return (
    <div role="region" aria-label={`${snippet.label} example`} tabIndex={0} className="overflow-x-auto">
      <pre className="min-w-fit p-4 font-mono text-body-sm leading-relaxed text-ink">
        <code>{snippet.code}</code>
      </pre>
    </div>
  );
}

export function CodeBlock(props: CodeBlockProps) {
  const snippets: CodeSnippet[] = props.tabs ?? [
    { label: props.label ?? props.language, language: props.language, code: props.code },
  ];
  const [active, setActive] = useState(0);
  const current = snippets[Math.min(active, snippets.length - 1)];
  const frame = cx("overflow-hidden rounded-card border border-hairline bg-surface-sunken", props.className);
  const copy = <CopyButton value={() => current.code} label={`Copy ${current.label} code`} display="icon" size="sm" variant="ghost" />;

  if (snippets.length === 1) {
    return (
      <div className={frame}>
        <div className="flex items-center justify-between gap-2 border-b border-hairline py-1 pl-4 pr-1.5">
          <span className="text-caption font-semibold text-ink-muted">{current.label}</span>
          {copy}
        </div>
        <CodePane snippet={current} />
      </div>
    );
  }

  return (
    <RadixTabs.Root value={String(active)} onValueChange={(value) => setActive(Number(value))} className={frame}>
      <div className="flex items-center justify-between gap-2 border-b border-hairline pl-2 pr-1.5">
        <RadixTabs.List aria-label="Code language" className="flex min-w-0 gap-1 overflow-x-auto">
          {snippets.map((snippet, i) => (
            <RadixTabs.Trigger
              key={snippet.label}
              value={String(i)}
              className="-mb-px min-h-11 shrink-0 border-b-2 border-transparent px-2.5 text-caption font-semibold text-ink-muted transition-colors hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink"
            >
              {snippet.label}
            </RadixTabs.Trigger>
          ))}
        </RadixTabs.List>
        {copy}
      </div>
      {snippets.map((snippet, i) => (
        <RadixTabs.Content key={snippet.label} value={String(i)}>
          <CodePane snippet={snippet} />
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
