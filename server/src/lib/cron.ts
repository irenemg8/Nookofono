/**
 * Recordatorios de servidor.
 *
 * Dos avisos que el navegador no puede dar porque la app estará cerrada a esas
 * horas, así que viven en el servidor como crons:
 *
 *   - **Por hablar**, cada día a las 20:00: si quedan temas sin hablar, avisa.
 *   - **Casa**, cada domingo a las 21:00: si hay tareas del hogar pendientes,
 *     avisa. "Pendiente" se calcula con la MISMA regla que el frontend
 *     (`isPending` en `src/apps/home/index.tsx`): una tarea vuelve a estar
 *     pendiente sola cuando su cadencia vence desde la última vez que se hizo.
 *
 * Los otros avisos (al publicar un tema, al abrir un parte, al empezar la regla)
 * ya los manda el frontend por ntfy; aquí sólo van los que dependen de la hora.
 */
import cron from "node-cron";
import { eq } from "drizzle-orm";

import { db } from "../db/client.js";
import { chores, talks } from "../db/schema.js";

const TALKS_TOPIC = "ipug-porhablar-3d7a1f9c6b2e";
const CASA_TOPIC = "ipug-casa-4b8f1e6d3a29";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Manda una notificación a ntfy. Best-effort: si falla, se registra y ya. */
async function notify(topic: string, title: string, body: string, tags?: string): Promise<void> {
  try {
    const res = await fetch(`https://ntfy.sh/${topic}`, {
      method: "POST",
      headers: {
        Title: title,
        Priority: "high",
        ...(tags ? { Tags: tags } : {}),
      },
      body,
    });
    if (!res.ok) throw new Error(String(res.status));
  } catch (err) {
    console.error(`ntfy: no se pudo avisar a ${topic}:`, err);
  }
}

/** La misma regla que el frontend: ¿toca hacer esta tarea de casa ya? */
function isChorePending(c: { everyWeeks: number; lastDoneAt: number | null }, now: number): boolean {
  if (!c.lastDoneAt) return true; // nunca se ha hecho
  if (c.everyWeeks <= 0) return false; // puntual y ya hecha
  return now - c.lastDoneAt >= c.everyWeeks * WEEK_MS;
}

async function remindTalks(): Promise<void> {
  const pending = await db.select().from(talks).where(eq(talks.done, false));
  if (pending.length === 0) return;
  await notify(
    TALKS_TOPIC,
    "Temas por hablar",
    `Tenéis ${pending.length} tema(s) sin hablar. ¿Un ratito esta noche?`,
  );
}

async function remindChores(): Promise<void> {
  const now = Date.now();
  const rows = await db.select().from(chores);
  const pending = rows.filter((c) => isChorePending(c, now));
  if (pending.length === 0) return;
  await notify(
    CASA_TOPIC,
    "Tareas de casa",
    `Queda(n) ${pending.length} sin hacer: ${pending.map((c) => c.title).join(", ")}`,
    "house",
  );
}

/** Programa los crons. Se llama una vez al arrancar el server. */
export function startCrons(): void {
  const tz = "Europe/Madrid";
  // Cada día a las 20:00 → Por hablar.
  cron.schedule("0 20 * * *", () => void remindTalks(), { timezone: tz });
  // Cada domingo a las 21:00 → Casa.
  cron.schedule("0 21 * * 0", () => void remindChores(), { timezone: tz });
  console.log("iPug: crons de recordatorios programados (Europe/Madrid)");
}
