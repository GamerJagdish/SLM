import { ColorInput } from "./ColorInput";
import { Slider } from "@/components/ui/slider";
import { cssGradient, GRADIENT_PRESETS, type GradientStop } from "@/lib/logo";
import { cn } from "@/lib/utils";

type Kind = "solid" | "linear" | "radial";

type Value = {
  type: Kind | "transparent";
  color: string;
  stops: GradientStop[];
  angle: number;
};

type Props = {
  value: Value;
  onChange: (patch: Partial<Value>) => void;
  allowTransparent?: boolean;
};

const LABELS: Record<string, string> = {
  transparent: "None",
  solid: "Solid",
  linear: "Linear",
  radial: "Radial",
};

export function FillEditor({ value, onChange, allowTransparent }: Props) {
  const types: (Kind | "transparent")[] = allowTransparent
    ? ["transparent", "solid", "linear", "radial"]
    : ["solid", "linear", "radial"];

  const setStop = (i: number, patch: Partial<GradientStop>) => {
    const stops = value.stops.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange({ stops });
  };

  return (
    <div className="space-y-3">
      <div
        className="grid grid-cols-4 gap-1 rounded-lg bg-secondary/60 p-1"
        style={{ gridTemplateColumns: `repeat(${types.length}, minmax(0,1fr))` }}
      >
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ type: t })}
            className={cn(
              "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              value.type === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LABELS[t]}
          </button>
        ))}
      </div>

      {value.type === "solid" && (
        <div className="flex items-center gap-3">
          <ColorInput
            value={value.color}
            onChange={(color) => onChange({ color })}
            className="h-10 w-14 rounded-lg"
          />
          <input
            value={value.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="h-10 flex-1 rounded-lg border border-border bg-secondary/60 px-3 font-mono text-sm uppercase outline-none focus:border-primary"
          />
        </div>
      )}

      {(value.type === "linear" || value.type === "radial") && (
        <div className="space-y-3">
          <div
            className="h-10 rounded-lg border border-border"
            style={{ background: cssGradient(value.type, value.stops, value.angle) }}
          />
          <div className="grid grid-cols-2 gap-2">
            {value.stops.map((s, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-secondary/60 p-1.5">
                <ColorInput
                  value={s.color}
                  onChange={(color) => setStop(i, { color })}
                  className="h-7 w-9 rounded-md"
                />
                <span className="font-mono text-xs uppercase text-muted-foreground">{s.color}</span>
              </div>
            ))}
          </div>
          {value.type === "linear" && (
            <label className="block space-y-1.5">
              <span className="flex justify-between text-xs text-muted-foreground">
                <span>Angle</span>
                <span className="font-mono">{value.angle}°</span>
              </span>
              <Slider
                value={[value.angle]}
                min={0}
                max={360}
                step={1}
                onValueChange={([v]) => onChange({ angle: v ?? 0 })}
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {GRADIENT_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                title={p.name}
                onClick={() => onChange({ stops: p.stops.map((s) => ({ ...s })) })}
                className="size-8 rounded-full border border-border transition-transform hover:scale-110"
                style={{ background: cssGradient("linear", p.stops, value.angle) }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
