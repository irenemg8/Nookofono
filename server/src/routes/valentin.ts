/**
 * Valentín — el chat de consejos con RAG sobre RAG-Pugtín.
 *
 * `POST /api/valentin/chat` recupera de `file_chunks` los trozos más relevantes
 * para el último mensaje del usuario. La GENERACIÓN de la respuesta necesita el
 * modelo fine-tuneado de Irene, que todavía no existe: mientras no esté, se
 * responde 503 con un mensaje honesto en vez de inventar consejos.
 *
 * El frontend (`src/apps/advice/model/brain.ts`) manda
 * `{ messages: [{role, content}] }` y espera `{ reply: string }`. Cuando haya
 * modelo, se sustituye el 503 por la llamada al modelo pasándole `context`.
 */
import { Hono } from "hono";
import { z } from "zod";

import type { AuthVars } from "../auth/middleware.js";
import { retrieve } from "../lib/rag.js";

type Env = { Bindings: Record<string, never>; Variables: AuthVars };

const r = new Hono<Env>();

const chatBody = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .min(1),
});

r.post("/chat", async (c) => {
  const parsed = chatBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: { code: "INVALID_BODY", message: "Formato de conversación inválido" } },
      400,
    );
  }

  const lastUser = [...parsed.data.messages].reverse().find((m) => m.role === "user");
  const context = lastUser ? await retrieve(lastUser.content).catch(() => []) : [];

  // El RAG ya funciona: aquí van los trozos que el modelo usaría de contexto.
  // Falta sólo quien los redacte. Se devuelve 503 (servicio no disponible) para
  // que el frontend enseñe el stub y no un consejo inventado.
  return c.json(
    {
      error: {
        code: "MODEL_UNAVAILABLE",
        message:
          "Valentín todavía no sabe hablar: falta su modelo. La búsqueda en los archivos ya funciona.",
      },
      // Visible para depurar y para enchufar el modelo cuando llegue.
      context: context.map((ch) => ({ fileId: ch.fileId, content: ch.content })),
    },
    503,
  );
});

export default r;
