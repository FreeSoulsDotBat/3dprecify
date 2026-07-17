// 009/T028 (E4, PR-C) — hand a Blob to the device as a downloaded file.
//
// The bytes arrive over an AUTHENTICATED fetch (the export routes need a Firebase ID token), so a
// plain `<a href>` or `window.open` cannot be used: the browser would issue an unauthenticated
// navigation and the seller would get a 401 page instead of their quote. The object-URL + synthetic
// click is the standard way to save bytes we already hold.
//
// `revokeObjectURL` is deferred rather than immediate: revoking in the same tick can race the
// browser's own read of the URL, producing an empty download on some engines.
const REVOKE_DELAY_MS = 1000;

/** Saves `blob` as `filename`. No-op outside a DOM (SSR/tests without jsdom). */
export function saveFile(blob: Blob, filename: string): void {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
