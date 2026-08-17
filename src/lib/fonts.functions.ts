import { createServerFn } from "@tanstack/react-start";

export type FontAxis = {
  tag: string;
  min: number;
  max: number;
  defaultValue: number;
};

export type GoogleFont = {
  family: string;
  category: string;
  weights: number[];
  axes?: FontAxis[] | undefined;
};

const FALLBACK: GoogleFont[] = [
  { family: "Inter", category: "Sans Serif", weights: [400, 700, 900] },
  { family: "Playfair Display", category: "Serif", weights: [400, 700, 900] },
  { family: "Space Grotesk", category: "Sans Serif", weights: [400, 700] },
  { family: "Bebas Neue", category: "Display", weights: [400] },
  { family: "JetBrains Mono", category: "Monospace", weights: [400, 700] },
];

export const getGoogleFonts = createServerFn({ method: "GET" }).handler(
  async (): Promise<GoogleFont[]> => {
    try {
      const res = await fetch("https://fonts.google.com/metadata/fonts", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return FALLBACK;
      const text = await res.text();
      const json = JSON.parse(text.replace(/^\)\]\}'/, ""));
      const list = json.familyMetadataList as Array<{
        family: string;
        category: string;
        popularity: number;
        fonts: Record<string, unknown>;
        axes?: Array<{ tag: string; min: number; max: number; defaultValue: number }>;
      }>;
      return list
        .sort((a, b) => (a.popularity ?? 9999) - (b.popularity ?? 9999))
        .map((f) => {
          const weights = Object.keys(f.fonts ?? {})
            .filter((k) => !k.endsWith("i"))
            .map((k) => parseInt(k, 10))
            .filter((n) => Number.isFinite(n))
            .sort((a, b) => a - b);
          return {
            family: f.family,
            category: f.category ?? "Sans Serif",
            weights: weights.length ? weights : [400],
            axes: f.axes?.map((a) => ({
              tag: a.tag,
              min: a.min,
              max: a.max,
              defaultValue: a.defaultValue,
            })),
          };
        });
    } catch {
      return FALLBACK;
    }
  },
);
