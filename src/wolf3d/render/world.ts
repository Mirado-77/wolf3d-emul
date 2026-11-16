import { ENT, H, MAX_FLOOR, MAX_WALL, SHEETS, TILE_TEX, W } from "../config";
import { bossFrame } from "../boss";
import type { Assets, Ent, Game } from "../types";
import { type Camera, type Frame, camera, fog, shade } from "./frame";

const HALF = H / 2;

/** Draw the 3D view (floor, ceiling, walls, sprites) into the frame buffer. */
export function renderWorld(g: Game, a: Assets, f: Frame) {
  const cam = camera(g);
  drawFloorAndCeiling(g, a, f, cam);
  drawWalls(g, a, f, cam);
  drawSprites(g, a, f, cam);
}

/** Floor casting, one screen row at a time (floor_shader fog). */
function drawFloorAndCeiling(g: Game, a: Assets, { px }: Frame, { dirX, dirY, plX, plY }: Camera) {
  const fl = a.floor, ce = a.ceil;
  for (let y = HALF + 1; y < H; y++) {
    const rowDist = (0.5 * H) / (y - HALF);
    const sx = (rowDist * 2 * plX) / W, sy = (rowDist * 2 * plY) / W;
    let fx = g.px + rowDist * (dirX - plX), fy = g.py + rowDist * (dirY - plY);
    const f = fog(g, rowDist, MAX_FLOOR, 0.3);
    const yc = H - y - 1;
    for (let x = 0; x < W; x++) {
      const ux = fx - Math.floor(fx), uy = fy - Math.floor(fy);
      fx += sx; fy += sy;
      px[y * W + x] = shade(fl.d[((uy * fl.h) | 0) * fl.w + ((ux * fl.w) | 0)], f);
      px[yc * W + x] = shade(ce.d[((uy * ce.h) | 0) * ce.w + ((ux * ce.w) | 0)], f);
    }
  }
}

/** DDA raycasting, one screen column at a time (raycasting.c, wall_shader fog). */
function drawWalls(g: Game, a: Assets, { px, z }: Frame, { dirX, dirY, plX, plY }: Camera) {
  for (let x = 0; x < W; x++) {
    const cam = (2 * x) / W - 1;
    const rdx = dirX + plX * cam, rdy = dirY + plY * cam;
    let mx = Math.floor(g.px), my = Math.floor(g.py);
    const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
    const stx = rdx < 0 ? -1 : 1, sty = rdy < 0 ? -1 : 1;
    let sdx = rdx < 0 ? (g.px - mx) * ddx : (mx + 1 - g.px) * ddx;
    let sdy = rdy < 0 ? (g.py - my) * ddy : (my + 1 - g.py) * ddy;
    let side = 0, tile = 1;
    for (let i = 0; i < 128; i++) {
      if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; }
      tile = g.map[my]?.[mx] ?? 1;
      if (tile) break;
    }
    const perp = side === 0 ? sdx - ddx : sdy - ddy;
    z[x] = perp;
    const lh = Math.floor(H / perp);
    const ds = Math.max(0, Math.floor(HALF - lh / 2)), de = Math.min(H - 1, Math.floor(HALF + lh / 2));
    let wx = side === 0 ? g.py + perp * rdy : g.px + perp * rdx;
    wx -= Math.floor(wx);
    const t = a.tex[TILE_TEX[tile] ?? "wall1"];
    let tx = Math.floor(wx * t.w);
    if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = t.w - tx - 1;
    const step = t.h / lh;
    let tp = (ds - HALF + lh / 2) * step;
    const f = Math.min(1, fog(g, perp, MAX_WALL, 0.2) + (side ? 0.08 : 0));
    for (let y = ds; y <= de; y++) {
      px[y * W + x] = shade(t.d[Math.min(t.h - 1, tp | 0) * t.w + tx], f);
      tp += step;
    }
  }
}

/** Animation frame to show for an entity, from its type and state. */
function spriteFrame(e: Ent) {
  if (e.type === ENT.MONSTER) {
    if (e.state === "disguised") return Math.floor(e.t * 6) % 6;
    if (e.state === "transform") return 6 + Math.min(4, Math.floor(e.stateT * 6));
    if (e.state === "hit") return 22 + Math.min(3, Math.floor(e.stateT * 10));
    if (e.state === "dying") return 26 + Math.min(5, Math.floor(e.stateT * 5));
    return 11 + (Math.floor(e.t * 8) % 6);
  }
  if (e.type === ENT.BOSS) return bossFrame(e);
  return Math.floor(e.t * 10) % SHEETS[e.type].n;
}

/**
 * Sprite height relative to a wall. The C game draws every sprite one wall high (cast_ennemies.c);
 * the boss atlas has empty space around the Shogun, so 1 keeps him human-sized. Pickups lie on the floor.
 */
const spriteScale = (type: number) => (type >= ENT.KEY && type <= ENT.POT_HP ? 0.5 : 1);

/** Billboard sprites, sorted far → near and hidden behind walls with the z-buffer. */
function drawSprites(g: Game, a: Assets, { px, z }: Frame, { dirX, dirY, plX, plY }: Camera) {
  const inv = 1 / (plX * dirY - dirX * plY);
  const vis = g.ents
    .filter((e) => e.alive)
    .map((e) => ({ e, d: (e.x - g.px) ** 2 + (e.y - g.py) ** 2 }))
    .filter((o) => o.d < 400)
    .sort((p, q) => q.d - p.d);
  for (const { e } of vis) {
    const sh = SHEETS[e.type], sheet = a.sheets[e.type];
    const frame = spriteFrame(e);
    const rx = e.x - g.px, ry = e.y - g.py;
    const tX = inv * (dirY * rx - dirX * ry), tY = inv * (-plY * rx + plX * ry);
    if (tY <= 0.15) continue;
    const scx = Math.floor((W / 2) * (1 + tX / tY));
    const sH = Math.abs(H / tY) * spriteScale(e.type), sW = sH * (sh.fw / 64);
    const y0 = Math.floor(HALF + (H / tY) / 2 - sH), x0 = Math.floor(scx - sW / 2);
    const f = fog(g, tY, MAX_WALL, 0.2);
    const hit = e.state === "hit" || (e.type === ENT.BOSS && g.cast > 0.3 && Math.abs(scx - W / 2) < sW / 2);
    for (let sx = Math.max(0, x0); sx < Math.min(W, x0 + sW); sx++) {
      if (tY >= z[sx]) continue;
      const u = Math.floor(((sx - x0) / sW) * sh.fw) + frame * sh.fw;
      for (let sy = Math.max(0, y0); sy < Math.min(H, y0 + sH); sy++) {
        const v = Math.floor(((sy - y0) / sH) * sheet.h);
        const col = sheet.d[v * sheet.w + u];
        if ((col >>> 24) < 128) continue;
        px[sy * W + sx] = hit ? 0xffffffff : shade(col, e.type === ENT.FIRE ? 0 : f);
      }
    }
  }
}
