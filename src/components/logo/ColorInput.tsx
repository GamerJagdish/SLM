import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (color: string) => void;
  className?: string;
};

/**
 * Native color input that keeps the swatch instantly responsive while dragging
 * by holding a local value and flushing upstream at most once per frame.
 */
export function ColorInput({ value, onChange, className }: Props) {
  const [local, setLocal] = useState(value);
  const dragging = useRef(false);
  const frame = useRef<number | null>(null);
  const pending = useRef<string | null>(null);

  useEffect(() => {
    if (!dragging.current) setLocal(value);
  }, [value]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const flush = () => {
    frame.current = null;
    if (pending.current !== null) {
      const next = pending.current;
      pending.current = null;
      onChange(next);
    }
  };

  return (
    <input
      type="color"
      value={local}
      className={className}
      onChange={(e) => {
        const next = e.target.value;
        dragging.current = true;
        setLocal(next);
        pending.current = next;
        if (frame.current === null) frame.current = requestAnimationFrame(flush);
      }}
      onBlur={() => {
        dragging.current = false;
        if (frame.current !== null) {
          cancelAnimationFrame(frame.current);
          flush();
        }
      }}
    />
  );
}
