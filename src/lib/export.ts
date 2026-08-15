const fontCache = new Map<string, string>();

async function toDataUri(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:font/woff2;base64,${btoa(binary)}`;
}

/** Fetch a Google font CSS and inline its latin woff2 files as data URIs. */
async function embedFont(family: string, weight: number): Promise<string> {
  const key = `${family}::${weight}`;
  const cached = fontCache.get(key);
  if (cached !== undefined) return cached;

  let out = "";
  try {
    const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      family,
    )}:wght@${weight}&display=swap`;
    const css = await fetch(href).then((r) => (r.ok ? r.text() : ""));
    const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g)].filter(
      ([, subset]) => subset === "latin" || subset === "latin-ext",
    );
    const chosen: string[] = blocks.length
      ? blocks.map((b) => b[2] ?? "")
      : [...css.matchAll(/@font-face\s*\{[^}]+\}/g)].map((m) => m[0]);

    for (const block of chosen) {
      const urlMatch = block.match(/url\((https:\/\/[^)]+\.woff2)\)/);
      const fontUrl = urlMatch?.[1];
      if (!fontUrl) continue;
      const data = await toDataUri(fontUrl);
      out += block.replace(fontUrl, data) + "\n";
    }
  } catch {
    out = "";
  }
  fontCache.set(key, out);
  return out;
}

export async function serializeSvg(
  svg: SVGSVGElement,
  opts: { width: number; height: number; fonts: { family: string; weight: number }[] },
): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("[data-editor-only]").forEach((n) => n.remove());
  clone.setAttribute("width", String(opts.width));
  clone.setAttribute("height", String(opts.height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.removeAttribute("style");
  clone.removeAttribute("class");

  const unique = new Map<string, { family: string; weight: number }>();
  opts.fonts.forEach((f) => unique.set(`${f.family}::${f.weight}`, f));
  const css = (await Promise.all([...unique.values()].map((f) => embedFont(f.family, f.weight))))
    .join("")
    .trim();

  if (css) {
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = css;
    clone.insertBefore(style, clone.firstChild);
  }

  return new XMLSerializer().serializeToString(clone);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadSvg(svgString: string, filename: string) {
  download(new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }), filename);
}

export async function downloadPng(
  svgString: string,
  width: number,
  height: number,
  filename: string,
) {
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not rasterise the logo"));
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Export failed");
  download(blob, filename);
}
