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
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = fileURLToPath(new URL("../public/icons/", import.meta.url));

const GREEN = "#5DBB63";
const CREAM = "#FDF8E3";

/** La hoja: dos arcos que se tocan en las puntas, más el nervio central. */
function leafSvg(size, scale) {
  const pad = (1 - scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${GREEN}"/>
  <g transform="translate(${512 * pad} ${512 * pad}) scale(${scale})">
    <path d="M96 416C96 224 224 96 416 96 416 288 288 416 96 416Z" fill="${CREAM}"/>
    <path d="M118 394 394 118" stroke="${GREEN}" stroke-width="30" stroke-linecap="round"/>
  </g>
</svg>`;
}

const targets = [
  { file: "icon-192.png", size: 192, scale: 0.82 },
  { file: "icon-512.png", size: 512, scale: 0.82 },
  { file: "icon-maskable-512.png", size: 512, scale: 0.62 },
  { file: "apple-touch-icon.png", size: 180, scale: 0.82 },
];

await mkdir(OUT, { recursive: true });

for (const { file, size, scale } of targets) {
  const png = await sharp(Buffer.from(leafSvg(size, scale)))
    .resize(size, size)
    .png()
    .toBuffer();
  await writeFile(OUT + file, png);
  console.log(`  ${file}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} kB`);
}

console.log(`\n${targets.length} iconos generados en public/icons/`);
