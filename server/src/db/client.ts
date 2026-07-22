/**
 * Conexión a Postgres.
 *
 * Un único pool para todo el proceso. `drizzle` no abre conexiones por su
 * cuenta: se limita a envolver el pool, así que crear la instancia aquí y
 * exportarla es suficiente.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema.js";

const url = process.env.DATABASE_URL;
if (!url) {
  // Sin base de datos no hay nada que servir: mejor no arrancar que responder
  // 500 en cada petición y descubrirlo con la app delante.
  throw new Error("Falta DATABASE_URL");
}

export const pool = new pg.Pool({
  connectionString: url,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema });
export { schema };
