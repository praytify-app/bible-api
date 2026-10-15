import type { DeveloperProfile } from "@/lib/api";

/** Mirrors the gateway's profile schema (src/routes/profile.ts) so most mistakes never leave the browser. */
export const PROFILE_LIMITS = { appName: 120, appUrl: 300, description: 2000 } as const;

export type ProfileField = keyof typeof PROFILE_LIMITS;
export type ProfileValues = Record<ProfileField, string>;
export type ProfileErrors = Partial<Record<ProfileField, string>>;

const FIELDS = Object.keys(PROFILE_LIMITS) as ProfileField[];

/** Form values for a stored profile. No profile yet is a real, empty state, not an error. */
export function toValues(profile: DeveloperProfile | null): ProfileValues {
  return {
    appName: profile?.appName ?? "",
    appUrl: profile?.appUrl ?? "",
    description: profile?.description ?? "",
  };
}

export function validateProfile(values: ProfileValues): ProfileErrors {
  const errors: ProfileErrors = {};
  const url = values.appUrl.trim();
  if (url && !/^https?:\/\/[^\s]+$/i.test(url)) errors.appUrl = "Start the address with https:// or http://.";
  for (const field of FIELDS) {
    if (values[field].trim().length > PROFILE_LIMITS[field])
      errors[field] = `Keep this under ${PROFILE_LIMITS[field].toLocaleString()} characters.`;
  }
  return errors;
}

/**
 * Only the fields that differ from what was loaded. The gateway applies a
 * partial update, so an untouched field can never be overwritten, even if
 * the stored value changed in another tab. An emptied field is sent as ""
 * and stored as null.
 */
export function changedFields(saved: ProfileValues, current: ProfileValues): Partial<ProfileValues> {
  const patch: Partial<ProfileValues> = {};
  for (const field of FIELDS) {
    const next = current[field].trim();
    if (next !== saved[field].trim()) patch[field] = next;
  }
  return patch;
}
