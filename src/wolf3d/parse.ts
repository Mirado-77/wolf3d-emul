import { BOSS_HP, ENT, MONSTER_HP } from "./config";
import type { EntSpawn } from "./types";

/**
 * map_config.txt: "W H" then H rows of W ints.
 * load_map reads tiles[x][y], so a text row is one y.
 */
export function parseMap(text: string): number[][] {
  const nums = text.trim().split(/\s+/).map(Number);
  const [mw, mh] = nums;
  const map: number[][] = [];
  for (let y = 0; y < mh; y++) map.push(nums.slice(2 + y * mw, 2 + (y + 1) * mw));
  return map;
}

/**
 * object_config.txt / ennemies_config.txt: one entity per line, "x y type".
 * Lines that are not three numbers are skipped, duplicates are removed,
 * and types above FIRE are ignored.
 */
export function parseEntities(...texts: string[]): EntSpawn[] {
  const seen = new Set<string>();
  const ents: EntSpawn[] = [];
  for (const line of texts.join("\n").split("\n")) {
    const p = line.trim().split(/\s+/).map(Number);
    if (p.length < 3 || p.some(Number.isNaN)) continue;
    const key = `${Math.round(p[0])},${Math.round(p[1])},${p[2]}`;
    if (seen.has(key) || p[2] > ENT.FIRE) continue;
    seen.add(key);
    ents.push({ type: p[2], x: p[0], y: p[1], hp: p[2] === ENT.BOSS ? BOSS_HP : MONSTER_HP, alive: true });
  }
  return ents;
}
