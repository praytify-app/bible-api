import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { Button, PageHeader } from "@/components/ds";
import { ApiReferenceFrame } from "@/features/docs/ApiReferenceFrame";
import { API_URL } from "@/lib/api";
import { useTheme } from "@/lib/theme";

export function DocsPage() {
  // resolvedTheme is the scheme on screen ("system" already resolved to the OS), so the
  // reference matches the portal. The new-tab link stays unpinned and follows the OS there.
  const { resolvedTheme } = useTheme();
  const referenceUrl = `${API_URL}/docs`;
  const frameUrl = `${referenceUrl}?theme=${resolvedTheme}`;

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="API reference"
        description={
          <>
            Every public endpoint, generated from the live OpenAPI spec. New here? Start with the{" "}
            <Link to="/docs/quickstart" className="font-semibold text-accent-text underline-offset-4 hover:underline">
              quick start
            </Link>
            .
          </>
        }
        actions={
          <Button asChild variant="secondary" trailingIcon={<ExternalLink aria-hidden />}>
            <a href={referenceUrl} target="_blank" rel="noopener noreferrer">
              Open in a new tab
            </a>
          </Button>
        }
      />
      {/* Keyed by URL: a theme change reloads the reference and resets its loading state. */}
      <ApiReferenceFrame key={frameUrl} src={frameUrl} />
    </div>
  );
}
