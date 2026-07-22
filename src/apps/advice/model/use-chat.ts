import { useCallback, useState } from "react";
import { brain, type ChatMessage } from "./brain";

const STORE = "ipug.valentin.chat";

/** Lo que dice Valentín al abrir el chat por primera vez. */
const OPENING: ChatMessage = {
  id: "opening",
  role: "valentin",
  text: "Hola, papá. Siéntate, que tenemos que hablar.",
  at: 0,
};

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(read);
  const [thinking, setThinking] = useState(false);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || thinking) return;

      const mine: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: clean,
        at: Date.now(),
      };

      // El historial que ve el modelo incluye ya el mensaje nuevo.
      const history = [...messages, mine];
      setMessages(history);
      write(history);
      setThinking(true);

      try {
        const text = await brain.reply(history);
        const answer: ChatMessage = {
          id: crypto.randomUUID(),
          role: "valentin",
          text,
          at: Date.now(),
        };
        const next = [...history, answer];
        setMessages(next);
        write(next);
      } catch {
        const failure: ChatMessage = {
          id: crypto.randomUUID(),
          role: "valentin",
          text: "Ahora no puedo hablar. Prueba en un rato.",
          at: Date.now(),
        };
        const next = [...history, failure];
        setMessages(next);
        write(next);
      } finally {
        setThinking(false);
      }
    },
    [messages, thinking],
  );

  const clear = useCallback(() => {
    write([OPENING]);
    setMessages([OPENING]);
  }, []);

  return { messages, send, thinking, clear };
}

function read(): ChatMessage[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null");
    return Array.isArray(raw) && raw.length > 0 ? raw : [OPENING];
  } catch {
    return [OPENING];
  }
}

function write(messages: ChatMessage[]) {
  try {
    // Se guardan los últimos 100: una conversación larga no debe llenar la
    // cuota del navegador, y el modelo tampoco necesita más contexto.
    localStorage.setItem(STORE, JSON.stringify(messages.slice(-100)));
  } catch {
    // Cuota llena.
  }
}
