import { useEffect, useRef, useState } from "react";
import type { DemoProps } from "../components/DemoFrame";
import { useAnimationFrame, useKeys } from "../hooks";

/*
 * Browser port of wolf3d, running on the game's own assets and data:
 * the 80×60 map (configs/map_config.txt), entity placement (configs/*.txt),
 * the wall / floor / ceiling textures, the animated sprite sheets, the hands,
 * the HUD kit, the alagard font, and the fog formula of shaders/*.frag.
 */

const BASE = `${import.meta.env.BASE_URL}projects/wolf3d/`;
const W = 400, H = 250;
const MAX_WALL = 20, MAX_FLOOR = 17, TORCH_RANGE = 5; // from raycasting.h / init_shaders.c
const MOVE_SPEED = 2.0; // input_handler.h

// tile_t (map.h) → texture file (raycasting.h)
const TILE_TEX: Record<number, string> = {
  1: "wall1", 2: "door1", 3: "door2", 4: "boss_door", 5: "wall2", 6: "bricks",
  7: "stones_with_moss", 8: "stones_with_holes", 9: "stones_without_moss", 10: "wall_with_bricks",
};
// is_object_t (object.h) → sprite sheet, frame width, frame count
const SHEETS = [
  { file: "Monster", fw: 64, n: 32 },
  { file: "boss_atlas_64", fw: 128, n: 85 },
  { file: "key", fw: 64, n: 11 },
  { file: "pot_mana", fw: 64, n: 8 },
  { file: "pot_pv", fw: 64, n: 8 },
  { file: "Master", fw: 64, n: 10 },
  { file: "genie", fw: 64, n: 12 },
  { file: "fire", fw: 64, n: 15 },
] as const;
// dialogue_system.c
const LINES = {
  discover: "Ces murs... ils respirent encore la corruption d'antan.",
  boss: "Je sens une presence malefique... Le Shogun doit etre proche.",
  key: "Cette cle... Elle porte les marques d'un sceau sacre.",
  hurt: "La douleur n'est qu'une illusion... Je dois perseverer.",
  genie: "Attention les monstres peuvent etre partout",
  master: "Tu rentre dans le palais du crepuscule attention",
};

type Tex = { w: number; h: number; d: Uint32Array };
type Ent = {
  type: number; x: number; y: number; hp: number; alive: boolean; t: number;
  state: "disguised" | "transform" | "chase" | "hit" | "dying" | "dead"; stateT: number; said?: boolean;
};
type Assets = {
  tex: Record<string, Tex>; floor: Tex; ceil: Tex; sheets: Tex[];
  img: Record<string, HTMLImageElement>; map0: number[][]; ents0: Omit<Ent, "t" | "state" | "stateT">[];
};

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
  const i = new Image();
  i.onload = () => res(i);
  i.onerror = rej;
  i.src = src;
});
function toTex(img: HTMLImageElement): Tex {
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0);
  return { w: img.width, h: img.height, d: new Uint32Array(x.getImageData(0, 0, img.width, img.height).data.buffer) };
}

let assetsPromise: Promise<Assets> | null = null;
function loadAssets(): Promise<Assets> {
  assetsPromise ??= (async () => {
    const texNames = [...new Set(Object.values(TILE_TEX)), "floor1", "ceiling1"];
    const hud = ["player_hud", "blood", "mana", "stamina", "bossbar", "boss_filler", "skeleton_head", "xhair"];
    const hands = ["free_hands", "spell_1_1", "spell_1_2", "spell_1_3", "torch_player"];
    const [texImgs, sheetImgs, hudImgs, handImgs, mapTxt, objTxt, entTxt] = await Promise.all([
      Promise.all(texNames.map((n) => loadImg(`${BASE}tex/${n}.png`))),
      Promise.all(SHEETS.map((s) => loadImg(`${BASE}sprites/${s.file}.png`))),
      Promise.all(hud.map((n) => loadImg(`${BASE}hud/${n}.png`))),
      Promise.all(hands.map((n) => loadImg(`${BASE}hands/${n}.png`))),
      fetch(`${BASE}map.txt`).then((r) => r.text()),
      fetch(`${BASE}objects.txt`).then((r) => r.text()),
      fetch(`${BASE}entities.txt`).then((r) => r.text()),
    ]);
    try {
      const font = new FontFace("alagard", `url(${BASE}alagard.ttf)`);
      document.fonts.add(await font.load());
    } catch { /* fall back to monospace */ }
    const tex: Record<string, Tex> = {};
    texNames.forEach((n, i) => (tex[n] = toTex(texImgs[i])));
    const img: Record<string, HTMLImageElement> = {};
    hud.forEach((n, i) => (img[n] = hudImgs[i]));
    hands.forEach((n, i) => (img[n] = handImgs[i]));
    // map_config.txt: "W H" then H rows of W ints (load_map reads tiles[x][y], row = y)
    const nums = mapTxt.trim().split(/\s+/).map(Number);
    const [mw, mh] = nums;
    const map0: number[][] = [];
    for (let y = 0; y < mh; y++) map0.push(nums.slice(2 + y * mw, 2 + (y + 1) * mw));
    const seen = new Set<string>();
    const ents0: Assets["ents0"] = [];
    for (const line of (objTxt + "\n" + entTxt).split("\n")) {
      const p = line.trim().split(/\s+/).map(Number);
      if (p.length < 3 || p.some(Number.isNaN)) continue;
      const k = `${Math.round(p[0])},${Math.round(p[1])},${p[2]}`;
      if (seen.has(k) || p[2] > 7) continue;
      seen.add(k);
      ents0.push({ type: p[2], x: p[0], y: p[1], hp: p[2] === 1 ? 600 : 30, alive: true });
    }
    return { tex, floor: tex.floor1, ceil: tex.ceiling1, sheets: sheetImgs.map(toTex), img, map0, ents0 };
  })();
  return assetsPromise;
}

function newGame(a: Assets) {
  return {
    map: a.map0.map((r) => [...r]),
    ents: a.ents0.map((e): Ent => ({ ...e, t: Math.random() * 3, state: e.type === 0 ? "disguised" : "chase", stateT: 0 })),
    // init_game.c: x = 3, y = 3, dir = (-1, 0) — we face down the first corridor instead
    px: 3.5, py: 3.5, dir: Math.PI / 2,
    hp: 100, mana: 500, stamina: 200, torch: true,
    inv: { hp: 0, mana: 0, key: false },
    kills: 0, cast: 0, hurt: 0, msg: LINES.discover, msgT: 5, bossNear: false, won: false, t: 0,
  };
}
type Game = ReturnType<typeof newGame>;

export default function Wolf3D({ running, accent }: DemoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [error, setError] = useState(false);
  const [focused, setFocused] = useState(false);
  const [title, setTitle] = useState(false);
  const game = useRef<Game | null>(null);
  const buf = useRef<{ img: ImageData; px: Uint32Array; z: Float32Array } | null>(null);

  useEffect(() => {
    loadAssets().then((a) => { game.current = newGame(a); setAssets(a); }).catch(() => setError(true));
  }, []);

  const solid = (g: Game, x: number, y: number) => (g.map[Math.floor(y)]?.[Math.floor(x)] ?? 1) !== 0;
  const say = (g: Game, m: string, t = 3.5) => { g.msg = m; g.msgT = t; };

  const keys = useKeys(wrapRef, (k) => {
    const g = game.current;
    if (!g) return;
    if (k === "r") g.torch = !g.torch;
    if (k === "e" || k === " ") cast(g);
    if (k === "f") openDoor(g);
    if (k === "l" && g.inv.hp > 0 && g.hp < 100) { g.inv.hp--; g.hp = Math.min(100, g.hp + 40); }
    if (k === "m" && g.inv.mana > 0) { g.inv.mana--; g.mana = Math.min(500, g.mana + 200); }
    if (k === "Enter" && (g.hp <= 0 || g.won) && assets) game.current = newGame(assets);
  });

  function cast(g: Game) {
    if (g.cast > 0 || g.mana < 25 || g.hp <= 0) return;
    g.mana -= 25;
    g.cast = 0.45;
    let best: Ent | null = null, bd = 1e9;
    for (const e of g.ents) {
      if (!e.alive || (e.type !== 0 && e.type !== 1) || e.state === "dying") continue;
      const dx = e.x - g.px, dy = e.y - g.py, d = Math.hypot(dx, dy);
      let a = Math.atan2(dy, dx) - g.dir;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      if (d < 10 && Math.abs(a) < 0.1 + 0.35 / d && d < bd && lineClear(g, e.x, e.y)) { best = e; bd = d; }
    }
    if (!best) return;
    best.hp -= 10 + Math.random() * 10;
    if (best.type === 0 && best.state === "disguised") { best.state = "transform"; best.stateT = 0; }
    if (best.hp <= 0) {
      best.state = "dying"; best.stateT = 0; g.kills++;
      if (best.type === 1) { g.won = true; say(g, "Le Shogun est vaincu. Le palais est libere.", 99); }
    } else if (best.type === 0 && best.state === "chase") { best.state = "hit"; best.stateT = 0; }
  }
  function lineClear(g: Game, tx: number, ty: number) {
    const n = Math.ceil(Math.hypot(tx - g.px, ty - g.py) * 6);
    for (let i = 1; i < n; i++) if (solid(g, g.px + ((tx - g.px) * i) / n, g.py + ((ty - g.py) * i) / n)) return false;
    return true;
  }
  function openDoor(g: Game) {
    for (const r of [0.8, 1.4]) {
      const tx = Math.floor(g.px + Math.cos(g.dir) * r), ty = Math.floor(g.py + Math.sin(g.dir) * r);
      const t = g.map[ty]?.[tx];
      if (t === 2 || t === 3) { g.map[ty][tx] = 0; return; }
      if (t === 4) {
        if (g.inv.key) { g.map[ty][tx] = 0; say(g, LINES.boss); } else say(g, "La porte est scellee. Il faut une cle.", 2.5);
        return;
      }
    }
  }

  // drag to look
  useEffect(() => {
    const el = wrapRef.current!;
    let down = false, moved = 0, lx = 0;
    const md = (e: PointerEvent) => { down = true; moved = 0; lx = e.clientX; };
    const mm = (e: PointerEvent) => {
      if (!down || !game.current) return;
      game.current.dir += (e.clientX - lx) * 0.006; moved += Math.abs(e.clientX - lx); lx = e.clientX;
    };
    const mu = () => { if (down && moved < 4 && game.current && document.activeElement === el) cast(game.current); down = false; };
    el.addEventListener("pointerdown", md);
    window.addEventListener("pointermove", mm);
    window.addEventListener("pointerup", mu);
    return () => { el.removeEventListener("pointerdown", md); window.removeEventListener("pointermove", mm); window.removeEventListener("pointerup", mu); };
  });

  useAnimationFrame((dt) => {
    const g = game.current, a = assets, c = canvasRef.current;
    if (!g || !a || !c) return;
    const ctx = c.getContext("2d")!;
    if (!buf.current) {
      const img = ctx.createImageData(W, H);
      buf.current = { img, px: new Uint32Array(img.data.buffer), z: new Float32Array(W) };
    }
    const { img, px, z } = buf.current;
    const k = keys.current;
    const playing = focused && !title;
    g.t += dt;

    // ---------- update ----------
    if (!playing) g.dir += dt * 0.18; // attract mode
    if (g.hp > 0 && !g.won) {
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
        if (!solid(g, g.px + mx + Math.sign(mx) * 0.2, g.py)) g.px += mx;
        if (!solid(g, g.px, g.py + my + Math.sign(my) * 0.2)) g.py += my;
        if (sprint) g.stamina = Math.max(0, g.stamina - 60 * dt);
      }
      if (!sprint || len === 0) g.stamina = Math.min(200, g.stamina + 30 * dt);
      g.mana = Math.min(500, g.mana + 12 * dt);
    }
    g.cast = Math.max(0, g.cast - dt);
    g.hurt = Math.max(0, g.hurt - dt);
    g.msgT = Math.max(0, g.msgT - dt);
    g.bossNear = false;
    for (const e of g.ents) {
      if (!e.alive) continue;
      e.t += dt; e.stateT += dt;
      const dx = g.px - e.x, dy = g.py - e.y, d = Math.hypot(dx, dy);
      if (e.state === "dying" && e.stateT > (e.type === 1 ? 2.5 : 1.2)) { e.alive = false; continue; }
      if (e.type >= 2 && e.type <= 4 && d < 0.6) {
        e.alive = false;
        if (e.type === 2) { g.inv.key = true; say(g, LINES.key); }
        if (e.type === 3) g.inv.mana++;
        if (e.type === 4) g.inv.hp++;
        continue;
      }
      if ((e.type === 5 || e.type === 6) && d < 2 && !e.said) { e.said = true; say(g, e.type === 5 ? LINES.master : LINES.genie); }
      if (!playing || g.hp <= 0 || g.won) continue;
      if (e.type === 0) {
        if (e.state === "disguised" && d < 4 && lineClear(g, e.x, e.y)) { e.state = "transform"; e.stateT = 0; }
        if (e.state === "transform" && e.stateT > 0.8) { e.state = "chase"; e.stateT = 0; }
        if (e.state === "hit" && e.stateT > 0.35) { e.state = "chase"; e.stateT = 0; }
      }
      if ((e.type === 0 && e.state === "chase") || (e.type === 1 && e.state !== "dying")) {
        if (e.type === 1 && d < 9) g.bossNear = true;
        if (d < 12 && d > 0.8 && lineClear(g, e.x, e.y)) {
          const v = (e.type === 1 ? 1.1 : 0.9) * dt;
          const nx = e.x + (dx / d) * v, ny = e.y + (dy / d) * v;
          if (!solid(g, nx, e.y)) e.x = nx;
          if (!solid(g, e.x, ny)) e.y = ny;
        }
        if (d < 1.0) {
          g.hp -= (e.type === 1 ? 20 : 9) * dt;
          if (g.hurt <= 0) { g.hurt = 0.25; if (Math.random() < 0.15) say(g, LINES.hurt, 2.5); }
        }
      }
    }
    if (g.hp <= 0 && g.msg !== "GAME OVER") { g.hp = 0; say(g, "GAME OVER", 99); }

    // ---------- render: floor & ceiling (floor_shader fog) ----------
    const dirX = Math.cos(g.dir), dirY = Math.sin(g.dir);
    const plX = -dirY * 0.66, plY = dirX * 0.66;
    const half = H / 2;
    const fog = (d: number, max: number, min: number) => g.torch ? Math.min(0.9, Math.max(0, (d - TORCH_RANGE) / (max - TORCH_RANGE))) : Math.min(1, Math.max(min, d / max));
    const shade = (col: number, f: number) => {
      const m = 1 - f;
      return (255 << 24) | ((((col >> 16) & 255) * m) << 16) | ((((col >> 8) & 255) * m) << 8) | ((col & 255) * m);
    };
    const fl = a.floor, ce = a.ceil;
    for (let y = half + 1; y < H; y++) {
      const rowDist = (0.5 * H) / (y - half);
      const sx = (rowDist * 2 * plX) / W, sy = (rowDist * 2 * plY) / W;
      let fx = g.px + rowDist * (dirX - plX), fy = g.py + rowDist * (dirY - plY);
      const f = fog(rowDist, MAX_FLOOR, 0.3);
      const yc = H - y - 1;
      for (let x = 0; x < W; x++) {
        const ux = fx - Math.floor(fx), uy = fy - Math.floor(fy);
        fx += sx; fy += sy;
        px[y * W + x] = shade(fl.d[((uy * fl.h) | 0) * fl.w + ((ux * fl.w) | 0)], f);
        px[yc * W + x] = shade(ce.d[((uy * ce.h) | 0) * ce.w + ((ux * ce.w) | 0)], f);
      }
    }
    // ---------- walls (wall_shader fog) ----------
    for (let x = 0; x < W; x++) {
      const cam = (2 * x) / W - 1;
      const rdx = dirX + plX * cam, rdy = dirY + plY * cam;
      let mx = Math.floor(g.px), my = Math.floor(g.py);
      const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
      const stx = rdx < 0 ? -1 : 1, sty = rdy < 0 ? -1 : 1;
      let sdx = rdx < 0 ? (g.px - mx) * ddx : (mx + 1 - g.px) * ddx;
      let sdy = rdy < 0 ? (g.py - my) * ddy : (my + 1 - g.py) * ddy;
      let side = 0, tile = 1;
      for (let i = 0; i < 128; i++) {
        if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; }
        tile = g.map[my]?.[mx] ?? 1;
        if (tile) break;
      }
      const perp = side === 0 ? sdx - ddx : sdy - ddy;
      z[x] = perp;
      const lh = Math.floor(H / perp);
      const ds = Math.max(0, Math.floor(half - lh / 2)), de = Math.min(H - 1, Math.floor(half + lh / 2));
      let wx = side === 0 ? g.py + perp * rdy : g.px + perp * rdx;
      wx -= Math.floor(wx);
      const t = a.tex[TILE_TEX[tile] ?? "wall1"];
      let tx = Math.floor(wx * t.w);
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = t.w - tx - 1;
      const step = t.h / lh;
      let tp = (ds - half + lh / 2) * step;
      const f = Math.min(1, fog(perp, MAX_WALL, 0.2) + (side ? 0.08 : 0));
      for (let y = ds; y <= de; y++) {
        px[y * W + x] = shade(t.d[Math.min(t.h - 1, tp | 0) * t.w + tx], f);
        tp += step;
      }
    }
    // ---------- sprites (sorted far → near, z-buffered) ----------
    const inv = 1 / (plX * dirY - dirX * plY);
    const vis = g.ents.filter((e) => e.alive).map((e) => ({ e, d: (e.x - g.px) ** 2 + (e.y - g.py) ** 2 })).filter((o) => o.d < 400).sort((p, q) => q.d - p.d);
    for (const { e } of vis) {
      const sh = SHEETS[e.type], sheet = a.sheets[e.type];
      let frame: number;
      if (e.type === 0) {
        frame = e.state === "disguised" ? Math.floor(e.t * 6) % 6
          : e.state === "transform" ? 6 + Math.min(4, Math.floor(e.stateT * 6))
          : e.state === "hit" ? 22 + Math.min(3, Math.floor(e.stateT * 10))
          : e.state === "dying" ? 26 + Math.min(5, Math.floor(e.stateT * 5))
          : 11 + (Math.floor(e.t * 8) % 6);
      } else if (e.type === 1) {
        const d = Math.hypot(e.x - g.px, e.y - g.py);
        frame = e.state === "dying" ? 54 + Math.min(31, Math.floor(e.stateT * 12)) : d < 1.4 ? 6 + (Math.floor(e.t * 14) % 32) : Math.floor(e.t * 6) % 6;
      } else frame = Math.floor(e.t * 10) % sh.n;
      const rx = e.x - g.px, ry = e.y - g.py;
      const tX = inv * (dirY * rx - dirX * ry), tY = inv * (-plY * rx + plX * ry);
      if (tY <= 0.15) continue;
      const scx = Math.floor((W / 2) * (1 + tX / tY));
      const scale = e.type === 1 ? 1.5 : e.type >= 2 && e.type <= 4 ? 0.5 : 1;
      const sH = Math.abs(H / tY) * scale, sW = sH * (sh.fw / 64);
      const y0 = Math.floor(half + (H / tY) / 2 - sH), x0 = Math.floor(scx - sW / 2);
      const f = fog(tY, MAX_WALL, 0.2);
      const hit = e.state === "hit" || (e.type === 1 && g.cast > 0.3 && Math.abs(scx - W / 2) < sW / 2);
      for (let sx = Math.max(0, x0); sx < Math.min(W, x0 + sW); sx++) {
        if (tY >= z[sx]) continue;
        const u = Math.floor(((sx - x0) / sW) * sh.fw) + frame * sh.fw;
        for (let sy = Math.max(0, y0); sy < Math.min(H, y0 + sH); sy++) {
          const v = Math.floor(((sy - y0) / sH) * sheet.h);
          const col = sheet.d[v * sheet.w + u];
          if ((col >>> 24) < 128) continue;
          px[sy * W + sx] = hit ? 0xffffffff : shade(col, e.type === 7 ? 0 : f);
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    // ---------- overlay: hands, HUD, minimap, text ----------
    ctx.imageSmoothingEnabled = false;
    const bob = Math.sin(g.t * 7) * (keys.current.size ? 3 : 1);
    const hand = g.cast > 0 ? a.img[`spell_1_${Math.min(3, 1 + Math.floor((0.45 - g.cast) / 0.15))}`] : g.torch ? a.img.torch_player : a.img.free_hands;
    const hs = 1.25;
    ctx.drawImage(hand, Math.floor(W / 2 - (hand.width * hs) / 2), Math.floor(H - hand.height * hs + 6 + bob), hand.width * hs, hand.height * hs);
    if (g.cast > 0.25) {
      const p = (g.cast - 0.25) / 0.2;
      const gr = ctx.createRadialGradient(W / 2, half, 0, W / 2, half, 30 + 60 * (1 - p));
      gr.addColorStop(0, `rgba(255,170,220,${0.7 * p})`); gr.addColorStop(1, "rgba(255,120,200,0)");
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
    if (g.hurt > 0) { ctx.fillStyle = `rgba(160,0,0,${g.hurt * 1.6})`; ctx.fillRect(0, 0, W, H); }
    ctx.drawImage(a.img.xhair, W / 2 - 8, half - 8, 16, 16);
    // HUD kit: Player_hud.png 133×36 with three filler lines
    const hx = W - 133 - 6, hy = H - 36 - 6;
    ctx.drawImage(a.img.player_hud, hx, hy);
    ctx.drawImage(a.img.skeleton_head, hx + 4, hy + 3, 26, 26);
    const bar = (im: HTMLImageElement, v: number, y: number) => ctx.drawImage(im, 0, 0, Math.max(1, im.width * v), im.height, hx + 41, hy + y, Math.max(1, im.width * v), im.height);
    // positions.h: blood line on top, then mana, then stamina
    bar(a.img.blood, g.hp / 100, 17);
    bar(a.img.mana, g.mana / 500, 23);
    bar(a.img.stamina, g.stamina / 200, 30);
    // boss bar
    const boss = g.ents.find((e) => e.type === 1);
    if (boss && boss.alive && g.bossNear) {
      const bx = W / 2 - 96, by = 8;
      ctx.drawImage(a.img.bossbar, bx, by);
      ctx.drawImage(a.img.boss_filler, 0, 0, a.img.boss_filler.width * (boss.hp / 600), 9, bx + 2, by + 4, a.img.boss_filler.width * Math.max(0, boss.hp / 600), 9);
    }
    // minimap (HUD_MAP_X/Y = 10): local window around the player
    const R = 9, ms = 3, mmx = 8, mmy = 8;
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(mmx - 1, mmy - 1, (2 * R + 1) * ms + 2, (2 * R + 1) * ms + 2);
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const t = g.map[Math.floor(g.py) + y]?.[Math.floor(g.px) + x];
      if (!t) continue;
      ctx.fillStyle = t === 4 ? "#b91c1c" : t === 2 || t === 3 ? "#d6c39a" : "#6b5a48";
      ctx.fillRect(mmx + (x + R) * ms, mmy + (y + R) * ms, ms, ms);
    }
    for (const e of g.ents) {
      if (!e.alive || Math.abs(e.x - g.px) > R || Math.abs(e.y - g.py) > R) continue;
      ctx.fillStyle = e.type <= 1 ? "#ef4444" : e.type === 2 ? "#facc15" : e.type <= 4 ? "#60a5fa" : "#a3a3a3";
      ctx.fillRect(mmx + (e.x - Math.floor(g.px) + R) * ms - 1, mmy + (e.y - Math.floor(g.py) + R) * ms - 1, 2, 2);
    }
    ctx.fillStyle = accent;
    ctx.fillRect(mmx + (g.px - Math.floor(g.px) + R) * ms - 1, mmy + (g.py - Math.floor(g.py) + R) * ms - 1, 3, 3);
    // inventory + text (alagard)
    ctx.font = "10px alagard, monospace";
    ctx.textAlign = "left"; ctx.fillStyle = "#e7d8b8";
    ctx.fillText(`PV ${g.inv.hp} [L]   MANA ${g.inv.mana} [M]   ${g.inv.key ? "CLE ✓" : ""}`, 8, H - 8);
    ctx.textAlign = "right";
    ctx.fillText(`yokai ${g.kills}`, W - 8, 74);
    if (g.msgT > 0) {
      ctx.textAlign = "center"; ctx.font = g.msg === "GAME OVER" ? "28px alagard, monospace" : "11px alagard, monospace";
      const y = g.msg === "GAME OVER" || g.won ? half : H - 62;
      const tw = ctx.measureText(g.msg).width;
      ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(W / 2 - tw / 2 - 6, y - 12, tw + 12, g.msg === "GAME OVER" ? 34 : 17);
      ctx.fillStyle = g.msg === "GAME OVER" ? "#dc2626" : "#f5ecd7"; ctx.fillText(g.msg, W / 2, y + (g.msg === "GAME OVER" ? 12 : 0));
      if (g.hp <= 0 || g.won) { ctx.font = "9px alagard, monospace"; ctx.fillStyle = "#d6d3d1"; ctx.fillText("Entree pour recommencer", W / 2, y + 36); }
    }
    ctx.textAlign = "left";
  }, running && !!assets);

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      role="application"
      aria-label="Wolf3D game. Z Q S D or W A S D to move, arrows to turn, E to cast, F to open doors, R torch, L and M potions."
      className="relative h-full w-full cursor-crosshair bg-black outline-none"
    >
      <canvas ref={canvasRef} width={W} height={H} aria-hidden className="h-full w-full [image-rendering:pixelated]" />
      {(title || !assets) && (
        <button
          className="absolute inset-0 grid place-items-center bg-cover bg-center text-center"
          style={{ backgroundImage: `url(${BASE}main_menu.jpg)` }}
          onClick={() => { setTitle(false); wrapRef.current?.focus(); }}
          disabled={!assets}
        >
          <div className="rounded-lg bg-black/45 px-6 py-4 backdrop-blur-[2px]" style={{ fontFamily: "alagard, serif" }}>
            <p lang="fr" className="text-xl text-stone-100 sm:text-3xl">Le Palais du Crépuscule</p>
            <p className="mt-2 text-xs text-stone-300 sm:text-sm">{error ? "Could not load the game assets." : assets ? "Click to enter the palace" : "Loading the palace…"}</p>
          </div>
        </button>
      )}
      {!title && !focused && assets && (
        <div className="pointer-events-none absolute inset-x-0 top-[58%] text-center">
          <span className="rounded-full bg-black/60 px-3 py-1 font-mono text-[11px] text-white/85">click to play · E / click cast · F door · L / M potions</span>
        </div>
      )}
    </div>
  );
}
