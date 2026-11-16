import { H, W } from "../config";
import type { Assets, Game } from "../types";

/*
 * Inventory frame in the bottom-right corner (draw_hud.c draw_items, draw_inventory.c).
 * Positions come from positions.h, written for a 1920×1080 window,
 * and are converted to the canvas keeping the distance to the bottom-right corner.
 */

type Ctx = CanvasRenderingContext2D;

/** One pixel of the C window, in canvas pixels. */
const PX = H / 1080;
const cx = (x: number) => W - (1920 - x) * PX;
const cy = (y: number) => H - (1080 - y) * PX;

/** Key_8.png: 27 frames of 21×47, one every 0.1 s (animate_boss_key). */
const KEY_FRAME_W = 21;
const KEY_FRAMES = 27;

/** Draw an image (or a part of it) centred on (x, y), scaled and rotated like an SFML sprite with a centred origin. */
function drawCentered(ctx: Ctx, img: HTMLImageElement, x: number, y: number, scale: number, deg = 0,
  src = { x: 0, y: 0, w: img.width, h: img.height }) {
  const w = src.w * scale * PX, h = src.h * scale * PX;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(img, src.x, src.y, src.w, src.h, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export function drawInventory(ctx: Ctx, g: Game, a: Assets) {
  const frame = a.img.item_frame;
  // HUD_ITEMS: top-left at (WIN_WIDTH - 450, WIN_HEIGHT - 450), scale 5.5
  ctx.drawImage(frame, cx(1470), cy(630), frame.width * 5.5 * PX, frame.height * 5.5 * PX);
  // spell previews: the spell and the torch are always shown
  drawCentered(ctx, a.img.spell_preview, cx(1780), cy(790), 1.3);
  drawCentered(ctx, a.img.torch_player, cx(1670), cy(720), 0.8);
  if (g.inv.key) {
    const f = Math.floor(g.t * 10) % KEY_FRAMES;
    drawCentered(ctx, a.img.key_hud, cx(1670), cy(850), 3, 40, { x: f * KEY_FRAME_W, y: 0, w: KEY_FRAME_W, h: 47 });
  }
  if (g.inv.mana) drawCentered(ctx, a.img.mana_pot, cx(1757), cy(905), 1.6, 10);
  if (g.inv.hp) drawCentered(ctx, a.img.health_pot, cx(1837), cy(905), 1.6, 10);
}
