/**
 * Cómo ha dejado cada uno su pantalla de inicio.
 *
 * No usa la fábrica CRUD porque no es una colección de filas con id: es un
 * diccionario por persona (`icon_order`, `dock`, `widgets`) que se lee entero y
 * se guarda entero.
 */
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "../db/client.js";
import { preferences } from "../db/schema.js";
import type { AuthVars } from "../auth/middleware.js";

const app = new Hono<{ Bindings: Record<string, never>; Variables: AuthVars }>();

/** Claves conocidas. Se limita para que un cliente no llene la tabla de basura. */
const KEYS = ["icon_order", "dock", "widgets", "theme"] as const;
const keySchema = z.enum(KEYS);

app.get("/", async (c) => {
  const rows = await db
    .select()
    .from(preferences)
    .where(eq(preferences.personId, c.get("personId")));

  // Se devuelve como objeto y no como lista: el frontend quiere leer
  // `prefs.icon_order`, no recorrer un array buscando la clave.
  const out: Record<string, unknown> = {};
  for (const row of rows) out[row.key] = row.value;
  return c.json(out);
});

app.put("/:key", async (c) => {
  const key = keySchema.safeParse(c.req.param("key"));
  if (!key.success) {
    return c.json({ error: { code: "UNKNOWN_KEY", message: "Preferencia desconocida" } }, 400);
  }

  const body = await c.req.json().catch(() => undefined);
  if (body === undefined) {
    return c.json({ error: { code: "INVALID_BODY", message: "Falta el valor" } }, 400);
  }

  const personId = c.get("personId");
  const [row] = await db
    .insert(preferences)
    .values({ personId, key: key.data, value: body })
    .onConflictDoUpdate({
      target: [preferences.personId, preferences.key],
      set: { value: body, updatedAt: new Date() },
    })
    .returning();

  return c.json({ key: row.key, value: row.value });
});

app.delete("/:key", async (c) => {
  const key = keySchema.safeParse(c.req.param("key"));
  if (!key.success) {
    return c.json({ error: { code: "UNKNOWN_KEY", message: "Preferencia desconocida" } }, 400);
  }

  await db
    .delete(preferences)
    .where(and(eq(preferences.personId, c.get("personId")), eq(preferences.key, key.data)));

  return c.body(null, 204);
});

export default app;
