import { useCallback, useEffect, useRef, useState } from "react";
import { angleToCoords, type LogoDoc } from "@/lib/logo";

type Props = {
  doc: LogoDoc;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
  showGrid?: boolean;
  snap?: boolean;
};

export function LogoCanvas({
  doc,
  selectedId,
  onSelect,
  onMove,
  svgRef,
  showGrid = false,
  snap = true,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);

  const measure = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !selectedId) return setBox(null);
    const node = svg.querySelector<SVGTextElement>(`[data-el="${selectedId}"]`);
    if (!node) return setBox(null);
    const b = node.getBBox();
    setBox({ x: b.x, y: b.y, w: b.width, h: b.height });
  }, [selectedId, svgRef]);

  useEffect(() => {
    measure();
    const t = setTimeout(measure, 300);
    const t2 = setTimeout(measure, 1200);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [measure, doc]);

  useEffect(() => {
    if (typeof document === "undefined" || !("fonts" in document)) return;
    (document as Document).fonts.ready.then(measure).catch(() => {});
  }, [measure, doc]);

  const scale = () => {
    const svg = svgRef.current;
    if (!svg) return 1;
    return svg.getBoundingClientRect().width / doc.width || 1;
  };

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    onSelect(id);
    const el = doc.elements.find((n) => n.id === id);
    if (!el) return;
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y };
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
    const d = drag.current;
    if (!d) return;
    const s = scale();
    let x = Math.round(d.ox + (e.clientX - d.sx) / s);
    let y = Math.round(d.oy + (e.clientY - d.sy) / s);

    const hits: { v: number[]; h: number[] } = { v: [], h: [] };
    if (snap) {
      const tol = 8 / s;
      const others = doc.elements.filter((el) => el.id !== d.id);
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
    onMove(d.id, x, y);
  };

  const endDrag = () => {
    drag.current = null;
    setGuides({ v: [], h: [] });
    measure();
  };

  const bg = doc.background;
  const bgCoords = angleToCoords(bg.angle);

  return (
    <div ref={wrapRef} className="flex w-full items-center justify-center">
      <div
        className="checkerboard relative max-h-[62vh] w-full overflow-hidden rounded-xl border border-border shadow-2xl"
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

          {doc.elements.map((el) => (
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
              onPointerDown={(e) => onPointerDown(e, el.id)}
            >
              {el.text}
            </text>
          ))}

          {box && selectedId && (
            <g data-editor-only="true" pointerEvents="none">
              <rect
                x={box.x - 8}
                y={box.y - 8}
                width={box.w + 16}
                height={box.h + 16}
                fill="none"
                stroke="oklch(0.88 0.21 125)"
                strokeWidth={Math.max(1.5, doc.width / 500)}
                strokeDasharray={`${doc.width / 90} ${doc.width / 90}`}
              />
            </g>
          )}

          {(guides.v.length > 0 || guides.h.length > 0) && (
            <g data-editor-only="true" pointerEvents="none">
              {guides.v.map((x) => (
                <line
                  key={`sv${x}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={doc.height}
                  stroke="oklch(0.88 0.21 125)"
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
                  stroke="oklch(0.88 0.21 125)"
                  strokeWidth={Math.max(1.5, doc.width / 600)}
                />
              ))}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
