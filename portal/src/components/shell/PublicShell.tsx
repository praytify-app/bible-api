import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown, Menu } from "lucide-react";
import { useState, type MouseEvent, type ReactNode } from "react";
import {
  cx,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Eyebrow,
  IconButton,
  Logo,
  Sheet,
  SheetContent,
  SheetTrigger,
  ThemeToggle,
} from "@/components/ds";
import { docsNav, PRAYTIFY_URL, publicNav, SELF_HOST_URL, SOURCE_LABEL, SOURCE_URL, type NavItem } from "@/lib/nav";
import { SessionAction } from "./SessionAction";
import { MAIN_ID, SkipLink } from "./SkipLink";

// Header links: muted until hovered, indigo when they hold the current page.
// TanStack's Link sets data-status="active" and aria-current="page" together,
// so the colour and the announced state cannot drift apart.
const headerLink =
  "inline-flex min-h-11 items-center gap-1 rounded-pill px-3 text-body-sm font-medium text-ink-secondary " +
  "transition-colors hover:text-ink data-[status=active]:text-accent-text";

const sheetLink =
  "flex min-h-12 items-center justify-between gap-3 rounded-input px-3 text-body font-medium text-ink " +
  "transition-colors hover:bg-surface-sunken data-[status=active]:bg-accent-subtle data-[status=active]:text-accent-text";

const footerLink = "text-body-sm text-ink-secondary transition-colors hover:text-ink";

/** Public frame: header, main, footer. Route component, or a wrapper for the not-found page. */
export function PublicShell({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <SkipLink />
      <PublicHeader />
      <main id={MAIN_ID} tabIndex={-1} className="flex-1 outline-none">
        {children ?? <Outlet />}
      </main>
      <SiteFooter />
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-surface">
      <div className="mx-auto flex h-16 max-w-content items-center gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="Praytify Bible, home" className="shrink-0 rounded-[4px]">
          <Logo product height={24} />
        </Link>
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
          {publicNav.map((item) => (
            <Link key={item.to} to={item.to} className={headerLink}>
              {item.label}
            </Link>
          ))}
          <DocsMenu />
          {SOURCE_URL && (
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className={headerLink}>
              {SOURCE_LABEL}
              <ArrowUpRight aria-hidden className="size-4" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden md:block">
            <SessionAction />
          </div>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

function DocsMenu() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const inDocs = pathname.startsWith("/docs");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cx(headerLink, inDocs && "text-accent-text")}>
        Docs
        <ChevronDown aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {/* Items navigate on select rather than wrapping a Link: DropdownMenuItem asChild
            fails to slot without an icon (BOARD contract changes). Swap back once fixed. */}
        {docsNav.map((item) => {
          const current = pathname === item.to;
          return (
            <DropdownMenuItem
              key={item.to}
              onSelect={() => void navigate({ to: item.to })}
              aria-current={current ? "page" : undefined}
              className={cx("py-2", current && "text-accent-text")}
            >
              <span className="flex flex-col">
                <span className="font-semibold">{item.label}</span>
                <span className="text-caption text-ink-muted">{item.description}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileMenu() {
  const [open, setOpen] = useState(false);
  // The sheet outlives navigation (the header persists), so any link inside closes it.
  const closeOnLink = (event: MouseEvent) => {
    if ((event.target as Element).closest("a")) setOpen(false);
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <IconButton label="Open menu" icon={<Menu />} className="md:hidden" />
      </SheetTrigger>
      <SheetContent title="Menu" hideTitle header={<Logo product height={22} />} side="left">
        <div onClick={closeOnLink} className="flex flex-col gap-6">
          <nav aria-label="Main" className="flex flex-col gap-6">
            <ul className="flex flex-col gap-1">
              {publicNav.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className={sheetLink}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <Eyebrow className="px-3">Docs</Eyebrow>
              <ul className="flex flex-col gap-1">
                {docsNav.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} activeOptions={{ exact: true }} className={sheetLink}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {SOURCE_URL && (
              <ul className="flex flex-col gap-1 border-t border-hairline pt-4">
                <li>
                  <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className={sheetLink}>
                    {SOURCE_LABEL}
                    <ArrowUpRight aria-hidden className="size-5 text-ink-muted" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              </ul>
            )}
          </nav>
          <SessionAction fullWidth />
        </div>
      </SheetContent>
    </Sheet>
  );
}

type FooterLink = { label: string } & ({ to: NavItem["to"] | "/dashboard"; href?: never } | { href: string; to?: never });

const footerColumns: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Read", to: "/read" },
      { label: "Embed builder", to: "/embed" },
      { label: "Dashboard", to: "/dashboard" },
    ],
  },
  { title: "Docs", links: docsNav.map(({ label, to }) => ({ label, to })) },
  // Only when the source is public: the column is nothing but links to it.
  ...(SOURCE_URL && SELF_HOST_URL
    ? [
        {
          title: "Open source",
          links: [
            { label: SOURCE_LABEL === "GitHub" ? "Source on GitHub" : "Source code", href: SOURCE_URL },
            { label: "Self-host it", href: SELF_HOST_URL },
          ],
        },
      ]
    : []),
];

function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-surface-sunken">
      <div className="mx-auto grid max-w-content gap-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex max-w-sm flex-col gap-3">
          <Logo product height={22} />
          <p className="text-body-sm text-ink-secondary">
            Open-source scripture infrastructure. The code is MIT licensed; each translation keeps its own licence.
          </p>
          <p className="text-body-sm text-ink-secondary">
            Part of{" "}
            <a href={PRAYTIFY_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-text hover:underline">
              Praytify
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {footerColumns.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <Eyebrow>{column.title}</Eyebrow>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link to={link.to} activeOptions={{ exact: true }} className={footerLink}>
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} target="_blank" rel="noopener noreferrer" className={footerLink}>
                        {link.label}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}
