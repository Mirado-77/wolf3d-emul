/*
 * Constants taken from the original C project (wolf3d, CSFML).
 * Each value names the C file it comes from.
 */

export const BASE = `${import.meta.env.BASE_URL}projects/wolf3d/`;

/** Internal render resolution (the canvas is scaled up with CSS). */
export const W = 400;
export const H = 250;

// raycasting.h / init_shaders.c
export const MAX_WALL = 20;
export const MAX_FLOOR = 17;
export const TORCH_RANGE = 5;

// input_handler.h
export const MOVE_SPEED = 2.0;

/** tile_t (map.h) → texture file (raycasting.h) */
export const TILE_TEX: Record<number, string> = {
  1: "wall1", 2: "door1", 3: "door2", 4: "boss_door", 5: "wall2", 6: "bricks",
  7: "stones_with_moss", 8: "stones_with_holes", 9: "stones_without_moss", 10: "wall_with_bricks",
};

/** Tile ids with a special meaning (map.h). */
export const TILE = { EMPTY: 0, DOOR_1: 2, DOOR_2: 3, BOSS_DOOR: 4 } as const;

/** is_object_t (object.h): entity type ids. */
export const ENT = {
  MONSTER: 0, BOSS: 1, KEY: 2, POT_MANA: 3, POT_HP: 4, MASTER: 5, GENIE: 6, FIRE: 7,
} as const;

/** is_object_t (object.h) → sprite sheet, frame width, frame count. Index = entity type. */
export const SHEETS = [
  { file: "Monster", fw: 64, n: 32 },
  { file: "boss_atlas_64", fw: 128, n: 86 },
  { file: "key", fw: 64, n: 11 },
  { file: "pot_mana", fw: 64, n: 8 },
  { file: "pot_pv", fw: 64, n: 8 },
  { file: "Master", fw: 64, n: 10 },
  { file: "genie", fw: 64, n: 12 },
  { file: "fire", fw: 64, n: 15 },
] as const;

/** Player stats maximums (init_game.c). */
export const PLAYER = { HP: 100, MANA: 500, STAMINA: 200 } as const;
export const BOSS_HP = 600;
export const MONSTER_HP = 30;

/** Spell (weapons.c). */
export const SPELL = { COST: 25, DURATION: 0.45 } as const;

/** dialogue_system.c */
export const LINES = {
  discover: "Ces murs... ils respirent encore la corruption d'antan.",
  boss: "Je sens une presence malefique... Le Shogun doit etre proche.",
  key: "Cette cle... Elle porte les marques d'un sceau sacre.",
  hurt: "La douleur n'est qu'une illusion... Je dois perseverer.",
  genie: "Attention les monstres peuvent etre partout",
  master: "Tu rentre dans le palais du crepuscule attention",
  sealed: "La porte est scellee. Il faut une cle.",
  win: "Le Shogun est vaincu. Le palais est libere.",
  gameOver: "GAME OVER",
};

export const HUD_IMAGES = [
  "player_hud", "blood", "mana", "stamina", "bossbar", "boss_filler", "skeleton_head", "xhair",
  "item_frame", "key_hud", "health_pot", "mana_pot", "spell_preview",
];
export const HAND_IMAGES = ["free_hands", "spell_1_1", "spell_1_2", "spell_1_3", "torch_player"];
