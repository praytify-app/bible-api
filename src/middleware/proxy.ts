import type { Context } from "hono";

const BIBLE_API_URL =
  process.env.BIBLE_API_URL || "http://localhost:3001";

/**
 * Reverse proxy handler that forwards requests to the upstream Bible API.
 * Preserves the path, query string, method, headers, and body.
 */
export async function proxyToBibleApi(c: Context): Promise<Response> {
  const url = new URL(c.req.url);
  const targetUrl = `${BIBLE_API_URL}${url.pathname}${url.search}`;

  const headers = new Headers();
  // Forward relevant headers
  const forwardHeaders = [
    "accept",
    "accept-language",
    "content-type",
    "content-length",
  ];
  for (const header of forwardHeaders) {
    const value = c.req.header(header);
    if (value) {
      headers.set(header, value);
    }
  }

  // Add gateway identification
  headers.set("X-Forwarded-For", c.req.header("X-Forwarded-For") || "");
  headers.set("X-Gateway", "praytify-bible");

  const init: RequestInit = {
    method: c.req.method,
    headers,
  };

  // Forward body for non-GET/HEAD requests
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    init.body = await c.req.raw.text();
  }

  try {
    const response = await fetch(targetUrl, init);

    // Return the upstream response with CORS headers preserved
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("X-Powered-By", "praytify-bible-gateway");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("[proxy] Upstream request failed:", err);
    return c.json(
      {
        error: "Bad Gateway",
        message: "The upstream Bible API is unavailable.",
      },
      502
    );
  }
}
