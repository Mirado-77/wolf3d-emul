import { useEffect, useRef } from "react";

/** requestAnimationFrame loop that only runs while `running` is true. dt in seconds, capped. */
export function useAnimationFrame(cb: (dt: number, t: number) => void, running: boolean) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    if (!running) return;
    let id = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      cbRef.current(dt, now / 1000);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [running]);
}

/** Keys currently held, recorded only while `target` has focus. */
export function useKeys(target: React.RefObject<HTMLElement | null>, onPress?: (key: string, e: KeyboardEvent) => void) {
  const keys = useRef(new Set<string>());
  const pressRef = useRef(onPress);
  pressRef.current = onPress;
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const down = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k.startsWith("Arrow") || k === " " || k === "F2" || k === "Tab") e.preventDefault();
      if (!keys.current.has(k)) pressRef.current?.(k, e);
      keys.current.add(k);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const blur = () => keys.current.clear();
    el.addEventListener("keydown", down);
    el.addEventListener("keyup", up);
    el.addEventListener("blur", blur);
    return () => {
      el.removeEventListener("keydown", down);
      el.removeEventListener("keyup", up);
      el.removeEventListener("blur", blur);
    };
  }, [target]);
  return keys;
}
