const loaded = new Set<string>();

/** Injects a Google Fonts <link> for a family/weight once. */
export function loadGoogleFont(family: string, weight: number) {
  if (typeof document === "undefined") return;
  const key = `${family}::${weight}`;
  if (loaded.has(key)) return;
  loaded.add(key);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family,
  )}:wght@${weight}&display=swap`;
  document.head.appendChild(link);
}
