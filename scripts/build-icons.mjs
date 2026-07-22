/**
 * Normaliza los iconos de las apps a WebP cuadrado.
 *
 *   node scripts/build-icons.mjs
 *
 * Recorre `src/assets/`, convierte cualquier .png/.jpg/.jpeg a .webp de 512×512
 * y borra el original. Los .webp que ya midan más de 512px se reescalan.
 *
 * Nota de Windows: sharp mantiene abierto el fichero que lee, así que no se
 * puede escribir sobre él. Por eso cargamos siempre el origen a un buffer antes
 * de procesarlo.
 *
 * Ver docs/PROYECTO.md §3.6
 */
import { readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const DIR = fileURLToPath(new URL("../src/assets/", import.meta.url));
const SIZE = 512;
const QUALITY = 90;
const CONVERTIBLE = new Set([".png", ".jpg", ".jpeg"]);
const SKIP = new Set(["vite.svg", "ejemplo_movil.webp"]);

const files = await readdir(DIR);
let converted = 0;
let resized = 0;

for (const file of files) {
  if (SKIP.has(file)) continue;

  const ext = extname(file).toLowerCase();
  const isWebp = ext === ".webp";
  if (!CONVERTIBLE.has(ext) && !isWebp) continue;

  const src = join(DIR, file);
  const input = await readFile(src);
  const { width = 0 } = await sharp(input).metadata();

  if (isWebp && width <= SIZE) continue;

  const output = await sharp(input)
    .resize(SIZE, SIZE, { fit: "cover" })
    .webp({ quality: QUALITY })
    .toBuffer();

  const dest = isWebp ? src : join(DIR, `${file.slice(0, -ext.length)}.webp`);
  await writeFile(dest, output);

  if (isWebp) {
    console.log(`  ${file}  ${width}px → ${SIZE}px`);
    resized++;
  } else {
    await unlink(src);
    const saved = Math.round((1 - output.length / input.length) * 100);
    console.log(`  ${file} → ${file.slice(0, -ext.length)}.webp  (${saved}% menos)`);
    converted++;
  }
}

console.log(`\n${converted} convertidos a WebP, ${resized} reescalados.`);
