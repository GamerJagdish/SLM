import type { LogoDoc } from "./logo";

const toBase64Url = (bytes: Uint8Array) => {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (s: string) => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export function encodeDoc(doc: LogoDoc): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(doc)));
}

export function decodeDoc(code: string): LogoDoc | null {
  try {
    const doc = JSON.parse(new TextDecoder().decode(fromBase64Url(code))) as LogoDoc;
    if (!doc || typeof doc.width !== "number" || !Array.isArray(doc.elements)) return null;
    return doc;
  } catch {
    return null;
  }
}

export function buildShareUrl(doc: LogoDoc): string {
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = `?d=${encodeDoc(doc)}`;
  return url.toString();
}

const KEY = "slm:doc";

export function saveLocal(doc: LogoDoc) {
  try {
    localStorage.setItem(KEY, JSON.stringify(doc));
  } catch {
    /* ignore */
  }
}

export function loadLocal(): LogoDoc | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const doc = JSON.parse(raw) as LogoDoc;
    return Array.isArray(doc?.elements) ? doc : null;
  } catch {
    return null;
  }
}
