/** A decoded image: width, height and RGBA pixels packed as 32-bit ints. */
export type Tex = { w: number; h: number; d: Uint32Array };

export type EntState = "disguised" | "transform" | "chase" | "hit" | "dying" | "dead";

/** Anything placed on the map: monsters, boss, pickups, NPCs, decorations. */
export type Ent = {
  type: number;
  x: number;
  y: number;
  hp: number;
  alive: boolean;
  /** Time alive, drives looping animations. */
  t: number;
  state: EntState;
  /** Time spent in the current state. */
  stateT: number;
  /** NPC already said its line. */
  said?: boolean;
  /** Only set on bosses (see boss.ts). */
  boss?: {
    state: BossState;
    /** Time in the current state. */
    stateT: number;
    /** Time since the last melee attack. */
    atkT: number;
    /** Frame inside the current state's animation. */
    frame: number;
    frameT: number;
    /** Has seen the player at least once. */
    aware: boolean;
    maxHp: number;
  };
};

/** boss_state_t (boss.h) */
export type BossState = "idle" | "melee" | "enraged" | "meleeEnraged";

/** Entity as read from the config files, before the game starts. */
export type EntSpawn = Omit<Ent, "t" | "state" | "stateT">;

export type Assets = {
  tex: Record<string, Tex>;
  floor: Tex;
  ceil: Tex;
  sheets: Tex[];
  img: Record<string, HTMLImageElement>;
  map0: number[][];
  ents0: EntSpawn[];
};

export type Game = {
  map: number[][];
  ents: Ent[];
  px: number;
  py: number;
  dir: number;
  hp: number;
  mana: number;
  stamina: number;
  torch: boolean;
  /** player.h inventory_t: one of each at most. */
  inv: { hp: boolean; mana: boolean; key: boolean };
  kills: number;
  /** Time left in the spell animation. */
  cast: number;
  /** Time left in the red "hurt" flash. */
  hurt: number;
  msg: string;
  msgT: number;
  bossNear: boolean;
  won: boolean;
  t: number;
  /** Sounds to play this frame (see audio.ts). */
  sounds: Set<Sound>;
};

/** Sound effects of sound_system.c. */
export type Sound = "hurt" | "potion" | "footstep";

/** Keys currently held down (lower-case letters, or KeyboardEvent.key names). */
export type Keys = Set<string>;
