/**
 * Pasos diarios.
 *
 * Contar pasos desde una web es imposible: lo hace un coprocesador del móvil al
 * que el navegador no llega (`PROYECTO.md` §9.5). La vía honesta es que el
 * propio teléfono los publique aquí:
 *
 *   - **iOS**: un Atajo con "Obtener datos de salud" → "Obtener contenido de
 *     URL" (POST) programado a diario.
 *   - **Android**: MacroDroid o Tasker leyendo Health Connect.
 *
 * `POST /` va autenticado con cabecera `X-Steps-Token` en lugar de la cookie de
 * sesión, porque un Atajo de iOS no gestiona cookies. Es un secreto distinto del
 * de las sesiones: si se filtra, lo único que permite es falsear un contador de
 * pasos, no leer los datos de la app.
 */
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { db } from "../db/client.js";
import { stepDays, walks } from "../db/schema.js";
import { requireAuth, type AuthVars } from "../auth/middleware.js";

const app = new Hono<{ Bindings: Record<string, never>; Variables: AuthVars }>();

const pushSchema = z.object({
  personId: z.enum(["irene", "vicente"]),
  /** El día al que corresponden los pasos, en hora local del móvil. */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha con formato YYYY-MM-DD"),
  steps: z.number().int().min(0).max(300_000),
  distanceM: z.number().int().min(0).max(1_000_000).default(0),
});

/** Comparación en tiempo constante: con `===` el tiempo de respuesta filtra el token. */
function sameToken(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

app.post("/", async (c) => {
  const expected = process.env.STEPS_TOKEN;
  if (!expected) {
    return c.json(
      { error: { code: "STEPS_DISABLED", message: "Falta STEPS_TOKEN en el servidor" } },
      503,
    );
  }

  const given = c.req.header("x-steps-token");
  if (!given || !sameToken(given, expected)) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Token inválido" } }, 401);
  }

  const parsed = pushSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: { code: "INVALID_BODY", message: "Datos inválidos", detail: parsed.error.issues } },
      400,
    );
  }

  const { personId, day, steps, distanceM } = parsed.data;

  // Reenviar el mismo día corrige el valor en vez de duplicar la fila: el Atajo
  // puede dispararse varias veces al día sin ensuciar nada.
  const [row] = await db
    .insert(stepDays)
    .values({ personId, day, steps, distanceM })
    .onConflictDoUpdate({
      target: [stepDays.personId, stepDays.day],
      set: { steps, distanceM, updatedAt: new Date() },
    })
    .returning();

  return c.json(row);
});

/**
 * Pasos REALES de un paseo con Nilo, medidos por el iPhone.
 *
 * El contador del navegador sólo cuenta con la pantalla encendida (Safari
 * suspende `devicemotion` al bloquear). La vía honesta es la misma que para los
 * pasos diarios: un Atajo de iOS lee de Salud los pasos entre la hora de inicio
 * y fin del paseo y los publica aquí. El paseo se identifica por su **franja
 * horaria**, no por id, para que el Atajo no necesite conocer el UUID: manda el
 * `startedAt`/`endedAt` del último paseo (que le da el GET de abajo) y aquí se
 * busca el paseo cuyo inicio cae en esa ventana.
 *
 * Va con el mismo `X-Steps-Token` que los pasos diarios: es el mismo dispositivo
 * y el mismo secreto, y lo peor que permite si se filtra es falsear un contador.
 */
const walkStepsSchema = z.object({
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  steps: z.number().int().min(0).max(300_000),
});

app.post("/walk", async (c) => {
  const expected = process.env.STEPS_TOKEN;
  if (!expected) {
    return c.json(
      { error: { code: "STEPS_DISABLED", message: "Falta STEPS_TOKEN en el servidor" } },
      503,
    );
  }

  const given = c.req.header("x-steps-token");
  if (!given || !sameToken(given, expected)) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Token inválido" } }, 401);
  }

  const parsed = walkStepsSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: { code: "INVALID_BODY", message: "Datos inválidos", detail: parsed.error.issues } },
      400,
    );
  }

  const { startedAt, endedAt, steps } = parsed.data;

  // El Atajo puede redondear los segundos, así que se busca el paseo cuyo inicio
  // caiga dentro de un margen de ±2 min de la ventana declarada, y se coge el más
  // reciente. Así "el paseo de las 18:03" se encuentra aunque el Atajo mande 18:04.
  const margin = 2 * 60_000;
  const from = new Date(startedAt.getTime() - margin);
  const to = new Date(endedAt.getTime() + margin);

  const [walk] = await db
    .select()
    .from(walks)
    .where(and(gte(walks.startedAt, from), lte(walks.startedAt, to)))
    .orderBy(desc(walks.startedAt))
    .limit(1);

  if (!walk) {
    return c.json(
      { error: { code: "NO_WALK", message: "Ningún paseo en esa franja horaria" } },
      404,
    );
  }

  const [row] = await db
    .update(walks)
    .set({ steps, stepsSource: "shortcut", updatedAt: new Date() })
    .where(eq(walks.id, walk.id))
    .returning();

  return c.json(row);
});

/** Historial reciente, para pintar la gráfica. Este sí va con sesión normal. */
app.get("/", requireAuth, async (c) => {
  const person = c.req.query("personId") ?? c.get("personId");
  const rows = await db
    .select()
    .from(stepDays)
    .where(eq(stepDays.personId, person))
    .orderBy(desc(stepDays.day))
    .limit(90);

  return c.json(rows);
});

export default app;
