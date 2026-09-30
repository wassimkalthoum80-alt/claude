import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { SimulationState } from '../../sim';
import { useEngine } from './EngineContext';

/**
 * Subscribe a component to part of the simulation snapshot. The component re-renders only when the
 * selected value changes (by `isEqual`), so 10 Hz ticks do not re-render unrelated panels.
 */
export function useEngineSelector<T>(
  selector: (state: Readonly<SimulationState>) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const engine = useEngine();
  const cache = useRef<{ snapshot: Readonly<SimulationState>; value: T } | null>(null);
  const getSelection = useCallback((): T => {
    const snapshot = engine.getSnapshot();
    const cached = cache.current;
    if (cached && cached.snapshot === snapshot) return cached.value;
    const next = selector(snapshot);
    if (cached && isEqual(cached.value, next)) {
      cache.current = { snapshot, value: cached.value };
      return cached.value;
    }
    cache.current = { snapshot, value: next };
    return next;
  }, [engine, selector, isEqual]);
  return useSyncExternalStore(engine.subscribe, getSelection, getSelection);
}

/** Shallow equality for flat view-model objects. */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  return ka.every((k) => Object.is(ra[k], rb[k]));
}

/** Structural equality for small plain view models (objects, arrays, primitives). */
export function deepEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ka = Object.keys(ra);
  if (ka.length !== Object.keys(rb).length) return false;
  return ka.every((k) => deepEqual(ra[k], rb[k]));
}
