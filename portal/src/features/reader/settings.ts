import { useCallback, useState } from "react";

/** Reading preferences kept in this browser. Theme is not here: ThemeProvider owns and persists it. */
export interface ReaderSettings {
  /** Multiplier for `--reader-scale`; one of TEXT_SCALES. */
  scale: number;
  showVerseNumbers: boolean;
}

export const READER_SETTINGS_STORAGE_KEY = "pb-reader-settings";

/** 17px to 33px at the 19px base. Steps, not a slider, so each press is a visible change. */
export const TEXT_SCALES = [0.875, 1, 1.125, 1.25, 1.5, 1.75] as const;

export const DEFAULT_READER_SETTINGS: Readonly<ReaderSettings> = Object.freeze({ scale: 1, showVerseNumbers: true });

export function parseReaderSettings(value: unknown): ReaderSettings {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const scale = (TEXT_SCALES as readonly number[]).includes(source.scale as number)
    ? (source.scale as number)
    : DEFAULT_READER_SETTINGS.scale;
  const showVerseNumbers =
    typeof source.showVerseNumbers === "boolean" ? source.showVerseNumbers : DEFAULT_READER_SETTINGS.showVerseNumbers;
  return { scale, showVerseNumbers };
}

export function loadReaderSettings(): ReaderSettings {
  try {
    const raw = window.localStorage.getItem(READER_SETTINGS_STORAGE_KEY);
    return parseReaderSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_READER_SETTINGS };
  }
}

export function saveReaderSettings(settings: ReaderSettings): void {
  try {
    window.localStorage.setItem(READER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Blocked or full storage: the setting still applies for this visit.
  }
}

/** One step larger (+1) or smaller (-1); stays put at either end. */
export function stepScale(scale: number, direction: 1 | -1): number {
  const steps = TEXT_SCALES as readonly number[];
  const index = steps.indexOf(scale);
  const from = index < 0 ? steps.indexOf(DEFAULT_READER_SETTINGS.scale) : index;
  return steps[Math.min(Math.max(from + direction, 0), steps.length - 1)];
}

export function useReaderSettings(): [ReaderSettings, (patch: Partial<ReaderSettings>) => void] {
  const [settings, setSettings] = useState<ReaderSettings>(loadReaderSettings);
  const update = useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((current) => {
      const next = parseReaderSettings({ ...current, ...patch });
      saveReaderSettings(next);
      return next;
    });
  }, []);
  return [settings, update];
}
