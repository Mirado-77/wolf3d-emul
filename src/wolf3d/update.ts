import { ENT, LINES, MOVE_SPEED, PLAYER } from "./config";
import { updateBoss } from "./boss";
import { isOver, lineClear, say, solid } from "./game";
import { respawnPickups, tryPickup } from "./inventory";
import type { Ent, Game, Keys } from "./types";

/** Advance the game by `dt` seconds. `playing` is false in attract mode (canvas not focused). */
export function update(g: Game, keys: Keys, dt: number, playing: boolean) {
  g.t += dt;
  if (!playing) g.dir += dt * 0.18; // attract mode: slowly look around
  if (!isOver(g)) updatePlayer(g, keys, dt);
  g.cast = Math.max(0, g.cast - dt);
  g.hurt = Math.max(0, g.hurt - dt);
  g.msgT = Math.max(0, g.msgT - dt);
  g.bossNear = false;
  for (const e of g.ents) if (e.alive) updateEntity(g, e, dt, playing);
  respawnPickups(g, dt);
  if (g.hp <= 0 && g.msg !== LINES.gameOver) { g.hp = 0; say(g, LINES.gameOver, 99); }
}

/** Movement, sprint, stamina and mana regen (movements.c). */
function updatePlayer(g: Game, k: Keys, dt: number) {
  const sprint = k.has("Shift") && g.stamina > 1;
  const sp = MOVE_SPEED * (sprint ? 1.7 : 1) * dt;
  const fwd = (k.has("z") || k.has("w") || k.has("ArrowUp") ? 1 : 0) - (k.has("s") || k.has("ArrowDown") ? 1 : 0);
  const str = (k.has("d") ? 1 : 0) - (k.has("q") || k.has("a") ? 1 : 0);
  if (k.has("ArrowLeft")) g.dir -= 2.2 * dt;
  if (k.has("ArrowRight")) g.dir += 2.2 * dt;
  let mx = Math.cos(g.dir) * fwd - Math.sin(g.dir) * str, my = Math.sin(g.dir) * fwd + Math.cos(g.dir) * str;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx = (mx / len) * sp; my = (my / len) * sp;
    // test each axis on its own so the player slides along walls
    if (!solid(g, g.px + mx + Math.sign(mx) * 0.2, g.py)) g.px += mx;
    if (!solid(g, g.px, g.py + my + Math.sign(my) * 0.2)) g.py += my;
    if (sprint) g.stamina = Math.max(0, g.stamina - 60 * dt);
    g.sounds.add("footstep"); // movements.c
  }
  if (!sprint || len === 0) g.stamina = Math.min(PLAYER.STAMINA, g.stamina + 30 * dt);
  g.mana = Math.min(PLAYER.MANA, g.mana + 12 * dt);
}

function updateEntity(g: Game, e: Ent, dt: number, playing: boolean) {
  e.t += dt; e.stateT += dt;
  const dx = g.px - e.x, dy = g.py - e.y, d = Math.hypot(dx, dy);
  if (e.state === "dying" && e.stateT > 1.2) { e.alive = false; return; }
  if (tryPickup(g, e)) return;
  if ((e.type === ENT.MASTER || e.type === ENT.GENIE) && d < 2 && !e.said) {
    e.said = true;
    say(g, e.type === ENT.MASTER ? LINES.master : LINES.genie);
  }
  if (e.type === ENT.BOSS) { updateBoss(g, e, dt, d, d < 12 && lineClear(g, e.x, e.y), playing && !isOver(g)); return; }
  if (!playing || isOver(g)) return;
  if (e.type === ENT.MONSTER) updateMonsterState(g, e, d);
  if (e.type === ENT.MONSTER && e.state === "chase") chase(g, e, dx, dy, d, dt);
}

/** Monsters hide as statues, transform when the player comes close, then chase. */
function updateMonsterState(g: Game, e: Ent, d: number) {
  if (e.state === "disguised" && d < 4 && lineClear(g, e.x, e.y)) { e.state = "transform"; e.stateT = 0; }
  if (e.state === "transform" && e.stateT > 0.8) { e.state = "chase"; e.stateT = 0; }
  if (e.state === "hit" && e.stateT > 0.35) { e.state = "chase"; e.stateT = 0; }
}

/** Monsters walk straight at the player while they can see them, and hurt on contact. */
function chase(g: Game, e: Ent, dx: number, dy: number, d: number, dt: number) {
  if (d < 12 && d > 0.8 && lineClear(g, e.x, e.y)) {
    const v = 0.9 * dt;
    const nx = e.x + (dx / d) * v, ny = e.y + (dy / d) * v;
    if (!solid(g, nx, e.y)) e.x = nx;
    if (!solid(g, e.x, ny)) e.y = ny;
  }
  if (d < 1.0) {
    g.hp -= 9 * dt;
    g.sounds.add("hurt"); // ennemies_movement.c
    if (g.hurt <= 0) { g.hurt = 0.25; if (Math.random() < 0.15) say(g, LINES.hurt, 2.5); }
  }
}
