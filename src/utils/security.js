/** Escape untrusted values before interpolating them into an HTML template. */
export function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Keep classroom display strings bounded and free from control characters. */
export function cleanText(value, maxLength = 200) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function safeColor(value, fallback = "#64748B") {
  const color = String(value ?? "");
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : fallback;
}
