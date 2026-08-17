export type GradientStop = { color: string; offset: number };

export type FillType = "solid" | "linear" | "radial";

export type Fill = {
  type: FillType;
  color: string;
  stops: GradientStop[];
  angle: number;
};

export type TextElement = {
  id: string;
  type?: "text" | undefined;
  text: string;
  family: string;
  weight: number;
  size: number;
  letterSpacing: number;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  fill: Fill;
  scaleX?: number | undefined;
  scaleY?: number | undefined;
  fontWidth?: number | undefined;
};

export type ImageElement = {
  id: string;
  type: "image";
  src: string; // Base64 data URL or image URL
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  aspectRatio: number;
  borderRadius?: number | undefined;
};

export type CanvasElement = TextElement | ImageElement;

export function isTextElement(el: CanvasElement): el is TextElement {
  return !("type" in el) || el.type === "text" || "text" in el;
}

export function isImageElement(el: CanvasElement): el is ImageElement {
  return "type" in el && el.type === "image";
}

export type BackgroundType = "transparent" | "solid" | "linear" | "radial";

export type Background = {
  type: BackgroundType;
  color: string;
  stops: GradientStop[];
  angle: number;
};

export type LogoDoc = {
  width: number;
  height: number;
  background: Background;
  elements: CanvasElement[];
};

export const CANVAS_PRESETS = [
  { label: "Square", w: 800, h: 800 },
  { label: "Wide", w: 1200, h: 630 },
  { label: "Banner", w: 1500, h: 500 },
  { label: "Story", w: 1080, h: 1920 },
  { label: "Icon", w: 512, h: 512 },
] as const;

export const GRADIENT_PRESETS: { name: string; stops: GradientStop[] }[] = [
  {
    name: "Lime",
    stops: [
      { color: "#d9f99d", offset: 0 },
      { color: "#22c55e", offset: 1 },
    ],
  },
  {
    name: "Sunset",
    stops: [
      { color: "#fb7185", offset: 0 },
      { color: "#fbbf24", offset: 1 },
    ],
  },
  {
    name: "Ocean",
    stops: [
      { color: "#22d3ee", offset: 0 },
      { color: "#3b82f6", offset: 1 },
    ],
  },
  {
    name: "Grape",
    stops: [
      { color: "#a78bfa", offset: 0 },
      { color: "#ec4899", offset: 1 },
    ],
  },
  {
    name: "Steel",
    stops: [
      { color: "#f8fafc", offset: 0 },
      { color: "#64748b", offset: 1 },
    ],
  },
  {
    name: "Ember",
    stops: [
      { color: "#f97316", offset: 0 },
      { color: "#dc2626", offset: 1 },
    ],
  },
];

export const uid = () => Math.random().toString(36).slice(2, 10);

export function defaultFill(): Fill {
  return {
    type: "solid",
    color: "#ffffff",
    stops: [
      { color: "#d9f99d", offset: 0 },
      { color: "#22c55e", offset: 1 },
    ],
    angle: 90,
  };
}

export function newTextElement(doc: LogoDoc, text = "Your Brand"): TextElement {
  return {
    id: uid(),
    type: "text",
    text,
    family: "Space Grotesk",
    weight: 700,
    size: Math.round(Math.min(doc.width, doc.height) * 0.16),
    letterSpacing: 0,
    x: Math.round(doc.width / 2),
    y: Math.round(doc.height / 2),
    rotation: 0,
    opacity: 1,
    scaleX: 1,
    scaleY: 1,
    fontWidth: 100,
    fill: defaultFill(),
  };
}

export function newImageElement(
  doc: LogoDoc,
  src: string,
  name: string,
  naturalWidth: number,
  naturalHeight: number,
): ImageElement {
  const maxInitialSize = Math.round(Math.min(doc.width, doc.height) * 0.45);
  const aspect = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 1;
  const w = aspect >= 1 ? maxInitialSize : Math.max(20, Math.round(maxInitialSize * aspect));
  const h = aspect >= 1 ? Math.max(20, Math.round(maxInitialSize / aspect)) : maxInitialSize;
  return {
    id: uid(),
    type: "image",
    src,
    name: name || "Image",
    x: Math.round(doc.width / 2),
    y: Math.round(doc.height / 2),
    width: w,
    height: h,
    rotation: 0,
    opacity: 1,
    aspectRatio: aspect,
    borderRadius: 0,
  };
}

/** Angle (deg, 0 = left→right) to objectBoundingBox gradient coordinates. */
export function angleToCoords(angle: number) {
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) / 2;
  const y = Math.sin(rad) / 2;
  return {
    x1: 0.5 - x,
    y1: 0.5 - y,
    x2: 0.5 + x,
    y2: 0.5 + y,
  };
}

export function cssGradient(type: FillType | BackgroundType, stops: GradientStop[], angle: number) {
  const list = [...stops]
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${s.color} ${Math.round(s.offset * 100)}%`)
    .join(", ");
  return type === "radial"
    ? `radial-gradient(circle at 50% 50%, ${list})`
    : `linear-gradient(${90 - angle}deg, ${list})`;
}
