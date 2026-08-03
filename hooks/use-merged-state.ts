"use client";

import { useCallback, useState } from "react";

type Updater<S> = Partial<S> | ((prev: S) => Partial<S>);

/**
 * `useState` variant with class-component style partial merging
 * (`setState({ field })` / `setState(prev => ({ field }))`).
 *
 * The original design-handoff pages were written against a class-based
 * runtime; this hook lets their interaction logic port over 1:1 while
 * remaining a functional component (CODING-STANDARDS.md).
 */
export function useMergedState<S extends object>(initial: S) {
  const [state, set] = useState<S>(initial);

  const setState = useCallback((updater: Updater<S>) => {
    set((prev) => ({
      ...prev,
      ...(typeof updater === "function" ? updater(prev) : updater),
    }));
  }, []);

  return [state, setState] as const;
}
