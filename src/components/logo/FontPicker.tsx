import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadGoogleFont } from "@/lib/font-loader";
import type { GoogleFont } from "@/lib/fonts.functions";

type Props = {
  fonts: GoogleFont[];
  value: string;
  onChange: (family: string) => void;
};

export function FontPicker({ fonts, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(40);
  const listRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? fonts.filter((f) => f.family.toLowerCase().includes(needle)) : fonts;
  }, [fonts, q]);

  const results = useMemo(() => matches.slice(0, limit), [matches, limit]);

  useEffect(() => {
    setLimit(40);
    listRef.current?.scrollTo({ top: 0 });
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    results.forEach((f) => loadGoogleFont(f.family, 400));
  }, [open, results]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 240) {
      setLimit((l) => (l >= matches.length ? l : l + 40));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 w-full justify-between bg-secondary/60 font-normal"
          style={{ fontFamily: `'${value}', sans-serif` }}
        >
          <span className="truncate">{value}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,90vw)] p-0" align="start">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 opacity-50" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${fonts.length} Google Fonts`}
            className="h-10 border-0 bg-transparent px-0 focus-visible:ring-0"
          />
        </div>
        <div
          ref={listRef}
          onScroll={onScroll}
          className="no-scrollbar max-h-72 overflow-y-auto py-1"
        >
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No fonts found</p>
          )}
          {results.map((f) => (
            <button
              key={f.family}
              type="button"
              onClick={() => {
                loadGoogleFont(f.family, 400);
                onChange(f.family);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-base hover:bg-accent"
              style={{ fontFamily: `'${f.family}', sans-serif` }}
            >
              <span className="truncate">{f.family}</span>
              {f.family === value && <Check className="size-4 shrink-0 text-primary" />}
            </button>
          ))}
          {results.length < matches.length && (
            <p className="px-3 py-3 text-center text-xs text-muted-foreground">Loading more…</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
