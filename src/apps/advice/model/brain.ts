export interface ChatMessage {
  id: string;
  role: "valentin" | "user";
  text: string;
  at: number;
}

/**
 * De dónde salen las respuestas de Valentín.
 *
 * Es un puerto, igual que el `Repository` de la capa de datos: la pantalla no
 * sabe si detrás hay un modelo entrenado, una API o nada. Cuando el modelo de
 * Unsloth esté listo, se cambia el adaptador y la interfaz no se entera.
 *
 * Ver docs/PROYECTO.md §9.8 para el plan de entrenamiento y alojamiento.
 */
export interface ValentinBrain {
  reply(history: ChatMessage[]): Promise<string>;
}

/**
 * Mientras no hay modelo.
 *
 * No inventa consejos ni imita a Valentín: dice la verdad, que todavía no
 * existe. Un chatbot que finge tener personalidad cuando no la tiene es peor
 * que uno que avisa.
 */
export const stubBrain: ValentinBrain = {
  async reply() {
    // Un respiro antes de contestar, para que la conversación no dé un salto.
    await new Promise((r) => setTimeout(r, 600));
    return "Todavía no me han enseñado a hablar. Cuando Irene termine de entrenarme, te diré lo que pienso de verdad.";
  },
};

/**
 * El modelo de verdad, detrás de un endpoint.
 *
 * Se espera `POST { messages: [{role, content}] }` → `{ reply: string }`. En
 * fase 2 ese endpoint es `/api/valentin` en el Worker, que a su vez llama a
 * Workers AI con el adaptador LoRA.
 */
export function httpBrain(endpoint: string): ValentinBrain {
  return {
    async reply(history) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: history.map((m) => ({
            role: m.role === "valentin" ? "assistant" : "user",
            content: m.text,
          })),
        }),
      });

      if (!res.ok) throw new Error("Valentín no contesta");
      const json = await res.json();
      return json.reply;
    },
  };
}

const ENDPOINT = import.meta.env.VITE_VALENTIN_ENDPOINT ?? "";

/** El adaptador en uso. Una línea, y es el único punto de cambio. */
export const brain: ValentinBrain = ENDPOINT ? httpBrain(ENDPOINT) : stubBrain;

export const hasModel = ENDPOINT.length > 0;
