import { ENT, LINES, PLAYER, SPELL, TILE } from "./config";
import { lineClear, say } from "./game";
import type { Ent, Game } from "./types";

/** Cast the spell at the closest monster in front of the player (weapons.c). */
export function cast(g: Game) {
  if (g.cast > 0 || g.mana < SPELL.COST || g.hp <= 0) return;
  g.mana -= SPELL.COST;
  g.cast = SPELL.DURATION;
  const target = findTarget(g);
  if (target) hitEnemy(g, target);
}

function findTarget(g: Game): Ent | null {
  let best: Ent | null = null, bd = 1e9;
  for (const e of g.ents) {
    if (!e.alive || (e.type !== ENT.MONSTER && e.type !== ENT.BOSS) || e.state === "dying") continue;
    const dx = e.x - g.px, dy = e.y - g.py, d = Math.hypot(dx, dy);
    let a = Math.atan2(dy, dx) - g.dir;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    if (d < 10 && Math.abs(a) < 0.1 + 0.35 / d && d < bd && lineClear(g, e.x, e.y)) { best = e; bd = d; }
  }
  return best;
}

function hitEnemy(g: Game, e: Ent) {
  e.hp -= 10 + Math.random() * 10;
  if (e.type === ENT.MONSTER && e.state === "disguised") { e.state = "transform"; e.stateT = 0; }
  if (e.hp <= 0) {
    e.state = "dying"; e.stateT = 0; g.kills++;
    if (e.type === ENT.BOSS) { g.won = true; say(g, LINES.win, 99); }
  } else if (e.type === ENT.MONSTER && e.state === "chase") {
    e.state = "hit"; e.stateT = 0;
  }
}

/** Open the door in front of the player. The boss door needs the key. */
export function openDoor(g: Game) {
  for (const r of [0.8, 1.4]) {
    const tx = Math.floor(g.px + Math.cos(g.dir) * r), ty = Math.floor(g.py + Math.sin(g.dir) * r);
    const t = g.map[ty]?.[tx];
    if (t === TILE.DOOR_1 || t === TILE.DOOR_2) { g.map[ty][tx] = TILE.EMPTY; return; }
    if (t === TILE.BOSS_DOOR) {
      if (g.inv.key) { g.map[ty][tx] = TILE.EMPTY; say(g, LINES.boss); } else say(g, LINES.sealed, 2.5);
      return;
    }
  }
}

export function drinkHealth(g: Game) {
  if (g.inv.hp > 0 && g.hp < PLAYER.HP) { g.inv.hp--; g.hp = Math.min(PLAYER.HP, g.hp + 40); g.sounds.add("potion"); }
}

export function drinkMana(g: Game) {
  if (g.inv.mana > 0) { g.inv.mana--; g.mana = Math.min(PLAYER.MANA, g.mana + 200); g.sounds.add("potion"); }
}
