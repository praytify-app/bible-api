import { AArrowDown, AArrowUp, Monitor, Moon, Settings2, Sun } from "lucide-react";
import { Button, IconButton, Kbd, Popover, PopoverContent, PopoverTrigger, Switch } from "@/components/ds";
import { useTheme, type ThemePreference } from "@/lib/theme";
import { TEXT_SCALES, stepScale, type ReaderSettings } from "./settings";

const THEMES: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  // "Device" rather than "Match device" so three fit across a phone-width popover.
  { value: "system", label: "Device", Icon: Monitor },
];

const percent = new Intl.NumberFormat(undefined, { style: "percent" });

export interface ReadingSettingsProps {
  settings: ReaderSettings;
  onChange: (patch: Partial<ReaderSettings>) => void;
}

export function ReadingSettings({ settings, onChange }: ReadingSettingsProps) {
  const { theme, setTheme } = useTheme();
  const atSmallest = settings.scale === TEXT_SCALES[0];
  const atLargest = settings.scale === TEXT_SCALES[TEXT_SCALES.length - 1];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton label="Reading settings" icon={<Settings2 />} variant="secondary" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80" aria-labelledby="reader-settings-title">
        <h2 id="reader-settings-title" className="text-h4 font-semibold text-ink">
          Reading settings
        </h2>
        <p className="mt-0.5 text-caption text-ink-muted">Saved in this browser.</p>

        <div className="mt-4 flex min-h-11 items-center justify-between gap-3">
          <span id="reader-text-size" className="text-body-sm font-medium text-ink">
            Text size
          </span>
          <div className="flex items-center gap-1" role="group" aria-labelledby="reader-text-size">
            <IconButton
              label="Smaller text"
              icon={<AArrowDown />}
              variant="secondary"
              size="sm"
              disabled={atSmallest}
              onClick={() => onChange({ scale: stepScale(settings.scale, -1) })}
            />
            <output aria-live="polite" className="w-14 text-center text-body-sm tabular-nums text-ink-secondary">
              {percent.format(settings.scale)}
            </output>
            <IconButton
              label="Larger text"
              icon={<AArrowUp />}
              variant="secondary"
              size="sm"
              disabled={atLargest}
              onClick={() => onChange({ scale: stepScale(settings.scale, 1) })}
            />
          </div>
        </div>

        <fieldset className="mt-3">
          <legend className="text-body-sm font-medium text-ink">Theme</legend>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {THEMES.map(({ value, label, Icon }) => (
              <Button
                key={value}
                variant="secondary"
                size="sm"
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
                leadingIcon={<Icon />}
                className="px-2 aria-pressed:border-accent aria-pressed:bg-accent-subtle aria-pressed:text-accent-text"
              >
                {label}
              </Button>
            ))}
          </div>
        </fieldset>

        <Switch
          className="mt-2"
          label="Verse numbers"
          checked={settings.showVerseNumbers}
          onCheckedChange={(checked) => onChange({ showVerseNumbers: checked })}
        />

        <div className="mt-3 border-t border-hairline pt-3 text-caption text-ink-muted">
          <p className="font-medium text-ink-secondary">Keyboard</p>
          <ul className="mt-1.5 space-y-1.5">
            <li>
              <Kbd>←</Kbd> <Kbd>→</Kbd> previous or next chapter
            </li>
            <li>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> move between verse numbers, <Kbd>Enter</Kbd> to select
            </li>
            <li>
              <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> or Shift-click selects a range, <Kbd>Esc</Kbd> clears
            </li>
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
