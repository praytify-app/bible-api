import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { IconButton } from "./IconButton";

export type AlertTone = "info" | "success" | "warning" | "danger";

const tones: Record<AlertTone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: "bg-info-subtle border-info/20", icon: "text-info", Icon: Info },
  success: { box: "bg-success-subtle border-success/20", icon: "text-success", Icon: CircleCheck },
  warning: { box: "bg-warning-subtle border-warning/25", icon: "text-warning", Icon: TriangleAlert },
  danger: { box: "bg-danger-subtle border-danger/25", icon: "text-danger", Icon: CircleAlert },
};

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  /** A Button or link placed under the message. */
  action?: ReactNode;
  onDismiss?: () => void;
  /**
   * Defaults: danger and warning interrupt (role="alert"); info and success wait
   * their turn (role="status"). Use "none" for static notes already on the page at load.
   */
  role?: "alert" | "status" | "none";
  className?: string;
}

export function Alert({ tone = "info", title, children, action, onDismiss, role, className }: AlertProps) {
  const { box, icon, Icon } = tones[tone];
  const resolvedRole = role ?? (tone === "danger" || tone === "warning" ? "alert" : "status");
  return (
    <div
      role={resolvedRole === "none" ? undefined : resolvedRole}
      className={cx("flex items-start gap-3 rounded-card border p-4 text-body-sm text-ink", box, className)}
    >
      <Icon aria-hidden className={cx("mt-0.5 size-5 shrink-0", icon)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="break-words [&_a]:font-semibold [&_a]:underline">{children}</div>}
        {action && <div className="mt-2 flex flex-wrap gap-2">{action}</div>}
      </div>
      {onDismiss && <IconButton label="Dismiss" icon={<X />} size="sm" onClick={onDismiss} className="-my-1 -mr-1" />}
    </div>
  );
}
