import { useRouterState } from "@tanstack/react-router";
import { EmbedBuilder } from "@/features/embed/EmbedBuilder";

/**
 * The embed builder, public at /embed and inside the dashboard at
 * /dashboard/embed. The dashboard shell already sets the content width and
 * padding; on the public site the page sets its own, aligned with the header.
 */
export function EmbedPage() {
  const inDashboard = useRouterState({ select: (state) => state.location.pathname.startsWith("/dashboard") });
  if (inDashboard) return <EmbedBuilder inDashboard />;
  return (
    <div className="mx-auto w-full max-w-content px-4 py-10 sm:px-6 sm:py-14">
      <EmbedBuilder />
    </div>
  );
}
