import { BASE } from "./config";
import type { Game, Sound } from "./types";

/*
 * Sounds of the original game (sound_system.c) and its music (init_game.c).
 * The game logic never plays audio itself: it pushes sound names into
 * `g.sounds`, and `playQueued` plays them once per frame.
 */

const SOUND_FILES: Record<Sound, string> = {
  hurt: "hurt",
  potion: "potion",
  footstep: "walking",
};

/** init_game.c: sfMusic_setVolume(music, 75) */
const MUSIC_VOLUME = 0.75;

export type GameAudio = {
  sounds: Record<Sound, HTMLAudioElement>;
  music: HTMLAudioElement;
};

const audioFile = (name: string) => {
  const a = new Audio(`${BASE}sounds/${name}.mp3`);
  a.preload = "auto";
  return a;
};

export function createAudio(): GameAudio {
  const sounds = {} as Record<Sound, HTMLAudioElement>;
  for (const [id, file] of Object.entries(SOUND_FILES)) sounds[id as Sound] = audioFile(file);
  const music = new Audio(`${BASE}sounds/music.mp3`);
  music.preload = "none"; // 2.7 MB: only downloaded once the player starts
  music.loop = true;
  music.volume = MUSIC_VOLUME;
  return { sounds, music };
}

/** Like play_sound() in C: a sound that is already playing is not restarted. */
function playSound(el: HTMLAudioElement) {
  if (!el.paused && !el.ended) return;
  el.currentTime = 0;
  el.play().catch(() => { /* blocked until the player interacts with the page */ });
}

/** Play every sound the game asked for this frame, then empty the queue. */
export function playQueued(audio: GameAudio, g: Game) {
  for (const s of g.sounds) playSound(audio.sounds[s]);
  g.sounds.clear();
}

/** Music plays only while the player is in the game (browsers block it before a click). */
export function setMusicPlaying(audio: GameAudio, on: boolean) {
  if (on && audio.music.paused) audio.music.play().catch(() => {});
  if (!on && !audio.music.paused) audio.music.pause();
}

export function stopAll(audio: GameAudio) {
  audio.music.pause();
  for (const el of Object.values(audio.sounds)) el.pause();
}
