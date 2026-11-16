import { LINES } from "./config";
import { say, solid } from "./game";
import type { BossState, Ent, Game } from "./types";

/*
 * The Shogun, ported from boss.c, boss_attacks.c and load_animation.c.
 *
 * It cycles through four states, each with its own part of boss_atlas_64.png:
 *   idle (3.5 s) → melee (3 s, a dash + sword hit every 1 s) → idle → …
 * Below half health it switches for good to:
 *   enraged (3.5 s, hurts from a distance after 2.5 s) → melee enraged (3 s, a hit every 0.8 s) → enraged → …
 */

/** boss.h */
const DASH_DIST = 3;
const MELEE_RANGE = 1.4;
const DISTANCE_RANGE = 20;
const MELEE_DAMAGE = 20;
/** boss.c removes 1 HP per frame at 60 FPS. */
const DISTANCE_DAMAGE_PER_SEC = 60;
/** load_animation.c: one frame every 0.1 s. */
const FRAME_TIME = 0.1;

/** object.h boss_spans: first frame and frame count of each state in the atlas. */
const SPANS: Record<BossState, { start: number; count: number }> = {
  idle: { start: 0, count: 6 },
  melee: { start: 6, count: 32 },
  enraged: { start: 38, count: 16 },
  meleeEnraged: { start: 54, count: 32 },
};

/** The bar above the screen shows a boss closer than this. */
const BAR_RANGE = 9;

export function newBoss(maxHp: number): NonNullable<Ent["boss"]> {
  return { state: "idle", stateT: 0, atkT: 0, frame: 0, frameT: 0, aware: false, maxHp };
}

function setState(e: Ent, next: BossState) {
  const b = e.boss!;
  b.state = next;
  b.stateT = 0;
  b.atkT = 0;
  b.frame = 0; // advance_boss_frame restarts at the first frame of the new state
  b.frameT = 0;
}

/** Index of the atlas frame to draw. */
export function bossFrame(e: Ent) {
  const b = e.boss!;
  return SPANS[b.state].start + b.frame;
}

export function updateBoss(g: Game, e: Ent, dt: number, d: number, canSee: boolean, playing: boolean) {
  const b = e.boss!;
  animate(b, dt);
  if (d < BAR_RANGE) g.bossNear = true;
  if (!playing) return;
  // The C boss starts attacking from anywhere on the map. Here it waits until it has seen the player once.
  if (!b.aware && canSee) { b.aware = true; say(g, LINES.boss); }
  if (!b.aware) return;
  if (e.hp < b.maxHp * 0.5 && b.state !== "enraged" && b.state !== "meleeEnraged") setState(e, "enraged");
  b.stateT += dt;
  if (b.state === "idle" && b.stateT > 3.5) setState(e, "melee");
  else if (b.state === "melee") meleePhase(g, e, dt, 1, "idle");
  else if (b.state === "meleeEnraged") meleePhase(g, e, dt, 0.8, "enraged");
  else if (b.state === "enraged") {
    if (b.stateT > 2.5 && d <= DISTANCE_RANGE) hurtPlayer(g, DISTANCE_DAMAGE_PER_SEC * dt);
    if (b.stateT > 3.5) setState(e, "meleeEnraged");
  }
}

/** Loop through the frames of the current state (advance_boss_frame). */
function animate(b: NonNullable<Ent["boss"]>, dt: number) {
  b.frameT += dt;
  if (b.frameT < FRAME_TIME) return;
  b.frameT -= FRAME_TIME;
  b.frame = (b.frame + 1) % SPANS[b.state].count;
}

/** st_melee / st_melee_enraged: attack every `every` seconds, leave after 3 s. */
function meleePhase(g: Game, e: Ent, dt: number, every: number, next: BossState) {
  const b = e.boss!;
  b.atkT += dt;
  if (b.atkT > every) { performMelee(g, e); b.atkT = 0; }
  if (b.stateT > 3) setState(e, next);
}

/** boss_attacks.c: dash 3 tiles toward the player, then hit if close enough. */
function performMelee(g: Game, e: Ent) {
  let dx = g.px - e.x, dy = g.py - e.y;
  const len = Math.hypot(dx, dy);
  if (len > 0.0001) {
    dx /= len; dy /= len;
    const nx = e.x + dx * DASH_DIST, ny = e.y + dy * DASH_DIST;
    // The C dash only checks the landing tile; here the whole path must be free so the boss cannot jump through walls.
    if (pathFree(g, e.x, e.y, nx, ny)) { e.x = nx; e.y = ny; }
  }
  if (Math.hypot(g.px - e.x, g.py - e.y) <= MELEE_RANGE) hurtPlayer(g, MELEE_DAMAGE);
}

function pathFree(g: Game, x0: number, y0: number, x1: number, y1: number) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 6);
  for (let i = 1; i <= n; i++) if (solid(g, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false;
  return true;
}

function hurtPlayer(g: Game, dmg: number) {
  g.hp -= dmg;
  g.sounds.add("hurt");
  if (g.hurt <= 0) g.hurt = 0.25;
}

/** Closest living boss shown in the boss bar, or null. */
export function nearestBoss(g: Game): Ent | null {
  let best: Ent | null = null, bd = BAR_RANGE;
  for (const e of g.ents) {
    if (!e.alive || !e.boss) continue;
    const d = Math.hypot(e.x - g.px, e.y - g.py);
    if (d < bd) { best = e; bd = d; }
  }
  return best;
}
