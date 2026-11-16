import { useEffect, useRef, useState } from "react";
import type { DemoProps } from "../components/DemoFrame";
import { useAnimationFrame, useKeys } from "../hooks";
import { loadAssets } from "../wolf3d/assets";
import { H, W } from "../wolf3d/config";
import { newGame } from "../wolf3d/game";
import { handleKeyPress, useMouseLook } from "../wolf3d/input";
import { ClickToPlayHint, TitleScreen } from "../wolf3d/Overlays";
import { type Frame, createFrame } from "../wolf3d/render/frame";
import { renderHud } from "../wolf3d/render/hud";
import { renderWorld } from "../wolf3d/render/world";
import type { Assets, Game } from "../wolf3d/types";
import { update } from "../wolf3d/update";

/*
 * Browser port of wolf3d, running on the game's own assets and data:
 * the 80×60 map (configs/map_config.txt), entity placement (configs/*.txt),
 * the wall / floor / ceiling textures, the animated sprite sheets, the hands,
 * the HUD kit, the alagard font, and the fog formula of shaders/*.frag.
 *
 * This component only wires React to the game: the logic lives in src/wolf3d/.
 */
export default function Wolf3D({ running, accent }: DemoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [error, setError] = useState(false);
  const [focused, setFocused] = useState(false);
  const [title, setTitle] = useState(false);
  const game = useRef<Game | null>(null);
  const frame = useRef<Frame | null>(null);

  useEffect(() => {
    loadAssets().then((a) => { game.current = newGame(a); setAssets(a); }).catch(() => setError(true));
  }, []);

  const keys = useKeys(wrapRef, (k) => {
    const g = game.current;
    if (!g) return;
    handleKeyPress(g, k, () => { if (assets) game.current = newGame(assets); });
  });
  useMouseLook(wrapRef, () => game.current);

  useAnimationFrame((dt) => {
    const g = game.current, a = assets, c = canvasRef.current;
    if (!g || !a || !c) return;
    const ctx = c.getContext("2d")!;
    frame.current ??= createFrame(ctx);
    update(g, keys.current, dt, focused && !title);
    renderWorld(g, a, frame.current);
    ctx.putImageData(frame.current.img, 0, 0);
    renderHud(ctx, g, a, keys.current.size > 0, accent);
  }, running && !!assets);

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      role="application"
      aria-label="Wolf3D game. Z Q S D or W A S D to move, arrows to turn, E to cast, F to open doors, R torch, L and M potions."
      className="relative h-full w-full cursor-crosshair bg-black outline-none"
    >
      <canvas ref={canvasRef} width={W} height={H} aria-hidden className="h-full w-full [image-rendering:pixelated]" />
      {(title || !assets) && (
        <TitleScreen loaded={!!assets} error={error} onEnter={() => { setTitle(false); wrapRef.current?.focus(); }} />
      )}
      {!title && !focused && assets && <ClickToPlayHint />}
    </div>
  );
}
