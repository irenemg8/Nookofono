import { useCallback, useMemo, useState } from "react";
import { brain, type ChatMessage } from "./brain";

const STORE = "ipug.valentin.chats";
const ACTIVE = "ipug.valentin.active";

/** Lo que dice Valentín al empezar una conversación. */
const OPENING = "Hola, papá. Siéntate, que tenemos que hablar.";

export interface Conversation {
  id: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/** Se guardan las últimas 50 conversaciones, y 100 mensajes en cada una. */
const MAX_CHATS = 50;
const MAX_MESSAGES = 100;

export function useChats() {
  const [chats, setChats] = useState<Conversation[]>(read);
  const [activeId, setActiveId] = useState<string>(() => readActive(chats));
  const [thinking, setThinking] = useState(false);

  const active = useMemo(
    () => chats.find((c) => c.id === activeId) ?? chats[0],
    [chats, activeId],
  );

  const persist = useCallback((next: Conversation[]) => {
    const trimmed = next
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CHATS);
    write(trimmed);
    setChats(trimmed);
    return trimmed;
  }, []);

  const open = useCallback((id: string) => {
    setActiveId(id);
    writeActive(id);
  }, []);

  const create = useCallback(() => {
    const chat = blank();
    persist([chat, ...chats]);
    open(chat.id);
    return chat.id;
  }, [chats, persist, open]);

  const remove = useCallback(
    (id: string) => {
      const rest = chats.filter((c) => c.id !== id);
      // Nunca se queda sin conversación: si se borra la última, nace otra.
      const next = rest.length > 0 ? rest : [blank()];
      persist(next);
      if (id === activeId) open(next[0].id);
    },
    [chats, activeId, persist, open],
  );

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || thinking || !active) return;

      const mine: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: clean,
        at: Date.now(),
      };

      const history = [...active.messages, mine];
      let current = persist(
        chats.map((c) =>
          c.id === active.id ? { ...c, messages: history, updatedAt: Date.now() } : c,
        ),
      );
      setThinking(true);

      let answer: string;
      try {
        answer = await brain.reply(history);
      } catch {
        answer = "Ahora no puedo hablar. Prueba en un rato.";
      }

      const withReply = [
        ...history,
        {
          id: crypto.randomUUID(),
          role: "valentin" as const,
          text: answer,
          at: Date.now(),
        },
      ].slice(-MAX_MESSAGES);

      persist(
        current.map((c) =>
          c.id === active.id ? { ...c, messages: withReply, updatedAt: Date.now() } : c,
        ),
      );
      setThinking(false);
    },
    [active, chats, persist, thinking],
  );

  return { chats, active, activeId: active?.id, thinking, send, create, open, remove };
}

/** Título de la lista: la primera cosa que se dijo, recortada. */
export function titleOf(chat: Conversation): string {
  const first = chat.messages.find((m) => m.role === "user");
  if (!first) return "Conversación nueva";
  return first.text.length > 38 ? `${first.text.slice(0, 38)}…` : first.text;
}

function blank(): Conversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    messages: [{ id: crypto.randomUUID(), role: "valentin", text: OPENING, at: now }],
    createdAt: now,
    updatedAt: now,
  };
}

function read(): Conversation[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (Array.isArray(raw) && raw.length > 0) return raw;
  } catch {
    // Formato corrupto: se empieza de cero en vez de romper la pantalla.
  }
  return [blank()];
}

function readActive(chats: Conversation[]): string {
  const saved = localStorage.getItem(ACTIVE);
  return saved && chats.some((c) => c.id === saved) ? saved : chats[0].id;
}

function write(chats: Conversation[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(chats));
  } catch {
    // Cuota llena.
  }
}

function writeActive(id: string) {
  try {
    localStorage.setItem(ACTIVE, id);
  } catch {
    // Cuota llena.
  }
}
