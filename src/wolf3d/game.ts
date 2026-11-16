import { ENT, LINES, PLAYER } from "./config";
import { newBoss } from "./boss";
import type { Assets, Ent, Game } from "./types";

/** Fresh game state from the loaded assets (init_game.c). */
export function newGame(a: Assets): Game {
  return {
    map: a.map0.map((r) => [...r]),
    ents: a.ents0.map((e): Ent => ({
      ...e, t: Math.random() * 3, state: e.type === ENT.MONSTER ? "disguised" : "chase", stateT: 0,
      boss: e.type === ENT.BOSS ? newBoss(e.hp) : undefined,
    })),
    // init_game.c: x = 3, y = 3, dir = (-1, 0) — we face down the first corridor instead
    px: 3.5, py: 3.5, dir: Math.PI / 2,
    hp: PLAYER.HP, mana: PLAYER.MANA, stamina: PLAYER.STAMINA, torch: true,
    inv: { hp: 0, mana: 0, key: false },
    kills: 0, cast: 0, hurt: 0, msg: LINES.discover, msgT: 5, bossNear: false, won: false, t: 0,
    sounds: new Set(),
  };
}

/** True if the map cell under (x, y) blocks movement. Outside the map counts as a wall. */
export const solid = (g: Game, x: number, y: number) => (g.map[Math.floor(y)]?.[Math.floor(x)] ?? 1) !== 0;

/** Show a dialogue line for `t` seconds. */
export const say = (g: Game, m: string, t = 3.5) => { g.msg = m; g.msgT = t; };

/** True if no wall stands between the player and (tx, ty). */
export function lineClear(g: Game, tx: number, ty: number) {
  const n = Math.ceil(Math.hypot(tx - g.px, ty - g.py) * 6);
  for (let i = 1; i < n; i++) if (solid(g, g.px + ((tx - g.px) * i) / n, g.py + ((ty - g.py) * i) / n)) return false;
  return true;
}

export const isOver = (g: Game) => g.hp <= 0 || g.won;
