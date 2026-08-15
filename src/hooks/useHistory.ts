import { useCallback, useRef, useState } from "react";

type Updater<T> = T | ((prev: T) => T);

/** State with undo/redo. Consecutive updates sharing a `label` within 600ms coalesce. */
export function useHistory<T>(initial: T | (() => T)) {
  const [state, setState] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const last = useRef<{ label: string; at: number }>({ label: "", at: 0 });
  const [version, bump] = useState(0);

  const set = useCallback((updater: Updater<T>, label = "") => {
    setState((prev) => {
      const next = typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
      if (Object.is(next, prev)) return prev;
      const now = Date.now();
      const coalesce = label !== "" && label === last.current.label && now - last.current.at < 600;
      if (!coalesce) {
        past.current = [...past.current.slice(-99), prev];
        future.current = [];
      }
      last.current = { label, at: now };
      bump((v) => v + 1);
      return next;
    });
  }, []);

  /** Replace state without touching history (e.g. loading a shared doc). */
  const reset = useCallback((next: T) => {
    past.current = [];
    future.current = [];
    last.current = { label: "", at: 0 };
    bump((v) => v + 1);
    setState(next);
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      const p = past.current.pop();
      if (p === undefined) return prev;
      future.current = [...future.current, prev];
      last.current = { label: "", at: 0 };
      bump((v) => v + 1);
      return p;
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      const f = future.current.pop();
      if (f === undefined) return prev;
      past.current = [...past.current, prev];
      last.current = { label: "", at: 0 };
      bump((v) => v + 1);
      return f;
    });
  }, []);

  return {
    state,
    set,
    reset,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    version,
  };
}
