/**
 * Genera los iconos de instalación de la PWA.
 *
 *   node scripts/build-pwa-icons.mjs
 *
 * Dibuja la hoja de Animal Crossing sobre el verde de Nook Inc. y exporta los
 * tamaños que piden iOS y Android. Se regenera solo, así que no hay que
 * versionar ningún editor de imágenes.
 *
 * - `icon-192` / `icon-512`  → manifiesto (Android, escritorio)
 * - `icon-maskable-512`      → Android recorta a círculo: el dibujo va al 62 %
 *                              para que no se coma los bordes
 * - `apple-touch-icon` (180) → iOS. **Sin transparencia**: iOS la rellena de
 *                              negro, y quedaría un icono con marco oscuro.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = fileURLToPath(new URL("../public/icons/", import.meta.url));
const SOURCE = fileURLToPath(
  new URL("../src/assets/problemas_a_resolver_y_charla_profunda.webp", import.meta.url),
);

/** Rosa del fondo del icono, para rellenar el margen de la versión maskable. */
const BG = "#F2907F";

const source = await readFile(SOURCE);

const targets = [
  { file: "icon-192.png", size: 192, scale: 1 },
  { file: "icon-512.png", size: 512, scale: 1 },
  { file: "icon-maskable-512.png", size: 512, scale: 0.72 },
  { file: "apple-touch-icon.png", size: 180, scale: 1 },
];

await mkdir(OUT, { recursive: true });

for (const { file, size, scale } of targets) {
  const inner = Math.round(size * scale);
  const pad = Math.round((size - inner) / 2);

  let img = sharp(source).resize(inner, inner, { fit: "cover" });

  // La versión maskable la recorta Android a un círculo, así que el dibujo se
  // encoge y el resto se rellena con el rosa del propio icono.
  if (scale < 1) {
    img = img.extend({
      top: pad,
      bottom: size - inner - pad,
      left: pad,
      right: size - inner - pad,
      background: BG,
    });
  }

  // Sin transparencia: iOS rellena de negro el canal alfa y quedaría un marco.
  const png = await img.flatten({ background: BG }).png().toBuffer();
  await writeFile(OUT + file, png);
  console.log(`  ${file}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} kB`);
}

console.log(`\n${targets.length} iconos generados en public/icons/`);
