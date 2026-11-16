import { H, TORCH_RANGE, W } from "../config";
import type { Game } from "../types";

/** Pixel buffer the raycaster writes into, plus the depth of each screen column. */
export type Frame = { img: ImageData; px: Uint32Array; z: Float32Array };

export function createFrame(ctx: CanvasRenderingContext2D): Frame {
  const img = ctx.createImageData(W, H);
  return { img, px: new Uint32Array(img.data.buffer), z: new Float32Array(W) };
}

/** Camera vectors: direction and the camera plane (field of view ≈ 66°). */
export type Camera = { dirX: number; dirY: number; plX: number; plY: number };

export function camera(g: Game): Camera {
  const dirX = Math.cos(g.dir), dirY = Math.sin(g.dir);
  return { dirX, dirY, plX: -dirY * 0.66, plY: dirX * 0.66 };
}

/**
 * Darkness from 0 (lit) to 1 (black) at distance `d`.
 * Same formula as shaders/wall_shader.frag and floor_shader.frag.
 */
export function fog(g: Game, d: number, max: number, min: number) {
  return g.torch
    ? Math.min(0.9, Math.max(0, (d - TORCH_RANGE) / (max - TORCH_RANGE)))
    : Math.min(1, Math.max(min, d / max));
}

/** Darken a packed pixel by `f` (0..1). Alpha is forced to opaque. */
export function shade(col: number, f: number) {
  const m = 1 - f;
  return (255 << 24) | ((((col >> 16) & 255) * m) << 16) | ((((col >> 8) & 255) * m) << 8) | ((col & 255) * m);
}
