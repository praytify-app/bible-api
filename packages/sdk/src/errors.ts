/**
 * Thrown for every non-2xx response and for network failures.
 *
 * `status` is 0 when the request never got a response (offline, DNS, timeout),
 * so callers can tell "the API said no" from "we could not reach the API".
 */
export class PraytifyBibleError extends Error {
  readonly status: number;
  readonly code: string;
  /** Seconds to wait before retrying, from the `Retry-After` header on 429/503. */
  readonly retryAfter?: number;

  constructor(message: string, opts: { status: number; code: string; retryAfter?: number; cause?: unknown }) {
    super(message, opts.cause === undefined ? undefined : { cause: opts.cause });
    this.name = "PraytifyBibleError";
    this.status = opts.status;
    this.code = opts.code;
    this.retryAfter = opts.retryAfter;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

/**
 * The gateway and the engine have used two error envelopes over time:
 * `{ error: { code, message } }` and `{ error: "Unauthorized", message }`.
 * Accept both so the SDK keeps working against older self-hosted deployments.
 */
export function parseErrorBody(body: unknown, status: number): { code: string; message: string } {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (b.error && typeof b.error === "object") {
      const e = b.error as Record<string, unknown>;
      return {
        code: typeof e.code === "string" ? e.code : statusCode(status),
        message: typeof e.message === "string" ? e.message : `Request failed with status ${status}`,
      };
    }
    if (typeof b.message === "string") {
      return { code: typeof b.error === "string" ? toCode(b.error) : statusCode(status), message: b.message };
    }
  }
  return { code: statusCode(status), message: `Request failed with status ${status}` };
}

function toCode(s: string): string {
  return s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function statusCode(status: number): string {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return "HTTP_ERROR";
}
