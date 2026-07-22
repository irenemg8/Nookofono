/**
 * Convierte los fondos de pantalla a WebP.
 *
 *   node scripts/build-wallpapers.mjs [carpeta-origen]
 *
 * Por defecto lee de `~/Downloads`. Busca `day_principal`, `night_principal` y
 * `night` en cualquier formato y los deja en `src/assets/wallpapers/` como
 * WebP, sustituyendo lo que hubiera.
 *
 * El ancho de destino es 1290 px, que es el del iPhone 15 Pro Max a 3×. Subir
 * de ahí sólo engorda el fichero: ninguna pantalla del proyecto lo aprovecha.
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SRC = process.argv[2] ?? join(homedir(), "Downloads");
const OUT = fileURLToPath(new URL("../src/assets/wallpapers/", import.meta.url));
const WIDTH = 1290;
const QUALITY = 85;
const WANTED = ["day_principal", "night_principal", "night"];

await mkdir(OUT, { recursive: true });
const files = await readdir(SRC);

for (const name of WANTED) {
  // Se prefiere el original sin comprimir si hay varios formatos del mismo
  // nombre: convertir un WebP a WebP acumularía artefactos.
  const candidates = files
    .filter((f) => f.slice(0, -extname(f).length) === name)
    .sort((a, b) => rank(a) - rank(b));

  if (candidates.length === 0) {
    console.log(`  ⚠ ${name}: no encontrado en ${SRC}`);
    continue;
  }

  const src = join(SRC, candidates[0]);
  const input = await readFile(src);
  const meta = await sharp(input).metadata();

  const output = await sharp(input)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();

  await writeFile(join(OUT, `${name}.webp`), output);

  const before = (await stat(src)).size;
  console.log(
    `  ${candidates[0]}  ${meta.width}×${meta.height} ${kb(before)} → ${name}.webp ${kb(output.length)}`,
  );
}

function rank(file) {
  const order = { ".png": 0, ".jpg": 1, ".jpeg": 1, ".webp": 2 };
  return order[extname(file).toLowerCase()] ?? 9;
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(0)} kB`;
}
