import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const run = promisify(execFile);

/**
 * Icônes de l'app de bureau, produites depuis la MÊME marque que le mobile
 * (`liri logo officielle2.png`, marque + wordmark sur fond transparent).
 *
 * On garde la marque seule, posée sur le fond LIRI #262624 :
 *   - macOS  → .icns via `iconutil` (jeu de tailles Retina complet)
 *   - Windows→ .ico multi-tailles (16 → 256)
 *   - PNG 512 pour la fenêtre et un éventuel paquet Linux
 */
const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.resolve(ROOT, '../..', 'liri logo officielle2.png');
const OUT = path.join(ROOT, 'assets');
const BASE = { r: 0x26, g: 0x26, b: 0x24 };
const CUT_Y = 700; // le wordmark « LIRI » commence sous la marque

async function markBox() {
  const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < Math.min(CUT_Y, info.height); y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Carré `size`, marque centrée à `ratio`, fond LIRI opaque. */
async function tile(box, size, ratio = 0.62) {
  const inner = Math.round(size * ratio);
  const mark = await sharp(SRC).extract(box)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
    .png().toBuffer();
  const off = Math.round((size - inner) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background: { ...BASE, alpha: 1 } } })
    .composite([{ input: mark, left: off, top: off }])
    .png().toBuffer();
}

const box = await markBox();
await mkdir(OUT, { recursive: true });

// PNG générique (fenêtre, Linux)
await writeFile(path.join(OUT, 'icon.png'), await tile(box, 512));

// ── macOS : .icns ─────────────────────────────────────────────────────────
const iconset = path.join(OUT, 'icon.iconset');
await rm(iconset, { recursive: true, force: true });
await mkdir(iconset, { recursive: true });
for (const [size, name] of [
  [16, 'icon_16x16.png'], [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'], [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'], [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'], [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'], [1024, 'icon_512x512@2x.png'],
]) {
  await writeFile(path.join(iconset, name), await tile(box, size));
}
await run('iconutil', ['-c', 'icns', iconset, '-o', path.join(OUT, 'icon.icns')]);
await rm(iconset, { recursive: true, force: true });

// ── Windows : .ico ────────────────────────────────────────────────────────
// Conteneur ICO écrit à la main : `sharp` ne sait pas l'produire, et une
// dépendance de plus pour six PNG concaténés ne se justifie pas.
const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = [];
for (const s of sizes) pngs.push(await tile(box, s));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
const dir = Buffer.alloc(16 * sizes.length);
let offset = 6 + dir.length;
sizes.forEach((s, i) => {
  const e = i * 16;
  dir.writeUInt8(s >= 256 ? 0 : s, e);      // largeur (0 = 256)
  dir.writeUInt8(s >= 256 ? 0 : s, e + 1);  // hauteur
  dir.writeUInt8(0, e + 2);                 // palette
  dir.writeUInt8(0, e + 3);                 // réservé
  dir.writeUInt16LE(1, e + 4);              // plans
  dir.writeUInt16LE(32, e + 6);             // bits par pixel
  dir.writeUInt32LE(pngs[i].length, e + 8);
  dir.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
await writeFile(path.join(OUT, 'icon.ico'), Buffer.concat([header, dir, ...pngs]));

console.log('icônes desktop générées dans', OUT);
