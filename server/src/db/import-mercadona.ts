/**
 * Importa el catálogo de Mercadona a la base de datos.
 *
 * El catálogo se descargó recorriendo la API pública de Mercadona (warehouse
 * `vlc1`, CP 46117) y vive en `mercadona-seed.json`. Este script lo vuelca en
 * la tabla `mercadona_products`, marcando como favoritos los ~73 productos
 * habituales de la pareja (con su orden).
 *
 * Es idempotente: hace upsert por `id`, así que reejecutarlo con un seed nuevo
 * refresca precios y datos sin duplicar filas ni tocar el carrito.
 *
 * Uso: `npm run db:import-mercadona` (con DATABASE_URL en el entorno).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { count, sql } from "drizzle-orm";

import { db, pool } from "./client.js";
import { mercadonaProducts } from "./schema.js";

// Al arrancar el contenedor sólo interesa sembrar la PRIMERA vez: reimportar
// 4000+ filas en cada reinicio ralentizaría el arranque para nada. Con
// `--if-empty`, si ya hay catálogo, no hace nada. Sin el flag (ejecución
// manual), reimporta siempre y refresca precios.
const ifEmpty = process.argv.includes("--if-empty");
if (ifEmpty) {
  const [{ n }] = await db.select({ n: count() }).from(mercadonaProducts);
  if (n > 0) {
    console.log(`Catálogo de Mercadona ya poblado (${n} productos); no se reimporta.`);
    await pool.end();
    process.exit(0);
  }
}

interface SeedProduct {
  id: string;
  name: string;
  packaging: string;
  thumbnail: string;
  priceCents: number;
  category: string;
  favorite: boolean;
  position: number;
}

const here = dirname(fileURLToPath(import.meta.url));
// El JSON se copia junto a los .js compilados (ver Dockerfile / build).
const seedPath = join(here, "mercadona-seed.json");
const products = JSON.parse(readFileSync(seedPath, "utf8")) as SeedProduct[];

console.log(`Importando ${products.length} productos de Mercadona…`);

const now = new Date();
let n = 0;
// En lotes para no mandar 4000 filas en un solo statement.
const BATCH = 500;
for (let i = 0; i < products.length; i += BATCH) {
  const chunk = products.slice(i, i + BATCH).map((p) => ({ ...p, refreshedAt: now }));
  await db
    .insert(mercadonaProducts)
    .values(chunk)
    .onConflictDoUpdate({
      target: mercadonaProducts.id,
      set: {
        name: sql`excluded.name`,
        packaging: sql`excluded.packaging`,
        thumbnail: sql`excluded.thumbnail`,
        priceCents: sql`excluded.price_cents`,
        category: sql`excluded.category`,
        favorite: sql`excluded.favorite`,
        position: sql`excluded.position`,
        refreshedAt: sql`excluded.refreshed_at`,
        updatedAt: now,
      },
    });
  n += chunk.length;
  console.log(`  ${n}/${products.length}`);
}

const favs = products.filter((p) => p.favorite).length;
console.log(`Hecho: ${n} productos, ${favs} marcados como favoritos.`);
await pool.end();
