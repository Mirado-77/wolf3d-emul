import { ENT, H, LINES, PLAYER, SPELL, W } from "../config";
import { nearestBoss } from "../boss";
import { isOver } from "../game";
import type { Assets, Game } from "../types";

const HALF = H / 2;
type Ctx = CanvasRenderingContext2D;

/** Draw everything on top of the 3D view: hands, effects, HUD, minimap, text. */
export function renderHud(ctx: Ctx, g: Game, a: Assets, moving: boolean, accent: string) {
  ctx.imageSmoothingEnabled = false;
  drawHands(ctx, g, a, moving);
  drawEffects(ctx, g);
  ctx.drawImage(a.img.xhair, W / 2 - 8, HALF - 8, 16, 16);
  drawPlayerBars(ctx, g, a);
  drawBossBar(ctx, g, a);
  drawMinimap(ctx, g, accent);
  drawTexts(ctx, g);
}

/** One pixel of the C game's 1920×1080 window, in canvas pixels. */
const PX = H / 1080;
/** weapons.c: hands drawn at scale 3, at (screenW / 2 - 40, screenH - 233) (weapons.h). */
const HAND_SCALE = 3 * PX;
const HAND_X = 40;
const HAND_Y = 233;

/** Hands with a small walking bob; spell animation while casting (weapons.c). */
function drawHands(ctx: Ctx, g: Game, a: Assets, moving: boolean) {
  const bob = Math.sin(g.t * 7) * (moving ? 3 : 1);
  const hand = g.cast > 0
    ? a.img[`spell_1_${Math.min(3, 1 + Math.floor((SPELL.DURATION - g.cast) / 0.15))}`]
    : g.torch ? a.img.torch_player : a.img.free_hands;
  ctx.drawImage(hand, Math.floor(W / 2 - HAND_X * PX), Math.floor(H - HAND_Y * PX + bob), hand.width * HAND_SCALE, hand.height * HAND_SCALE);
}

/** Pink flash when casting, red flash when hurt. */
function drawEffects(ctx: Ctx, g: Game) {
  if (g.cast > 0.25) {
    const p = (g.cast - 0.25) / 0.2;
    const gr = ctx.createRadialGradient(W / 2, HALF, 0, W / 2, HALF, 30 + 60 * (1 - p));
    gr.addColorStop(0, `rgba(255,170,220,${0.7 * p})`); gr.addColorStop(1, "rgba(255,120,200,0)");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  if (g.hurt > 0) { ctx.fillStyle = `rgba(160,0,0,${g.hurt * 1.6})`; ctx.fillRect(0, 0, W, H); }
}

/** HUD kit: player_hud.png 133×36 with three filler lines (positions.h). */
function drawPlayerBars(ctx: Ctx, g: Game, a: Assets) {
  const hx = W - 133 - 6, hy = H - 36 - 6;
  ctx.drawImage(a.img.player_hud, hx, hy);
  ctx.drawImage(a.img.skeleton_head, hx + 4, hy + 3, 26, 26);
  const bar = (im: HTMLImageElement, v: number, y: number) =>
    ctx.drawImage(im, 0, 0, Math.max(1, im.width * v), im.height, hx + 41, hy + y, Math.max(1, im.width * v), im.height);
  // blood line on top, then mana, then stamina
  bar(a.img.blood, g.hp / PLAYER.HP, 17);
  bar(a.img.mana, g.mana / PLAYER.MANA, 23);
  bar(a.img.stamina, g.stamina / PLAYER.STAMINA, 30);
}

function drawBossBar(ctx: Ctx, g: Game, a: Assets) {
  const boss = nearestBoss(g);
  if (!boss || !g.bossNear) return;
  const bx = W / 2 - 96, by = 8, fill = a.img.boss_filler;
  ctx.drawImage(a.img.bossbar, bx, by);
  const r = Math.max(0, boss.hp / boss.boss!.maxHp);
  ctx.drawImage(fill, 0, 0, Math.max(1, fill.width * r), 9, bx + 2, by + 4, fill.width * r, 9);
}

/** Local window around the player (minimap.c, HUD_MAP_X/Y = 10). */
function drawMinimap(ctx: Ctx, g: Game, accent: string) {
  const R = 9, ms = 3, mmx = 8, mmy = 8;
  const cx = Math.floor(g.px), cy = Math.floor(g.py);
  ctx.fillStyle = "rgba(0,0,0,.6)";
  ctx.fillRect(mmx - 1, mmy - 1, (2 * R + 1) * ms + 2, (2 * R + 1) * ms + 2);
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const t = g.map[cy + y]?.[cx + x];
    if (!t) continue;
    ctx.fillStyle = t === 4 ? "#b91c1c" : t === 2 || t === 3 ? "#d6c39a" : "#6b5a48";
    ctx.fillRect(mmx + (x + R) * ms, mmy + (y + R) * ms, ms, ms);
  }
  for (const e of g.ents) {
    if (!e.alive || Math.abs(e.x - g.px) > R || Math.abs(e.y - g.py) > R) continue;
    ctx.fillStyle = e.type <= ENT.BOSS ? "#ef4444" : e.type === ENT.KEY ? "#facc15" : e.type <= ENT.POT_HP ? "#60a5fa" : "#a3a3a3";
    ctx.fillRect(mmx + (e.x - cx + R) * ms - 1, mmy + (e.y - cy + R) * ms - 1, 2, 2);
  }
  ctx.fillStyle = accent;
  ctx.fillRect(mmx + (g.px - cx + R) * ms - 1, mmy + (g.py - cy + R) * ms - 1, 3, 3);
}

/** Inventory, kill counter and dialogue / game-over text (alagard font). */
function drawTexts(ctx: Ctx, g: Game) {
  ctx.font = "10px alagard, monospace";
  ctx.textAlign = "left"; ctx.fillStyle = "#e7d8b8";
  ctx.fillText(`PV ${g.inv.hp} [L]   MANA ${g.inv.mana} [M]   ${g.inv.key ? "CLE ✓" : ""}`, 8, H - 8);
  ctx.textAlign = "right";
  ctx.fillText(`yokai ${g.kills}`, W - 8, 74);
  if (g.msgT > 0) drawMessage(ctx, g);
  ctx.textAlign = "left";
}

function drawMessage(ctx: Ctx, g: Game) {
  const over = g.msg === LINES.gameOver;
  ctx.textAlign = "center";
  ctx.font = over ? "28px alagard, monospace" : "11px alagard, monospace";
  const y = over || g.won ? HALF : H - 62;
  const tw = ctx.measureText(g.msg).width;
  ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(W / 2 - tw / 2 - 6, y - 12, tw + 12, over ? 34 : 17);
  ctx.fillStyle = over ? "#dc2626" : "#f5ecd7"; ctx.fillText(g.msg, W / 2, y + (over ? 12 : 0));
  if (isOver(g)) { ctx.font = "9px alagard, monospace"; ctx.fillStyle = "#d6d3d1"; ctx.fillText("Entree pour recommencer", W / 2, y + 36); }
}
