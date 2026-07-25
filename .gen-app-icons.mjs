/**
 * Génère la famille d'icônes de l'app LIRI depuis la marque officielle.
 * Source : "liri logo officielle2.png" (1536×1024, marque + wordmark, fond transparent).
 * On ne garde que la MARQUE (au-dessus du wordmark) et on la pose sur le fond LIRI #262624.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = '/Users/ngowazulu/Downloads/cimolace/liri logo officielle2.png';
const OUT = '/Users/ngowazulu/Downloads/cimolace/apps/mobile/assets/images';
const BASE = { r: 0x26, g: 0x26, b: 0x24 }; // fond LIRI --base
const CUT_Y = 700; // le wordmark « LIRI » commence en dessous

/** Boîte englobante des pixels non transparents dans la zone gardée. */
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

/** La marque seule, recadrée au plus juste, sur fond transparent. */
async function mark(size) {
  const box = await markBox();
  return sharp(SRC).extract(box)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
    .png().toBuffer();
}

/** Marque centrée sur un carré, à `ratio` de la largeur. `bg` null = transparent. */
async function tile(size, ratio, bg) {
  const inner = Math.round(size * ratio);
  const m = await mark(inner);
  const canvas = sharp({
    create: { width: size, height: size, channels: 4, background: bg ? { ...bg, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  const off = Math.round((size - inner) / 2);
  return canvas.composite([{ input: m, left: off, top: off }]);
}

await mkdir(OUT, { recursive: true });

// 1. Icône iOS/générale — 1024², fond opaque, SANS canal alpha (l'App Store rejette l'alpha).
await (await tile(1024, 0.6, BASE)).flatten({ background: BASE }).removeAlpha().png().toFile(`${OUT}/icon.png`);

// 2. Android adaptive : la marque doit tenir dans la zone sûre (~66 % du canevas).
await (await tile(1024, 0.44, null)).png().toFile(`${OUT}/android-icon-foreground.png`);
await sharp({ create: { width: 1024, height: 1024, channels: 3, background: BASE } })
  .png().toFile(`${OUT}/android-icon-background.png`);

// 3. Monochrome (thèmes Android 13+) : silhouette blanche de la marque.
{
  const inner = Math.round(1024 * 0.44);
  const alpha = await sharp(await mark(inner)).extractChannel('alpha').toBuffer();
  const white = await sharp({ create: { width: inner, height: inner, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .joinChannel(alpha).png().toBuffer();
  const off = Math.round((1024 - inner) / 2);
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: white, left: off, top: off }]).png().toFile(`${OUT}/android-icon-monochrome.png`);
}

// 4. Splash : marque seule, transparente (le plugin pose le fond).
await sharp(await mark(512)).png().toFile(`${OUT}/splash-icon.png`);

// 5. Marque affichée DANS l'app (connexion, accueil, Brain) via <LiriMark>.
await sharp(await mark(512)).png().toFile(`${OUT}/liri-mark.png`);

// 5. Favicon web.
await (await tile(64, 0.66, BASE)).png().toFile(`${OUT}/favicon.png`);

console.log('icônes générées dans', OUT);
