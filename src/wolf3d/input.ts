import { useEffect } from "react";
import { cast, openDoor } from "./actions";
import { drinkHealth, drinkMana } from "./inventory";
import { isOver } from "./game";
import type { Game } from "./types";

/** One-shot key actions (held keys for movement are read in update.ts). */
export function handleKeyPress(g: Game, k: string, restart: () => void) {
  if (k === "r") g.torch = !g.torch;
  if (k === "e" || k === " ") cast(g);
  if (k === "f") openDoor(g);
  if (k === "l") drinkHealth(g);
  if (k === "m") drinkMana(g);
  if (k === "Enter" && isOver(g)) restart();
}

/** Drag the mouse to turn; a short click (no drag) casts the spell. */
export function useMouseLook(target: React.RefObject<HTMLElement | null>, getGame: () => Game | null) {
  useEffect(() => {
    const el = target.current!;
    let down = false, moved = 0, lx = 0;
    const onDown = (e: PointerEvent) => { down = true; moved = 0; lx = e.clientX; };
    const onMove = (e: PointerEvent) => {
      const g = getGame();
      if (!down || !g) return;
      g.dir += (e.clientX - lx) * 0.006;
      moved += Math.abs(e.clientX - lx);
      lx = e.clientX;
    };
    const onUp = () => {
      const g = getGame();
      if (down && moved < 4 && g && document.activeElement === el) cast(g);
      down = false;
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  });
}
