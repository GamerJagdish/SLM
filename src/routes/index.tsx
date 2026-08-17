import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Download,
  Grid3x3,
  ImageIcon,
  Layers,
  Link2,
  Lock,
  Magnet,
  MoveDown,
  MoveUp,
  Plus,
  Redo2,
  RefreshCw,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FillEditor } from "@/components/logo/FillEditor";
import { FontPicker } from "@/components/logo/FontPicker";
import { LogoCanvas } from "@/components/logo/LogoCanvas";
import { getGoogleFonts, type GoogleFont } from "@/lib/fonts.functions";
import { loadGoogleFont } from "@/lib/font-loader";
import { downloadPng, downloadSvg, serializeSvg } from "@/lib/export";
import { buildShareUrl, decodeDoc, loadLocal, saveLocal } from "@/lib/share";
import { useHistory } from "@/hooks/useHistory";
import {
  CANVAS_PRESETS,
  isImageElement,
  isTextElement,
  newImageElement,
  newTextElement,
  uid,
  type CanvasElement,
  type ImageElement,
  type LogoDoc,
  type TextElement,
} from "@/lib/logo";
import { cn } from "@/lib/utils";

const TITLE = "SLM - Simple Logo Maker";
const DESC =
  "Design a logo in your browser: pick a canvas, add text and images with any Google Font, apply gradients, then export SVG or PNG at any size.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

const initialDoc = (): LogoDoc => {
  const doc: LogoDoc = {
    width: 800,
    height: 800,
    background: {
      type: "linear",
      color: "#101014",
      stops: [
        { color: "#101014", offset: 0 },
        { color: "#1f2937", offset: 1 },
      ],
      angle: 90,
    },
    elements: [],
  };
  doc.elements = [
    {
      ...newTextElement(doc, "SLM"),
      id: "slm-title",
      size: 220,
      y: 360,
      fill: {
        type: "linear",
        color: "#ffffff",
        stops: [
          { color: "#d9f99d", offset: 0 },
          { color: "#22c55e", offset: 1 },
        ],
        angle: 90,
      },
    },
    {
      ...newTextElement(doc, "simple logo maker"),
      id: "slm-sub",
      size: 54,
      weight: 400,
      letterSpacing: 6,
      y: 490,
      fill: { type: "solid", color: "#9ca3af", stops: [], angle: 90 },
    },
  ];
  return doc;
};

const getInitialDoc = (): LogoDoc => {
  if (typeof window !== "undefined") {
    const code = new URLSearchParams(window.location.search).get("d");
    const shared = code ? decodeDoc(code) : null;
    if (shared) return shared;
    const local = loadLocal();
    if (local) return local;
  }
  return initialDoc();
};

function Studio() {
  const fetchFonts = useServerFn(getGoogleFonts);
  const { data: fonts = [] } = useQuery<GoogleFont[]>({
    queryKey: ["google-fonts"],
    queryFn: () => fetchFonts(),
    staleTime: Infinity,
  });

  const {
    state: doc,
    set: setDoc,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<LogoDoc>(getInitialDoc);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportWidth, setExportWidth] = useState(() => doc.width || 800);
  const [busy, setBusy] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [snap, setSnap] = useState(true);
  const [lockAspect, setLockAspect] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  // Notify on shared design load
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("d");
    if (code && decodeDoc(code)) {
      toast.success("Loaded shared design");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => saveLocal(doc), 400);
    return () => clearTimeout(t);
  }, [doc]);

  useEffect(() => {
    doc.elements
      .filter(isTextElement)
      .forEach((el) => loadGoogleFont(el.family, el.weight, el.fontWidth));
  }, [doc.elements]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const activeSelectedId =
    selectedId && doc.elements.some((e) => e.id === selectedId)
      ? selectedId
      : (doc.elements[0]?.id ?? null);
  const selected = doc.elements.find((e) => e.id === activeSelectedId) ?? null;
  const ratio = doc.height / doc.width;
  const exportHeight = Math.round(exportWidth * ratio);

  const patchEl = (id: string, patch: Partial<CanvasElement>, label = "") =>
    setDoc(
      (d) => ({
        ...d,
        elements: d.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as CanvasElement) : e)),
      }),
      label ? `${label}:${id}` : "",
    );

  const activeFont = useMemo(() => {
    if (!selected || !isTextElement(selected)) return null;
    return fonts.find((x) => x.family.toLowerCase() === selected.family.toLowerCase()) ?? null;
  }, [fonts, selected]);

  const wdthAxis = useMemo(() => {
    return activeFont?.axes?.find((a) => a.tag === "wdth") ?? null;
  }, [activeFont]);

  const weightOptions = useMemo(() => {
    if (!selected || !isTextElement(selected)) return [300, 400, 500, 600, 700, 800, 900];
    return activeFont?.weights?.length ? activeFont.weights : [300, 400, 500, 600, 700, 800, 900];
  }, [activeFont, selected]);

  const setCanvas = (w: number, h: number) => {
    setDoc((d) => ({ ...d, width: w, height: h }), "canvas-size");
    setExportWidth(w);
  };

  const addText = () => {
    setDoc((d) => {
      const el = newTextElement(d, "New text");
      setSelectedId(el.id);
      return { ...d, elements: [...d.elements, el] };
    });
  };

  const addImageFromFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, SVG, WebP)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) return;

      const img = new Image();
      img.onload = () => {
        setDoc((d) => {
          const el = newImageElement(
            d,
            src,
            file.name.replace(/\.[^/.]+$/, ""),
            img.naturalWidth || 400,
            img.naturalHeight || 400,
          );
          setSelectedId(el.id);
          return { ...d, elements: [...d.elements, el] };
        });
        toast.success("Image added to canvas");
      };
      img.onerror = () => {
        toast.error("Could not load image");
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const replaceImageFromFile = (file: File, targetId: string) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, SVG, WebP)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) return;

      const img = new Image();
      img.onload = () => {
        const aspect =
          img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1;
        patchEl(
          targetId,
          {
            src,
            name: file.name.replace(/\.[^/.]+$/, ""),
            aspectRatio: aspect,
          },
          "replace-image",
        );
        toast.success("Image replaced");
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const moveLayer = (id: string, direction: "up" | "down" | "front" | "back") => {
    setDoc((d) => {
      const idx = d.elements.findIndex((e) => e.id === id);
      if (idx === -1) return d;
      const elements = [...d.elements];
      const [item] = elements.splice(idx, 1);
      if (!item) return d;

      if (direction === "front") {
        elements.push(item);
      } else if (direction === "back") {
        elements.unshift(item);
      } else if (direction === "up") {
        const nextIdx = Math.min(elements.length, idx + 1);
        elements.splice(nextIdx, 0, item);
      } else if (direction === "down") {
        const prevIdx = Math.max(0, idx - 1);
        elements.splice(prevIdx, 0, item);
      }

      return { ...d, elements };
    }, `layer:${direction}`);
  };

  const duplicate = () => {
    if (!selected) return;
    const offset = isTextElement(selected) ? selected.size * 0.9 : 30;
    const copy: CanvasElement = {
      ...selected,
      id: uid(),
      x: selected.x + 20,
      y: selected.y + offset,
    };
    setDoc((d) => ({ ...d, elements: [...d.elements, copy] }));
    setSelectedId(copy.id);
  };

  const remove = () => {
    if (!selected) return;
    setDoc((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== selected.id) }));
    setSelectedId(null);
  };

  const share = useCallback(async () => {
    const url = buildShareUrl(doc);
    window.history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.success("Share link is now in your address bar");
    }
  }, [doc]);

  const exportAs = async (format: "svg" | "png") => {
    if (!svgRef.current) return;
    setBusy(true);
    try {
      const textElements = doc.elements.filter(isTextElement);
      const svgString = await serializeSvg(svgRef.current, {
        width: exportWidth,
        height: exportHeight,
        fonts: textElements.map((e) => ({
          family: e.family,
          weight: e.weight,
          fontWidth: e.fontWidth,
        })),
      });
      const name = `slm-logo-${exportWidth}x${exportHeight}.${format}`;
      if (format === "svg") downloadSvg(svgString, name);
      else await downloadPng(svgString, exportWidth, exportHeight, name);
      toast.success(`Exported ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const updateImageWidth = (imgEl: ImageElement, newWidth: number) => {
    if (lockAspect && imgEl.aspectRatio > 0) {
      const newHeight = Math.max(10, Math.round(newWidth / imgEl.aspectRatio));
      patchEl(imgEl.id, { width: newWidth, height: newHeight }, "size");
    } else {
      patchEl(imgEl.id, { width: newWidth }, "size");
    }
  };

  const updateImageHeight = (imgEl: ImageElement, newHeight: number) => {
    if (lockAspect && imgEl.aspectRatio > 0) {
      const newWidth = Math.max(10, Math.round(newHeight * imgEl.aspectRatio));
      patchEl(imgEl.id, { width: newWidth, height: newHeight }, "size");
    } else {
      patchEl(imgEl.id, { height: newHeight }, "size");
    }
  };

  const exportPanel = (
    <>
      <Field label="Export width (px)">
        <Input
          type="number"
          min={16}
          max={8000}
          value={exportWidth}
          onChange={(e) => setExportWidth(Number(e.target.value) || 16)}
        />
      </Field>
      <p className="font-mono text-xs text-muted-foreground">
        Output: {exportWidth}×{exportHeight}px
      </p>
      <div className="flex flex-wrap gap-2">
        {[0.5, 1, 2, 4].map((m) => (
          <Button
            key={m}
            size="sm"
            variant="secondary"
            onClick={() => setExportWidth(Math.round(doc.width * m))}
          >
            {m}×
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button variant="outline" disabled={busy} onClick={() => exportAs("svg")}>
          <Download className="size-4" /> SVG
        </Button>
        <Button disabled={busy} onClick={() => exportAs("png")}>
          <Download className="size-4" /> PNG
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Fonts and images are embedded in the file, so exports render everywhere.
      </p>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) addImageFromFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={replaceFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && selected && isImageElement(selected)) {
            replaceImageFromFile(file, selected.id);
          }
          e.target.value = "";
        }}
      />

      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto grid max-w-375 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
              SLM
            </span>
            <div className="min-w-0 leading-tight">
              <h1 className="truncate font-display text-base font-bold sm:text-lg">
                Simple Logo Maker
              </h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                Text, images, gradients, any Google Font. Export SVG or PNG.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={share}>
              <Link2 className="size-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm">
                  <Download className="size-4" /> Export
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] space-y-4">
                {exportPanel}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-375 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="space-y-3">
          <LogoCanvas
            doc={doc}
            selectedId={activeSelectedId}
            onSelect={setSelectedId}
            onMove={(id, x, y) => patchEl(id, { x, y }, "move")}
            onRotate={(id, rotation) => patchEl(id, { rotation }, "rotate")}
            onResize={(id, patch) => patchEl(id, patch, "resize")}
            svgRef={svgRef}
            showGrid={showGrid}
            snap={snap}
            onDropImage={addImageFromFile}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={addText}>
              <Plus className="size-4" /> Add text
            </Button>
            <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" /> Add image
            </Button>
            <Button size="sm" variant="secondary" disabled={!selected} onClick={duplicate}>
              <Copy className="size-4" /> Duplicate
            </Button>
            <Button size="sm" variant="ghost" disabled={!selected} onClick={remove}>
              <Trash2 className="size-4" /> Delete
            </Button>
            <Button
              size="sm"
              variant={showGrid ? "default" : "ghost"}
              onClick={() => setShowGrid((v) => !v)}
            >
              <Grid3x3 className="size-4" /> Grid
            </Button>
            <Button
              size="sm"
              variant={snap ? "default" : "ghost"}
              onClick={() => setSnap((v) => !v)}
            >
              <Magnet className="size-4" /> Snap
            </Button>
            <Button size="sm" variant="ghost" aria-label="Undo" disabled={!canUndo} onClick={undo}>
              <Undo2 className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" aria-label="Redo" disabled={!canRedo} onClick={redo}>
              <Redo2 className="size-4" />
            </Button>

            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {doc.width}×{doc.height}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {doc.elements.map((el) => {
              const isTxt = isTextElement(el);
              const label = isTxt ? el.text || "empty text" : el.name || "Image";
              return (
                <button
                  key={el.id}
                  onClick={() => setSelectedId(el.id)}
                  className={cn(
                    "flex max-w-44 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                    el.id === activeSelectedId
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {isTxt ? (
                    <Type className="size-3 shrink-0" />
                  ) : (
                    <ImageIcon className="size-3 shrink-0" />
                  )}
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="panel h-fit p-3 lg:sticky lg:top-20">
          <Tabs defaultValue="element">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="element">
                {selected && isImageElement(selected) ? "Image" : "Text"}
              </TabsTrigger>
              <TabsTrigger value="canvas">Canvas</TabsTrigger>
              <TabsTrigger value="layers">Layers</TabsTrigger>
            </TabsList>

            <TabsContent value="element" className="mt-4 space-y-4">
              {!selected ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <p>Select an element or add one above.</p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Button size="sm" variant="outline" onClick={addText}>
                      <Plus className="size-4" /> Add text
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="size-4" /> Add image
                    </Button>
                  </div>
                </div>
              ) : isTextElement(selected) ? (
                <>
                  <Field label="Content">
                    <Input
                      value={selected.text}
                      onChange={(e) => patchEl(selected.id, { text: e.target.value }, "text")}
                    />
                  </Field>

                  <Field label="Font">
                    <FontPicker
                      fonts={fonts}
                      value={selected.family}
                      onChange={(family) => {
                        const f = fonts.find((x) => x.family === family);
                        const weight = f?.weights?.includes(selected.weight)
                          ? selected.weight
                          : (f?.weights?.[f.weights.length - 1] ?? 400);
                        const fontWdth = f?.axes?.find((a) => a.tag === "wdth");
                        const newFontWidth = fontWdth ? (fontWdth.defaultValue ?? 100) : 100;
                        loadGoogleFont(family, weight, newFontWidth);
                        patchEl(selected.id, { family, weight, fontWidth: newFontWidth });
                      }}
                    />
                  </Field>

                  <Field label="Weight">
                    <Select
                      value={String(selected.weight)}
                      onValueChange={(v) => {
                        loadGoogleFont(selected.family, Number(v), selected.fontWidth);
                        patchEl(selected.id, { weight: Number(v) });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {weightOptions.map((w) => (
                          <SelectItem key={w} value={String(w)}>
                            {w}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  {/* Variable Font Width Axis (OpenType 'wdth') */}
                  {wdthAxis && (
                    <div className="space-y-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                          <Sparkles className="size-3.5" /> Variable Width Axis
                        </span>
                        <span className="font-mono text-xs font-bold text-primary">
                          {selected.fontWidth ?? wdthAxis.defaultValue ?? 100}%
                        </span>
                      </div>
                      <Slider
                        value={[selected.fontWidth ?? wdthAxis.defaultValue ?? 100]}
                        min={Math.round(wdthAxis.min)}
                        max={Math.round(wdthAxis.max)}
                        step={1}
                        onValueChange={([v]) => {
                          const val = v ?? 100;
                          loadGoogleFont(selected.family, selected.weight, val);
                          patchEl(selected.id, { fontWidth: val }, "wdth");
                        }}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Condensed ({Math.round(wdthAxis.min)}%)</span>
                        <span>Expanded ({Math.round(wdthAxis.max)}%)</span>
                      </div>
                    </div>
                  )}

                  {/* Typography Stretch (Scale X & Scale Y) */}
                  <div className="space-y-3 rounded-lg border border-border bg-surface/60 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Typography Stretch
                      </span>
                      {((selected.scaleX && selected.scaleX !== 1) ||
                        (selected.scaleY && selected.scaleY !== 1) ||
                        (selected.fontWidth && selected.fontWidth !== 100)) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            patchEl(
                              selected.id,
                              { scaleX: 1, scaleY: 1, fontWidth: wdthAxis?.defaultValue ?? 100 },
                              "rst-stretch",
                            )
                          }
                        >
                          Reset 1:1
                        </Button>
                      )}
                    </div>
                    <Range
                      label="Horizontal Stretch (Width)"
                      value={Math.round((selected.scaleX ?? 1) * 100)}
                      min={20}
                      max={350}
                      suffix="%"
                      onChange={(v) => patchEl(selected.id, { scaleX: v / 100 }, "sx")}
                    />
                    <Range
                      label="Vertical Stretch (Height)"
                      value={Math.round((selected.scaleY ?? 1) * 100)}
                      min={20}
                      max={350}
                      suffix="%"
                      onChange={(v) => patchEl(selected.id, { scaleY: v / 100 }, "sy")}
                    />
                  </div>

                  <Range
                    label="Size"
                    value={selected.size}
                    min={8}
                    max={Math.round(Math.max(doc.width, doc.height) * 0.9)}
                    onChange={(v) => patchEl(selected.id, { size: v }, "size")}
                  />
                  <Range
                    label="Letter spacing"
                    value={selected.letterSpacing}
                    min={-20}
                    max={80}
                    onChange={(v) => patchEl(selected.id, { letterSpacing: v }, "ls")}
                  />
                  <Range
                    label="Rotation"
                    value={selected.rotation}
                    min={-180}
                    max={180}
                    suffix="°"
                    onChange={(v) => patchEl(selected.id, { rotation: v }, "rot")}
                  />
                  <Range
                    label="Opacity"
                    value={Math.round(selected.opacity * 100)}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(v) => patchEl(selected.id, { opacity: v / 100 }, "op")}
                  />

                  <Field label="Fill">
                    <FillEditor
                      value={selected.fill}
                      onChange={(patch) =>
                        patchEl(
                          selected.id,
                          { fill: { ...selected.fill, ...patch } as TextElement["fill"] },
                          "fill",
                        )
                      }
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => patchEl(selected.id, { x: Math.round(doc.width / 2) })}
                    >
                      Center X
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => patchEl(selected.id, { y: Math.round(doc.height / 2) })}
                    >
                      Center Y
                    </Button>
                  </div>

                  <Field label="Layer Order">
                    <div className="grid grid-cols-4 gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        title="Bring to front"
                        onClick={() => moveLayer(selected.id, "front")}
                      >
                        <ArrowUpToLine className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        title="Move up"
                        onClick={() => moveLayer(selected.id, "up")}
                      >
                        <MoveUp className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        title="Move down"
                        onClick={() => moveLayer(selected.id, "down")}
                      >
                        <MoveDown className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        title="Send to back"
                        onClick={() => moveLayer(selected.id, "back")}
                      >
                        <ArrowDownToLine className="size-4" />
                      </Button>
                    </div>
                  </Field>
                </>
              ) : (
                /* Image Element Inspector */
                <>
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5">
                    <div className="size-12 shrink-0 overflow-hidden rounded border border-border bg-black/20">
                      <img
                        src={selected.src}
                        alt={selected.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {selected.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {selected.width} × {selected.height} px
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Replace image"
                      onClick={() => replaceFileInputRef.current?.click()}
                    >
                      <RefreshCw className="size-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Dimensions
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => setLockAspect((v) => !v)}
                    >
                      {lockAspect ? (
                        <>
                          <Lock className="mr-1 size-3 text-primary" /> Lock Aspect
                        </>
                      ) : (
                        <>
                          <Unlock className="mr-1 size-3 text-muted-foreground" /> Free
                        </>
                      )}
                    </Button>
                  </div>

                  <Range
                    label="Width"
                    value={selected.width}
                    min={10}
                    max={Math.round(doc.width * 2)}
                    suffix="px"
                    onChange={(v) => updateImageWidth(selected, v)}
                  />

                  <Range
                    label="Height"
                    value={selected.height}
                    min={10}
                    max={Math.round(doc.height * 2)}
                    suffix="px"
                    onChange={(v) => updateImageHeight(selected, v)}
                  />

                  <Range
                    label="Corner radius"
                    value={selected.borderRadius ?? 0}
                    min={0}
                    max={Math.round(Math.min(selected.width, selected.height) / 2)}
                    suffix="px"
                    onChange={(v) => patchEl(selected.id, { borderRadius: v }, "radius")}
                  />

                  <Range
                    label="Rotation"
                    value={selected.rotation}
                    min={-180}
                    max={180}
                    suffix="°"
                    onChange={(v) => patchEl(selected.id, { rotation: v }, "rot")}
                  />

                  <Range
                    label="Opacity"
                    value={Math.round(selected.opacity * 100)}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(v) => patchEl(selected.id, { opacity: v / 100 }, "op")}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => patchEl(selected.id, { x: Math.round(doc.width / 2) })}
                    >
                      Center X
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => patchEl(selected.id, { y: Math.round(doc.height / 2) })}
                    >
                      Center Y
                    </Button>
                  </div>

                  <Field label="Layer Order">
                    <div className="grid grid-cols-4 gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        title="Bring to front"
                        onClick={() => moveLayer(selected.id, "front")}
                      >
                        <ArrowUpToLine className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        title="Move up"
                        onClick={() => moveLayer(selected.id, "up")}
                      >
                        <MoveUp className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        title="Move down"
                        onClick={() => moveLayer(selected.id, "down")}
                      >
                        <MoveDown className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        title="Send to back"
                        onClick={() => moveLayer(selected.id, "back")}
                      >
                        <ArrowDownToLine className="size-4" />
                      </Button>
                    </div>
                  </Field>
                </>
              )}
            </TabsContent>

            <TabsContent value="canvas" className="mt-4 space-y-4">
              <Field label="Preset">
                <div className="grid grid-cols-3 gap-2">
                  {CANVAS_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setCanvas(p.w, p.h)}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-xs transition-colors",
                        doc.width === p.w && doc.height === p.h
                          ? "border-primary bg-primary/15"
                          : "border-border bg-secondary/50 hover:border-muted-foreground",
                      )}
                    >
                      <span className="block font-medium">{p.label}</span>
                      <span className="block font-mono text-[10px] text-muted-foreground">
                        {p.w}×{p.h}
                      </span>
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Width">
                  <Input
                    type="number"
                    value={doc.width}
                    min={64}
                    max={4000}
                    onChange={(e) => setCanvas(Number(e.target.value) || 64, doc.height)}
                  />
                </Field>
                <Field label="Height">
                  <Input
                    type="number"
                    value={doc.height}
                    min={64}
                    max={4000}
                    onChange={(e) => setCanvas(doc.width, Number(e.target.value) || 64)}
                  />
                </Field>
              </div>

              <Field label="Background">
                <FillEditor
                  allowTransparent
                  value={doc.background}
                  onChange={(patch) =>
                    setDoc(
                      (d) => ({
                        ...d,
                        background: { ...d.background, ...patch } as LogoDoc["background"],
                      }),
                      "bg",
                    )
                  }
                />
              </Field>
            </TabsContent>

            <TabsContent value="layers" className="mt-4 space-y-3">
              {doc.elements.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No layers yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {[...doc.elements].reverse().map((el, revIdx) => {
                    const isTxt = isTextElement(el);
                    const isSel = el.id === activeSelectedId;
                    const label = isTxt ? el.text || "Empty text" : el.name || "Image";

                    return (
                      <div
                        key={el.id}
                        onClick={() => setSelectedId(el.id)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs transition-colors",
                          isSel
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-surface text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {isTxt ? (
                          <Type className="size-4 shrink-0 text-primary" />
                        ) : (
                          <ImageIcon className="size-4 shrink-0 text-emerald-400" />
                        )}
                        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
                        <div
                          className="flex items-center gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            className="size-7 p-0"
                            title="Move up"
                            onClick={() => moveLayer(el.id, "up")}
                          >
                            <MoveUp className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="size-7 p-0"
                            title="Move down"
                            onClick={() => moveLayer(el.id, "down")}
                          >
                            <MoveDown className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="size-7 p-0 text-destructive hover:text-destructive"
                            title="Delete"
                            onClick={() => {
                              setDoc((d) => ({
                                ...d,
                                elements: d.elements.filter((x) => x.id !== el.id),
                              }));
                              if (selectedId === el.id) setSelectedId(null);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </aside>
      </main>

      <footer className="mt-8 border-t border-border/40 py-4 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-375 flex-wrap items-center justify-between gap-3 px-4">
          <p className="font-display font-medium text-foreground/80">SLM - Simple Logo Maker</p>
          <a
            href="https://github.com/GamerJagdish/slm"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>GitHub</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Range({
  label,
  value,
  min,
  max,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="font-mono">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v ?? 0)}
      />
    </div>
  );
}
