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

/** Accept only HTTPS image embeds (plus localhost HTTP during development). */
export function safeImageUrl(value) {
  const input = cleanText(value, 2048);
  if (!input) return "";
  try {
    const url = new URL(input);
    if (url.protocol === "https:") return url.href;
    if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) return url.href;
  } catch {
    return "";
  }
  return "";
}
