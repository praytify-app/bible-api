import { ApiError } from "@/lib/api";

export function isRateLimited(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 429;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** "Too many requests right now. Try again in 30 seconds." Uses Retry-After when the gateway sends it. */
export function rateLimitMessage(error: ApiError): string {
  const wait = error.retryAfter;
  if (!wait) return "Too many requests right now. Wait a moment, then try again.";
  const seconds = Math.ceil(wait);
  const when =
    seconds < 90 ? `${seconds} ${seconds === 1 ? "second" : "seconds"}` : `${Math.ceil(seconds / 60)} minutes`;
  return `Too many requests right now. Try again in ${when}.`;
}

/** Don't retry what will not change: missing chapters and rate limits. */
export function retryUnlessFinal(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 404 || error.status === 400 || error.status === 429)) return false;
  return failureCount < 1;
}
