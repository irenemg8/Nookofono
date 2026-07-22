/**
 * El Pugporte.
 *
 * Hay exactamente dos filas, una por persona, así que no hay creación ni
 * borrado: sólo leer y actualizar.
 */
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "../db/client.js";
import { profiles } from "../db/schema.js";
import type { AuthVars } from "../auth/middleware.js";

const app = new Hono<{ Bindings: Record<string, never>; Variables: AuthVars }>();

const person = z.enum(["irene", "vicente"]);

const patchSchema = z.object({
  islandName: z.string().max(60).nullish(),
  nativeFruit: z.string().max(40).nullish(),
  birthday: z.string().regex(/^\d{2}-\d{2}$/, "Cumpleaños con formato MM-DD").nullish(),
  registeredAt: z.string().max(40).nullish(),
  photoKey: z.string().max(200).nullish(),
  title: z.string().max(60).nullish(),
  // 24 caracteres es el límite del juego, y el bocadillo está dibujado para esa
  // longitud: más texto se sale de la burbuja.
  comment: z.string().max(24, "El comentario admite 24 caracteres").nullish(),
  zodiac: z.string().max(20).nullish(),
});

app.get("/:personId", async (c) => {
  const id = person.safeParse(c.req.param("personId"));
  if (!id.success) {
    return c.json({ error: { code: "NOT_FOUND", message: "No existe" } }, 404);
  }

  const row = await db.query.profiles.findFirst({ where: eq(profiles.personId, id.data) });
  if (!row) return c.json({ error: { code: "NOT_FOUND", message: "No existe" } }, 404);
  return c.json(row);
});

app.patch("/:personId", async (c) => {
  const id = person.safeParse(c.req.param("personId"));
  if (!id.success) {
    return c.json({ error: { code: "NOT_FOUND", message: "No existe" } }, 404);
  }

  // Cada uno edita su propio pasaporte.
  if (id.data !== c.get("personId")) {
    return c.json({ error: { code: "FORBIDDEN", message: "Ese pasaporte no es tuyo" } }, 403);
  }

  const parsed = patchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: { code: "INVALID_BODY", message: "Datos inválidos", detail: parsed.error.issues } },
      400,
    );
  }

  const [row] = await db
    .update(profiles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(profiles.personId, id.data))
    .returning();

  return c.json(row);
});

export default app;
