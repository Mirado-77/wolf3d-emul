import { BASE, HAND_IMAGES, HUD_IMAGES, SHEETS, TILE_TEX } from "./config";
import { parseEntities, parseMap } from "./parse";
import type { Assets, Tex } from "./types";

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
  const i = new Image();
  i.onload = () => res(i);
  i.onerror = rej;
  i.src = src;
});

const loadText = (path: string) => fetch(`${BASE}${path}`).then((r) => r.text());

/** Decode an image into raw pixels so the raycaster can read them fast. */
function toTex(img: HTMLImageElement): Tex {
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0);
  return { w: img.width, h: img.height, d: new Uint32Array(x.getImageData(0, 0, img.width, img.height).data.buffer) };
}

async function loadFont() {
  try {
    const font = new FontFace("alagard", `url(${BASE}alagard.ttf)`);
    document.fonts.add(await font.load());
  } catch { /* fall back to monospace */ }
}

let assetsPromise: Promise<Assets> | null = null;

/** Load every image, map and config file once; later calls reuse the same promise. */
export function loadAssets(): Promise<Assets> {
  assetsPromise ??= (async () => {
    const texNames = [...new Set(Object.values(TILE_TEX)), "floor1", "ceiling1"];
    const [texImgs, sheetImgs, hudImgs, handImgs, mapTxt, objTxt, entTxt] = await Promise.all([
      Promise.all(texNames.map((n) => loadImg(`${BASE}tex/${n}.png`))),
      Promise.all(SHEETS.map((s) => loadImg(`${BASE}sprites/${s.file}.png`))),
      Promise.all(HUD_IMAGES.map((n) => loadImg(`${BASE}hud/${n}.png`))),
      Promise.all(HAND_IMAGES.map((n) => loadImg(`${BASE}hands/${n}.png`))),
      loadText("map.txt"),
      loadText("objects.txt"),
      loadText("entities.txt"),
    ]);
    await loadFont();

    const tex: Record<string, Tex> = {};
    texNames.forEach((n, i) => (tex[n] = toTex(texImgs[i])));
    const img: Record<string, HTMLImageElement> = {};
    HUD_IMAGES.forEach((n, i) => (img[n] = hudImgs[i]));
    HAND_IMAGES.forEach((n, i) => (img[n] = handImgs[i]));

    return {
      tex,
      floor: tex.floor1,
      ceil: tex.ceiling1,
      sheets: sheetImgs.map(toTex),
      img,
      map0: parseMap(mapTxt),
      ents0: parseEntities(objTxt, entTxt),
    };
  })();
  return assetsPromise;
}
