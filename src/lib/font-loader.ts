const loaded = new Set<string>();

/** Injects a Google Fonts <link> for a family/weight/width once. */
export function loadGoogleFont(family: string, weight: number, fontWidth?: number) {
  if (typeof document === "undefined") return;
  const w = fontWidth && fontWidth !== 100 ? Math.round(fontWidth) : undefined;
  const key = `${family}::${weight}::${w ?? 100}`;
  if (loaded.has(key)) return;
  loaded.add(key);

  const link = document.createElement("link");
  link.rel = "stylesheet";
  const params = w ? `wdth,wght@${w},${weight}` : `wght@${weight}`;
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family,
  )}:${params}&display=swap`;
  document.head.appendChild(link);
}
