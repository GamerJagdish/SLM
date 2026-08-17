import { useCallback, useEffect, useRef, useState } from "react";
import {
  angleToCoords,
  isImageElement,
  isTextElement,
  type CanvasElement,
  type LogoDoc,
} from "@/lib/logo";
import { cn } from "@/lib/utils";

type Props = {
  doc: LogoDoc;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onRotate?: (id: string, rotation: number) => void;
  onResize?: (id: string, patch: Partial<CanvasElement>) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
  showGrid?: boolean;
  snap?: boolean;
  onDropImage?: (file: File) => void;
};

type DragAction =
  | {
      type: "move";
      id: string;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    }
  | {
      type: "rotate";
      id: string;
      centerX: number;
      centerY: number;
      startAngle: number;
      originRotation: number;
    }
  | {
      type: "resize";
      id: string;
      handle: "nw" | "ne" | "se" | "sw";
      centerX: number;
      centerY: number;
      startDist: number;
      startWidth: number;
      startHeight: number;
      startSize?: number;
      isText: boolean;
    };

export function LogoCanvas({
  doc,
  selectedId,
  onSelect,
  onMove,
  onRotate,
  onResize,
  svgRef,
  showGrid = false,
  snap = true,
  onDropImage,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [measuredText, setMeasuredText] = useState<Record<string, { w: number; h: number }>>({});
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const dragAction = useRef<DragAction | null>(null);

  const measure = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const newMeasured: Record<string, { w: number; h: number }> = {};
    doc.elements.filter(isTextElement).forEach((el) => {
      const node = svg.querySelector<SVGTextElement>(`text[data-el="${el.id}"]`);
      if (node) {
        try {
          const b = node.getBBox();
          newMeasured[el.id] = { w: Math.max(20, b.width), h: Math.max(20, b.height) };
        } catch {
          newMeasured[el.id] = {
            w: Math.max(20, el.size * (el.text?.length || 1) * 0.6),
            h: Math.max(20, el.size),
          };
        }
      }
    });
    setMeasuredText(newMeasured);
  }, [doc.elements, svgRef]);

  useEffect(() => {
    measure();
    const t = setTimeout(measure, 150);
    const t2 = setTimeout(measure, 600);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [measure, doc]);

  useEffect(() => {
    if (typeof document === "undefined" || !("fonts" in document)) return;
    (document as Document).fonts.ready.then(measure).catch(() => {});
  }, [measure, doc]);

  const getCanvasPoint = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - r.left) / r.width) * doc.width,
      y: ((e.clientY - r.top) / r.height) * doc.height,
    };
  };

  const onPointerDownMove = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    onSelect(id);
    const el = doc.elements.find((n) => n.id === id);
    if (!el) return;
    const pt = getCanvasPoint(e);
    dragAction.current = {
      type: "move",
      id,
      startX: pt.x,
      startY: pt.y,
      originX: el.x,
      originY: el.y,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerDownRotate = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const el = doc.elements.find((n) => n.id === id);
    if (!el) return;
    const pt = getCanvasPoint(e);
    const startAngle = (Math.atan2(pt.y - el.y, pt.x - el.x) * 180) / Math.PI;
    dragAction.current = {
      type: "rotate",
      id,
      centerX: el.x,
      centerY: el.y,
      startAngle,
      originRotation: el.rotation,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerDownResize = (
    e: React.PointerEvent,
    id: string,
    handle: "nw" | "ne" | "se" | "sw",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const el = doc.elements.find((n) => n.id === id);
    if (!el) return;
    const pt = getCanvasPoint(e);
    const startDist = Math.hypot(pt.x - el.x, pt.y - el.y);
    const isText = isTextElement(el);

    dragAction.current = {
      type: "resize",
      id,
      handle,
      centerX: el.x,
      centerY: el.y,
      startDist: Math.max(startDist, 10),
      startWidth: isText ? el.size : el.width,
      startHeight: isText ? el.size : el.height,
      startSize: isText ? el.size : undefined,
      isText,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const snapAxis = (value: number, targets: number[], tol: number) => {
    let best: number | null = null;
    let dist = tol;
    for (const t of targets) {
      const d = Math.abs(t - value);
      if (d <= dist) {
        dist = d;
        best = t;
      }
    }
    return best;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const act = dragAction.current;
    if (!act) return;
    const pt = getCanvasPoint(e);

    if (act.type === "move") {
      let x = Math.round(act.originX + (pt.x - act.startX));
      let y = Math.round(act.originY + (pt.y - act.startY));

      const hits: { v: number[]; h: number[] } = { v: [], h: [] };
      if (snap) {
        const tol = 8;
        const others = doc.elements.filter((el) => el.id !== act.id);
        const vt = [doc.width / 2, ...others.map((o) => o.x)];
        const ht = [doc.height / 2, ...others.map((o) => o.y)];
        const sx = snapAxis(x, vt, tol);
        const sy = snapAxis(y, ht, tol);
        if (sx !== null) {
          x = Math.round(sx);
          hits.v.push(x);
        }
        if (sy !== null) {
          y = Math.round(sy);
          hits.h.push(y);
        }
      }
      setGuides(hits);
      onMove(act.id, x, y);
    } else if (act.type === "rotate") {
      const curAngle = (Math.atan2(pt.y - act.centerY, pt.x - act.centerX) * 180) / Math.PI;
      const delta = curAngle - act.startAngle;
      let rot = Math.round(act.originRotation + delta);

      while (rot > 180) rot -= 360;
      while (rot < -180) rot += 360;

      // Snap to cardinal angles (0, 45, 90, 135, 180, -45, -90, -135) within 3.5 degrees
      const snapAngles = [-180, -135, -90, -45, 0, 45, 90, 135, 180];
      for (const sa of snapAngles) {
        if (Math.abs(rot - sa) <= 3.5) {
          rot = sa === -180 ? 180 : sa;
          break;
        }
      }

      onRotate?.(act.id, rot);
    } else if (act.type === "resize") {
      const curDist = Math.hypot(pt.x - act.centerX, pt.y - act.centerY);
      const scale = Math.max(0.08, curDist / act.startDist);

      if (act.isText) {
        const newSize = Math.max(
          8,
          Math.min(Math.round((act.startSize || 32) * scale), Math.max(doc.width, doc.height) * 2),
        );
        onResize?.(act.id, { size: newSize });
      } else {
        const newWidth = Math.max(16, Math.round(act.startWidth * scale));
        const newHeight = Math.max(16, Math.round(act.startHeight * scale));
        onResize?.(act.id, { width: newWidth, height: newHeight });
      }
    }
  };

  const endDrag = () => {
    dragAction.current = null;
    setGuides({ v: [], h: [] });
    measure();
  };

  const bg = doc.background;
  const bgCoords = angleToCoords(bg.angle);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!onDropImage) return;
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      onDropImage(file);
    }
  };

  const selectedEl = doc.elements.find((e) => e.id === selectedId) ?? null;

  // Compute bounding box dimensions for selected element
  let selW = 0;
  let selH = 0;
  if (selectedEl) {
    if (isImageElement(selectedEl)) {
      selW = selectedEl.width;
      selH = selectedEl.height;
    } else if (isTextElement(selectedEl)) {
      const m = measuredText[selectedEl.id];
      selW = m?.w || Math.max(20, selectedEl.size * (selectedEl.text?.length || 1) * 0.6);
      selH = m?.h || Math.max(20, selectedEl.size);
    }
  }

  const ACCENT_COLOR = "oklch(0.88 0.21 125)";
  const pad = Math.max(6, doc.width / 150);
  const strokeWidth = Math.max(1.5, doc.width / 500);
  const cornerR = Math.max(5, doc.width / 130);
  const rotateR = Math.max(11, doc.width / 65);
  const rotateOffset = Math.max(28, doc.width / 24);

  return (
    <div
      ref={wrapRef}
      className="flex w-full items-center justify-center"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={cn(
          "checkerboard relative max-h-[62vh] w-full overflow-hidden rounded-xl border shadow-2xl transition-all",
          isDragOver ? "border-primary ring-2 ring-primary/50" : "border-border",
        )}
        style={{
          aspectRatio: `${doc.width} / ${doc.height}`,
          maxWidth: `min(100%, ${(doc.width / doc.height) * 62}vh)`,
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${doc.width} ${doc.height}`}
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          className="block h-full w-full touch-none select-none"
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onSelect(null);
          }}
        >
          <defs>
            {bg.type === "linear" && (
              <linearGradient
                id="slm-bg"
                x1={bgCoords.x1}
                y1={bgCoords.y1}
                x2={bgCoords.x2}
                y2={bgCoords.y2}
              >
                {bg.stops.map((s, i) => (
                  <stop key={i} offset={s.offset} stopColor={s.color} />
                ))}
              </linearGradient>
            )}
            {bg.type === "radial" && (
              <radialGradient id="slm-bg" cx="0.5" cy="0.5" r="0.75">
                {bg.stops.map((s, i) => (
                  <stop key={i} offset={s.offset} stopColor={s.color} />
                ))}
              </radialGradient>
            )}
            {doc.elements.map((el) => {
              if (!isTextElement(el)) return null;
              if (el.fill.type === "solid") return null;
              const c = angleToCoords(el.fill.angle);
              const id = `slm-fill-${el.id}`;
              return el.fill.type === "linear" ? (
                <linearGradient key={id} id={id} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}>
                  {el.fill.stops.map((s, i) => (
                    <stop key={i} offset={s.offset} stopColor={s.color} />
                  ))}
                </linearGradient>
              ) : (
                <radialGradient key={id} id={id} cx="0.5" cy="0.5" r="0.75">
                  {el.fill.stops.map((s, i) => (
                    <stop key={i} offset={s.offset} stopColor={s.color} />
                  ))}
                </radialGradient>
              );
            })}
          </defs>

          {bg.type !== "transparent" && (
            <rect
              x={0}
              y={0}
              width={doc.width}
              height={doc.height}
              fill={bg.type === "solid" ? bg.color : "url(#slm-bg)"}
            />
          )}

          {showGrid && (
            <g data-editor-only="true" pointerEvents="none" style={{ mixBlendMode: "difference" }}>
              {Array.from({ length: 11 }, (_, i) => i + 1).map((i) => (
                <line
                  key={`gv${i}`}
                  x1={(doc.width / 12) * i}
                  y1={0}
                  x2={(doc.width / 12) * i}
                  y2={doc.height}
                  stroke="#ffffff"
                  strokeOpacity={i === 6 ? 0.55 : 0.28}
                  strokeWidth={Math.max(1, doc.width / 900)}
                />
              ))}
              {Array.from({ length: 11 }, (_, i) => i + 1).map((i) => (
                <line
                  key={`gh${i}`}
                  x1={0}
                  y1={(doc.height / 12) * i}
                  x2={doc.width}
                  y2={(doc.height / 12) * i}
                  stroke="#ffffff"
                  strokeOpacity={i === 6 ? 0.55 : 0.28}
                  strokeWidth={Math.max(1, doc.width / 900)}
                />
              ))}
            </g>
          )}

          {doc.elements.map((el) => {
            if (isTextElement(el)) {
              return (
                <text
                  key={el.id}
                  data-el={el.id}
                  x={el.x}
                  y={el.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily={`'${el.family}'`}
                  fontWeight={el.weight}
                  fontSize={el.size}
                  letterSpacing={el.letterSpacing}
                  opacity={el.opacity}
                  fill={el.fill.type === "solid" ? el.fill.color : `url(#slm-fill-${el.id})`}
                  transform={`rotate(${el.rotation} ${el.x} ${el.y})`}
                  style={{ cursor: "move" }}
                  onPointerDown={(e) => onPointerDownMove(e, el.id)}
                >
                  {el.text}
                </text>
              );
            }

            if (isImageElement(el)) {
              const clipId =
                el.borderRadius && el.borderRadius > 0 ? `slm-clip-${el.id}` : undefined;
              return (
                <g
                  key={el.id}
                  data-el={el.id}
                  transform={`translate(${el.x}, ${el.y}) rotate(${el.rotation})`}
                  opacity={el.opacity}
                  style={{ cursor: "move" }}
                  onPointerDown={(e) => onPointerDownMove(e, el.id)}
                >
                  {clipId && (
                    <defs>
                      <clipPath id={clipId}>
                        <rect
                          x={-el.width / 2}
                          y={-el.height / 2}
                          width={el.width}
                          height={el.height}
                          rx={el.borderRadius}
                          ry={el.borderRadius}
                        />
                      </clipPath>
                    </defs>
                  )}
                  <image
                    href={el.src}
                    x={-el.width / 2}
                    y={-el.height / 2}
                    width={el.width}
                    height={el.height}
                    preserveAspectRatio="none"
                    clipPath={clipId ? `url(#${clipId})` : undefined}
                    style={{ pointerEvents: "auto" }}
                  />
                </g>
              );
            }

            return null;
          })}

          {/* Canva-style Selection Box, Corner Scaling Handles & Rotation Handle */}
          {selectedEl && selW > 0 && selH > 0 && (
            <g
              data-editor-only="true"
              transform={`translate(${selectedEl.x}, ${selectedEl.y}) rotate(${selectedEl.rotation})`}
            >
              {/* Dotted border around element */}
              <rect
                x={-selW / 2 - pad}
                y={-selH / 2 - pad}
                width={selW + pad * 2}
                height={selH + pad * 2}
                fill="none"
                stroke={ACCENT_COLOR}
                strokeWidth={strokeWidth}
                strokeDasharray={`${doc.width / 100} ${doc.width / 100}`}
                rx={3}
                pointerEvents="none"
              />

              {/* 4 Corner Scaling Handles */}
              {(
                [
                  { handle: "nw", cx: -selW / 2 - pad, cy: -selH / 2 - pad, cursor: "nwse-resize" },
                  { handle: "ne", cx: selW / 2 + pad, cy: -selH / 2 - pad, cursor: "nesw-resize" },
                  { handle: "se", cx: selW / 2 + pad, cy: selH / 2 + pad, cursor: "nwse-resize" },
                  { handle: "sw", cx: -selW / 2 - pad, cy: selH / 2 + pad, cursor: "nesw-resize" },
                ] as const
              ).map(({ handle, cx, cy, cursor }) => (
                <g key={handle} transform={`translate(${cx}, ${cy})`}>
                  {/* Invisible larger hit target for easy touch / clicking */}
                  <circle
                    r={cornerR * 2.2}
                    fill="transparent"
                    style={{ cursor }}
                    onPointerDown={(e) => onPointerDownResize(e, selectedEl.id, handle)}
                  />
                  {/* Visible white handle knob */}
                  <circle
                    r={cornerR}
                    fill="#ffffff"
                    stroke={ACCENT_COLOR}
                    strokeWidth={strokeWidth * 1.2}
                    style={{ cursor, pointerEvents: "none" }}
                  />
                </g>
              ))}

              {/* Stem line to Rotation Button */}
              <line
                x1={0}
                y1={selH / 2 + pad}
                x2={0}
                y2={selH / 2 + pad + rotateOffset}
                stroke={ACCENT_COLOR}
                strokeWidth={strokeWidth}
                strokeDasharray="3 3"
                pointerEvents="none"
              />

              {/* Rotation Handle Button (Canva UI Style) */}
              <g
                transform={`translate(0, ${selH / 2 + pad + rotateOffset})`}
                onPointerDown={(e) => onPointerDownRotate(e, selectedEl.id)}
                style={{ cursor: "grab" }}
              >
                {/* Large invisible hit area */}
                <circle r={rotateR * 1.8} fill="transparent" />
                {/* Button background circle */}
                <circle
                  r={rotateR}
                  fill="#ffffff"
                  stroke={ACCENT_COLOR}
                  strokeWidth={strokeWidth * 1.2}
                />
                {/* Rotate icon (circular arrows) */}
                <g transform="scale(0.85)">
                  <path
                    d="M-5 -2 A 6 6 0 1 1 -2 5.5"
                    fill="none"
                    stroke="#111827"
                    strokeWidth={Math.max(1.4, doc.width / 500)}
                    strokeLinecap="round"
                  />
                  <path
                    d="M-6.5 -4.5 L -5 -2 L -2.5 -4"
                    fill="none"
                    stroke="#111827"
                    strokeWidth={Math.max(1.4, doc.width / 500)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              </g>
            </g>
          )}

          {/* Alignment Snapping Guide Lines */}
          {(guides.v.length > 0 || guides.h.length > 0) && (
            <g data-editor-only="true" pointerEvents="none">
              {guides.v.map((x) => (
                <line
                  key={`sv${x}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={doc.height}
                  stroke={ACCENT_COLOR}
                  strokeWidth={Math.max(1.5, doc.width / 600)}
                />
              ))}
              {guides.h.map((y) => (
                <line
                  key={`sh${y}`}
                  x1={0}
                  y1={y}
                  x2={doc.width}
                  y2={y}
                  stroke={ACCENT_COLOR}
                  strokeWidth={Math.max(1.5, doc.width / 600)}
                />
              ))}
            </g>
          )}
        </svg>

        {isDragOver && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs">
            <p className="text-sm font-medium text-foreground">Drop image here to add to canvas</p>
          </div>
        )}
      </div>
    </div>
  );
}
