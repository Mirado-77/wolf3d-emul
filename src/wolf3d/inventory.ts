import { ENT, LINES, PLAYER } from "./config";
import { say } from "./game";
import type { Ent, Game } from "./types";

/*
 * Inventory of the original game (inventory.c, check_items.c, player.h).
 * The player holds at most one health potion, one mana potion and the key.
 * Potions on the map come back 15 s after being picked up; the key does not.
 */

const RESPAWN_TIME = 15;

const isPickup = (e: Ent) => e.type === ENT.KEY || e.type === ENT.POT_MANA || e.type === ENT.POT_HP;

/**
 * check_items.c: an item is picked up when the player stands on its tile.
 * Returns true if `e` was picked up.
 */
export function tryPickup(g: Game, e: Ent) {
  if (!isPickup(e) || Math.floor(g.px) !== Math.floor(e.x) || Math.floor(g.py) !== Math.floor(e.y)) return false;
  e.alive = false;
  e.stateT = 0; // counts the time until it comes back
  if (e.type === ENT.KEY) { g.inv.key = true; say(g, LINES.key); }
  if (e.type === ENT.POT_MANA) g.inv.mana = true;
  if (e.type === ENT.POT_HP) g.inv.hp = true;
  return true;
}

/** redraw_items: picked potions reappear after 15 s. */
export function respawnPickups(g: Game, dt: number) {
  for (const e of g.ents) {
    if (e.alive || (e.type !== ENT.POT_MANA && e.type !== ENT.POT_HP)) continue;
    e.stateT += dt;
    if (e.stateT > RESPAWN_TIME) { e.alive = true; e.stateT = 0; }
  }
}

/** L: drink the health potion, +50 HP (MAX_HEALTH / 2). */
export function drinkHealth(g: Game) {
  if (!g.inv.hp) return;
  g.inv.hp = false;
  g.hp = Math.min(PLAYER.HP, g.hp + PLAYER.HP / 2);
  g.sounds.add("potion");
}

/** M: drink the mana potion, +250 mana (MAX_MANA / 2). */
export function drinkMana(g: Game) {
  if (!g.inv.mana) return;
  g.inv.mana = false;
  g.mana = Math.min(PLAYER.MANA, g.mana + PLAYER.MANA / 2);
  g.sounds.add("potion");
}
