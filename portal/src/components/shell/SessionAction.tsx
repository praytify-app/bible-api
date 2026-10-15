import { Link } from "@tanstack/react-router";
import { Button, cx } from "@/components/ds";
import { useSession } from "@/lib/auth";

/**
 * "Sign in" or "Dashboard". While the session is still resolving it holds the
 * space with an empty box, so a signed-in visitor never sees "Sign in" flash.
 */
export function SessionAction({ fullWidth = false }: { fullWidth?: boolean }) {
  const { data: session, isPending } = useSession();
  if (isPending) {
    return <span aria-hidden className={cx("block h-9", fullWidth ? "w-full" : "w-24")} />;
  }
  const width = fullWidth ? "w-full" : undefined;
  return session?.user ? (
    <Button asChild variant="secondary" size="sm" className={width}>
      <Link to="/dashboard">Dashboard</Link>
    </Button>
  ) : (
    <Button asChild size="sm" className={width}>
      <Link to="/login">Sign in</Link>
    </Button>
  );
}
