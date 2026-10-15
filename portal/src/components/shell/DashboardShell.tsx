import { Link, Outlet, useNavigate, useRouter } from "@tanstack/react-router";
import { CircleUser, LogOut, Menu, Settings } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import {
  Button,
  cx,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Logo,
  Sheet,
  SheetContent,
  SheetTrigger,
  Spinner,
  ThemeToggle,
} from "@/components/ds";
import { useSession } from "@/lib/auth";
import { dashboardDocsLink, dashboardNav } from "@/lib/nav";
import { MAIN_ID, SkipLink } from "./SkipLink";
import { useSignOut } from "./use-sign-out";

// Sidebar rows: 44px targets, muted until hovered, the selected-item tint and
// indigo text when they hold the current page (data-status comes with aria-current).
const sidebarItem =
  "flex min-h-11 w-full items-center gap-3 rounded-input px-3 text-body-sm font-medium text-ink-secondary " +
  "transition-colors hover:bg-surface-sunken hover:text-ink [&_svg]:size-5 [&_svg]:shrink-0 " +
  "data-[status=active]:bg-accent-subtle data-[status=active]:text-accent-text";

/**
 * Auth guard and frame for /dashboard/*. The guard keeps AUDIT must-not-regress 1:
 * a spinner while the session resolves, a redirect to /login once it resolves
 * empty, and nothing rendered in between, so protected content never flashes.
 */
export function DashboardShell() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    if (isPending || session?.user) return;
    // Read the location once rather than subscribing to it: this shell stays
    // mounted while the login page loads, and a reactive URL would re-fire the
    // redirect with /login as the return path, nesting it on every pass.
    const { pathname, href } = router.state.location;
    if (!pathname.startsWith("/dashboard")) return;
    // Carry the page they asked for (login only honours /dashboard paths), and
    // replace so the back button does not land on a page that bounces again.
    void navigate({ to: "/login", search: { redirect: href }, replace: true });
  }, [isPending, session, navigate, router]);

  if (isPending) {
    return (
      <main id={MAIN_ID} className="flex min-h-dvh items-center justify-center bg-surface">
        <Spinner size="lg" label="Checking your session" />
      </main>
    );
  }

  if (!session?.user) return null;

  const user = { name: session.user.name || "Your account", email: session.user.email };

  return (
    <div className="min-h-dvh bg-surface lg:pl-64">
      <SkipLink />
      {/* Fixed sidebar from lg up; below that the same nav opens in a Sheet.
          A landmark so screen reader landmark navigation reaches the logo link. */}
      <aside
        aria-label="Sidebar"
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-hairline bg-surface lg:flex"
      >
        <div className="flex h-16 shrink-0 items-center px-5">
          <Link to="/dashboard" aria-label="Praytify Bible dashboard, overview" className="rounded-[4px]">
            <Logo product height={22} />
          </Link>
        </div>
        <SidebarNav />
      </aside>

      <header className="sticky top-0 z-20 border-b border-hairline bg-surface">
        <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
          <MobileSidebar />
          <Link to="/dashboard" aria-label="Praytify Bible dashboard, overview" className="rounded-[4px] lg:hidden">
            <Logo product height={22} />
          </Link>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* Visibility on a wrapper: Button's own inline-flex would beat a `hidden` class. */}
            <span className="hidden sm:block">
              <Button asChild variant="ghost" size="sm">
                <Link to="/read">Open the reader</Link>
              </Button>
            </span>
            <ThemeToggle />
            <UserMenu name={user.name} email={user.email} />
          </div>
        </div>
      </header>

      <main id={MAIN_ID} tabIndex={-1} className="mx-auto max-w-content px-4 py-8 outline-none sm:px-6 lg:px-8 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}

function SidebarNav({ className }: { className?: string }) {
  const signOut = useSignOut();
  const DocsIcon = dashboardDocsLink.icon;
  return (
    <nav aria-label="Dashboard" className={cx("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4 pt-2", className)}>
      <ul className="flex flex-col gap-1">
        {dashboardNav.map(({ label, to, icon: Icon, exact }) => (
          <li key={to}>
            <Link to={to} activeOptions={{ exact: exact ?? false }} className={sidebarItem}>
              <Icon aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <ul className="mt-auto flex flex-col gap-1 border-t border-hairline pt-4">
        <li>
          <Link to={dashboardDocsLink.to} className={sidebarItem}>
            <DocsIcon aria-hidden />
            {dashboardDocsLink.label}
          </Link>
        </li>
        <li>
          <button type="button" onClick={() => void signOut()} className={sidebarItem}>
            <LogOut aria-hidden />
            Sign out
          </button>
        </li>
      </ul>
    </nav>
  );
}

function MobileSidebar() {
  const [open, setOpen] = useState(false);
  // The header survives navigation, so a link or Sign out inside closes the sheet.
  const closeOnAction = (event: MouseEvent) => {
    if ((event.target as Element).closest("a, button")) setOpen(false);
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <IconButton label="Open dashboard menu" icon={<Menu />} className="lg:hidden" />
      </SheetTrigger>
      <SheetContent title="Dashboard menu" hideTitle header={<Logo product height={22} />} side="left">
        <div onClick={closeOnAction}>
          <SidebarNav className="-mx-3 -mt-2" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function UserMenu({ name, email }: { name: string; email: string }) {
  const signOut = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Account menu for ${name}`} leadingIcon={<CircleUser aria-hidden />}>
          <span className="hidden max-w-40 truncate md:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 pb-2">
          <span className="truncate text-body-sm font-semibold text-ink">{name}</span>
          <span className="truncate font-normal">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild icon={<Settings />}>
          <Link to="/dashboard/settings">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem icon={<LogOut />} onSelect={() => void signOut()}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
