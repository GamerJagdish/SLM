import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Download,
  Grid3x3,
  Link2,
  Magnet,
  Plus,
  Redo2,
  Trash2,
  Type,
  Undo2,
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
import { CANVAS_PRESETS, newTextElement, uid, type LogoDoc, type TextElement } from "@/lib/logo";
import { cn } from "@/lib/utils";

const TITLE = "SLM - Simple Logo Maker";
const DESC =
  "Design a logo in your browser: pick a canvas, add text with any Google Font, apply gradients, then export SVG or PNG at any size.";

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
    reset: resetDoc,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<LogoDoc>(initialDoc);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportWidth, setExportWidth] = useState(800);
  const [busy, setBusy] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [snap, setSnap] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  // Restore from a share link (?d=...) or the last local autosave.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("d");
    const shared = code ? decodeDoc(code) : null;
    if (shared) {
      resetDoc(shared);
      setExportWidth(shared.width);
      toast.success("Loaded shared design");
      return;
    }
    const local = loadLocal();
    if (local) {
      resetDoc(local);
      setExportWidth(local.width);
    }
  }, [resetDoc]);

  useEffect(() => {
    const t = setTimeout(() => saveLocal(doc), 400);
    return () => clearTimeout(t);
  }, [doc]);

  useEffect(() => {
    if (!selectedId && doc.elements[0]) setSelectedId(doc.elements[0].id);
  }, [doc.elements, selectedId]);

  useEffect(() => {
    doc.elements.forEach((el) => loadGoogleFont(el.family, el.weight));
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

  const selected = doc.elements.find((e) => e.id === selectedId) ?? null;
  const ratio = doc.height / doc.width;
  const exportHeight = Math.round(exportWidth * ratio);

  const patchEl = (id: string, patch: Partial<TextElement>, label = "") =>
    setDoc(
      (d) => ({
        ...d,
        elements: d.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }),
      label ? `${label}:${id}` : "",
    );

  const weightOptions = useMemo(() => {
    const f = fonts.find((x) => x.family === selected?.family);
    return f?.weights?.length ? f.weights : [300, 400, 500, 600, 700, 800, 900];
  }, [fonts, selected?.family]);

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

  const duplicate = () => {
    if (!selected) return;
    const copy = { ...selected, id: uid(), y: selected.y + selected.size * 0.9 };
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
      const svgString = await serializeSvg(svgRef.current, {
        width: exportWidth,
        height: exportHeight,
        fonts: doc.elements.map((e) => ({ family: e.family, weight: e.weight })),
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
        Fonts are embedded in the file, so exports render everywhere.
      </p>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" />
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto grid max-w-[1500px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
              SLM
            </span>
            <div className="min-w-0 leading-tight">
              <h1 className="truncate font-display text-base font-bold sm:text-lg">
                Simple Logo Maker
              </h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                Text, gradients, any Google Font. Export SVG or PNG.
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

      <main className="mx-auto grid max-w-[1500px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="space-y-3">
          <LogoCanvas
            doc={doc}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={(id, x, y) => patchEl(id, { x, y }, "move")}
            svgRef={svgRef}
            showGrid={showGrid}
            snap={snap}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={addText}>
              <Plus className="size-4" /> Add text
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
            {doc.elements.map((el) => (
              <button
                key={el.id}
                onClick={() => setSelectedId(el.id)}
                className={cn(
                  "flex max-w-40 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                  el.id === selectedId
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                <Type className="size-3 shrink-0" />
                <span className="truncate">{el.text || "empty"}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="panel h-fit p-3 lg:sticky lg:top-20">
          <Tabs defaultValue="text">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="canvas">Canvas</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-4 space-y-4">
              {!selected ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Select or add a text element.
                </p>
              ) : (
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
                        loadGoogleFont(family, weight);
                        patchEl(selected.id, { family, weight });
                      }}
                    />
                  </Field>

                  <Field label="Weight">
                    <Select
                      value={String(selected.weight)}
                      onValueChange={(v) => {
                        loadGoogleFont(selected.family, Number(v));
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
          </Tabs>
        </aside>
      </main>
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
