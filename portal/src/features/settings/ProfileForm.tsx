import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Field, Input, TextArea } from "@/components/ds";
import { ApiError, profile as profileApi, type DeveloperProfile } from "@/lib/api";
import { changedFields, PROFILE_LIMITS, toValues, validateProfile, type ProfileErrors, type ProfileField } from "./profile";

export interface ProfileFormProps {
  /**
   * The stored profile, already loaded. Render this form only after a
   * successful load: a form over a failed load would save blanks over real
   * data (AUDIT finding 2).
   */
  profile: DeveloperProfile | null;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const queryClient = useQueryClient();
  const saved = toValues(profile);
  const [values, setValues] = useState(saved);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [status, setStatus] = useState<"idle" | "saved" | "unchanged">("idle");

  const save = useMutation({
    mutationFn: profileApi.update,
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile"], updated);
      setValues(toValues(updated));
      setStatus("saved");
    },
  });

  function update(field: ProfileField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    setStatus("idle");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateProfile(values);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    const patch = changedFields(saved, values);
    if (Object.keys(patch).length === 0) {
      setStatus("unchanged");
      return;
    }
    save.mutate(patch);
  }

  const serverError =
    save.error instanceof ApiError ? save.error.message : save.error ? "We could not save your changes. Try again." : null;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5" aria-label="App profile">
      <Field label="App name" error={errors.appName}>
        <Input
          name="appName"
          autoComplete="off"
          value={values.appName}
          onChange={(e) => update("appName", e.target.value)}
        />
      </Field>
      <Field label="App URL" hint="Where people use what you build. Starts with https://." error={errors.appUrl}>
        <Input
          type="url"
          name="appUrl"
          inputMode="url"
          autoComplete="url"
          placeholder="https://"
          value={values.appUrl}
          onChange={(e) => update("appUrl", e.target.value)}
        />
      </Field>
      <Field
        label="What you are building"
        hint={`A sentence or two helps us understand how the API is used. Up to ${PROFILE_LIMITS.description.toLocaleString()} characters.`}
        error={errors.description}
      >
        <TextArea
          name="description"
          rows={4}
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </Field>

      {serverError && <Alert tone="danger">{serverError}</Alert>}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={save.isPending}>
          Save changes
        </Button>
        <p role="status" className="text-body-sm text-ink-secondary">
          {status === "saved" ? "Saved." : status === "unchanged" ? "Nothing has changed since the last save." : ""}
        </p>
      </div>
    </form>
  );
}
