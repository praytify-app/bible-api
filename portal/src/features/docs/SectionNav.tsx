import { useEffect, useState, type ReactNode } from "react";
import { cx } from "@/components/ds";

export interface SectionLink {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
}

/**
 * The section of the page currently in view, for the menu's active state.
 * The section nearest the top of the viewport wins.
 */
function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0]);
  const key = ids.join(",");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        if (top) setActive(top[0]);
      },
      // A section counts once it reaches the upper part of the viewport.
      { rootMargin: "-80px 0px -55% 0px" },
    );
    for (const id of key.split(",")) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [key]);

  return active;
}

export interface SectionNavProps {
  label: string;
  sections: SectionLink[];
  className?: string;
}

/**
 * In-page menu for long pages split into sections (template SettingsPage menu).
 * Sticky beside the content on large screens; hidden below, where the
 * section headings carry the page on their own.
 */
export function SectionNav({ label, sections, className }: SectionNavProps) {
  const active = useActiveSection(sections.map((s) => s.id));

  return (
    <nav aria-label={label} className={cx("hidden lg:sticky lg:top-24 lg:block lg:self-start", className)}>
      <ul className="flex flex-col gap-1">
        {sections.map((section) => {
          const current = section.id === active;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={current ? "location" : undefined}
                className={cx(
                  "flex items-start gap-3 rounded-input px-3 py-2.5 transition-colors",
                  current ? "bg-accent-subtle text-accent-text" : "text-ink-secondary hover:bg-surface-sunken hover:text-ink",
                )}
              >
                {section.icon && <span aria-hidden className="mt-0.5 shrink-0 [&_svg]:size-4">{section.icon}</span>}
                <span className="flex min-w-0 flex-col">
                  <span className="text-body-sm font-semibold">{section.title}</span>
                  {section.description && (
                    <span className={cx("text-caption", current ? "text-accent-text" : "text-ink-muted")}>
                      {section.description}
                    </span>
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
