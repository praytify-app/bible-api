import { useState, type FormEvent } from "react";
import { Alert, Button, Field, Input } from "@/components/ds";
import { signIn, signUp } from "@/lib/auth";

/** Mirrors `minPasswordLength` in the gateway's BetterAuth config (src/auth/index.ts). */
const MIN_PASSWORD_LENGTH = 12;

export type AuthMode = "sign-in" | "sign-up";

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

function validate(mode: AuthMode, values: { name: string; email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === "sign-up" && !values.name.trim()) errors.name = "Enter your name.";
  if (!values.email.trim()) errors.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter an email address like name@example.com.";
  if (!values.password) errors.password = "Enter your password.";
  // Sign-in leaves length to the server: the rule may change, and an existing password is what it is.
  else if (mode === "sign-up" && values.password.length < MIN_PASSWORD_LENGTH)
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  return errors;
}

export interface EmailPasswordFormProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  /** Called once the session cookie is set. */
  onSignedIn: () => void;
}

export function EmailPasswordForm({ mode, onModeChange, onSignedIn }: EmailPasswordFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const signingUp = mode === "sign-up";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(mode, { name, email, password });
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    setPending(true);
    try {
      const result = signingUp
        ? await signUp.email({ name: name.trim(), email: email.trim(), password })
        : await signIn.email({ email: email.trim(), password });
      if (result.error) {
        setServerError(
          result.error.message ||
            (signingUp ? "We could not create your account." : "We could not sign you in with those details."),
        );
        return;
      }
      onSignedIn();
    } catch {
      setServerError("We could not reach the sign-in service. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  function switchMode() {
    setErrors({});
    setServerError(null);
    onModeChange(signingUp ? "sign-in" : "sign-up");
  }

  return (
    <div className="flex flex-col gap-5">
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5" aria-label={signingUp ? "Create account" : "Sign in with email"}>
        {signingUp && (
          <Field label="Name" error={errors.name} required>
            <Input name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        )}
        <Field label="Email" error={errors.email} required>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field
          label="Password"
          hint={signingUp ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
          error={errors.password}
          required
        >
          <Input
            type="password"
            name="password"
            autoComplete={signingUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {signingUp ? "Create account" : "Sign in"}
        </Button>
      </form>
      <p className="text-center text-body-sm text-ink-secondary">
        {signingUp ? "Already have an account?" : "New here?"}{" "}
        <Button variant="link" onClick={switchMode} disabled={pending}>
          {signingUp ? "Sign in" : "Create an account"}
        </Button>
      </p>
    </div>
  );
}
