import { useCallback, useRef, useState } from "react";

type Updater<T> = T | ((prev: T) => T);

type HistoryState<T> = {
  present: T;
  past: T[];
  future: T[];
};

/** State with undo/redo. Consecutive updates sharing a `label` within 600ms coalesce. */
export function useHistory<T>(initial: T | (() => T)) {
  const [history, setHistory] = useState<HistoryState<T>>(() => ({
    present: typeof initial === "function" ? (initial as () => T)() : initial,
    past: [],
    future: [],
  }));
  const last = useRef<{ label: string; at: number }>({ label: "", at: 0 });

  const set = useCallback((updater: Updater<T>, label = "") => {
    setHistory((prevHistory) => {
      const nextPresent =
        typeof updater === "function" ? (updater as (p: T) => T)(prevHistory.present) : updater;
      if (Object.is(nextPresent, prevHistory.present)) return prevHistory;
      const now = Date.now();
      const coalesce = label !== "" && label === last.current.label && now - last.current.at < 600;
      last.current = { label, at: now };

      if (coalesce) {
        return {
          ...prevHistory,
          present: nextPresent,
        };
      }
      return {
        past: [...prevHistory.past.slice(-99), prevHistory.present],
        present: nextPresent,
        future: [],
      };
    });
  }, []);

  /** Replace state without touching history (e.g. loading a shared doc). */
  const reset = useCallback((next: T) => {
    last.current = { label: "", at: 0 };
    setHistory({
      past: [],
      present: next,
      future: [],
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((prevHistory) => {
      if (prevHistory.past.length === 0) return prevHistory;
      const previous = prevHistory.past[prevHistory.past.length - 1];
      const newPast = prevHistory.past.slice(0, -1);
      last.current = { label: "", at: 0 };
      return {
        past: newPast,
        present: previous,
        future: [prevHistory.present, ...prevHistory.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((prevHistory) => {
      if (prevHistory.future.length === 0) return prevHistory;
      const next = prevHistory.future[0];
      const newFuture = prevHistory.future.slice(1);
      last.current = { label: "", at: 0 };
      return {
        past: [...prevHistory.past, prevHistory.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  return {
    state: history.present,
    set,
    reset,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    version: history.past.length + history.future.length,
  };
}
