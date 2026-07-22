/**
 * Aplica las migraciones pendientes y termina.
 *
 * Se ejecuta al arrancar el contenedor, antes de servir. Drizzle lleva su propia
 * tabla de control, así que repetirlo es inofensivo.
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { db, pool } from "./client.js";

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migraciones aplicadas.");
await pool.end();
