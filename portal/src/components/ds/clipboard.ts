/**
 * Write text to the clipboard, or throw. Never reports success it cannot prove:
 * the Clipboard API is missing in insecure contexts and can reject when the
 * page lacks focus or permission.
 */
export async function writeClipboard(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("Clipboard is not available in this browser context");
  }
  await navigator.clipboard.writeText(text);
}
