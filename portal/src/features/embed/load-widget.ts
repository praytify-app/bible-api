/**
 * Loads the real widget, the same /embed/v1.js integrators paste, so the
 * preview cannot drift from what ships. It is same-origin, which the
 * portal's `script-src 'self'` CSP allows; scripts/copy-embed.mjs puts it in
 * public/ for dev and build.
 *
 * A module script element rather than `import()`: Vite's dev server rewrites
 * dynamic imports into its transform pipeline, which refuses public files.
 */

export const WIDGET_PATH = `${import.meta.env.BASE_URL}embed/v1.js`;

let loading: Promise<void> | null = null;
let attempt = 0;

export function loadWidget(): Promise<void> {
  if (customElements.get("praytify-verse") && customElements.get("praytify-daily")) return Promise.resolve();
  if (!loading) {
    // A retry asks for a fresh URL so the browser does not reuse the failure.
    const src = attempt === 0 ? WIDGET_PATH : `${WIDGET_PATH}?retry=${attempt}`;
    attempt += 1;
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.type = "module";
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        reject(new Error(`${src} could not be fetched.`));
      };
      document.head.append(script);
    }).then(() =>
      Promise.all([customElements.whenDefined("praytify-verse"), customElements.whenDefined("praytify-daily")]).then(
        () => undefined,
      ),
    );
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}
