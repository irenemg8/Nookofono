import { useCallback, useEffect, useState } from "react";
import { useCurrentUser, type PersonId } from "../../../shared/lib/use-current-user";

/**
 * Canal privado de avisos.
 *
 * ntfy.sh entrega notificaciones push sin cuenta, sin clave y sin servidor
 * propio: se publica en un "tema" y cualquiera suscrito a él lo recibe. Es la
 * única forma de que un aviso llegue al móvil del otro mientras la app sigue
 * alojada en GitHub Pages, que no puede ejecutar código.
 *
 * ⚠️ **Un tema de ntfy es público para quien sepa su nombre.** No hay
 * contraseña: la privacidad depende de que nadie lo adivine. Por eso el nombre
 * es largo y sin sentido. No mandéis por aquí nada que no pudierais gritar en
 * la calle — para el "estoy agobiada, ven" da de sobra.
 *
 * En fase 2, con el Worker, esto pasa a Web Push con claves VAPID y el canal
 * deja de ser adivinable. Ver docs/MIGRACION-BACKEND.md.
 */
const TOPIC = "ipug-cacahuete-9f4c2a7be1d6";
const BASE = `https://ntfy.sh/${TOPIC}`;

/** ntfy sólo guarda los mensajes unas 12 horas, así que el archivo va aparte. */
const STORE = "ipug.sos.history";

export interface Alert {
  id: string;
  /** Epoch en ms. */
  at: number;
  from: PersonId | "desconocido";
  text: string;
}

const NAMES: Record<PersonId, string> = { irene: "Irene", vicente: "Vicente" };

export function messageFor(who: PersonId): string {
  return `Toca y vete cacahuete, ${NAMES[who]} está en apuros`;
}

export function useSos() {
  const me = useCurrentUser();
  const [history, setHistory] = useState<Alert[]>(read);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Segundos que faltan para poder volver a avisar. */
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const merge = useCallback((incoming: Alert[]) => {
    setHistory((prev) => {
      const byId = new Map(prev.map((a) => [a.id, a]));
      for (const a of incoming) byId.set(a.id, a);
      const next = [...byId.values()].sort((a, b) => b.at - a.at).slice(0, 200);
      write(next);
      return next;
    });
  }, []);

  /** Recupera lo que haya llegado mientras la app estaba cerrada. */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/json?poll=1&since=12h`);
      if (!res.ok) return;

      const text = await res.text();
      const alerts = text
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((m) => m.event === "message")
        .map(
          (m): Alert => ({
            id: m.id,
            at: m.time * 1000,
            from: m.tags?.includes("irene")
              ? "irene"
              : m.tags?.includes("vicente")
                ? "vicente"
                : "desconocido",
            text: m.message,
          }),
        );

      merge(alerts);
    } catch {
      // Sin conexión: se enseña el archivo local y ya está.
    }
  }, [merge]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const send = useCallback(async () => {
    setSending(true);
    setError(null);

    try {
      const res = await fetch(BASE, {
        method: "POST",
        headers: {
          Title: "Cacahuete",
          Priority: "urgent",
          Tags: `rotating_light,${me}`,
        },
        body: messageFor(me),
      });

      if (!res.ok) throw new Error();

      const json = await res.json();
      merge([{ id: json.id, at: Date.now(), from: me, text: messageFor(me) }]);
      // Un minuto de espera: en un apuro se pulsa varias veces sin querer, y
      // no hace falta bombardear el móvil del otro.
      setCooldown(60);
    } catch {
      setError("No se pudo enviar. Comprueba la conexión.");
    } finally {
      setSending(false);
    }
  }, [me, merge]);

  return { me, history, send, sending, error, cooldown, refresh, topic: TOPIC };
}

function read(): Alert[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function write(alerts: Alert[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(alerts));
  } catch {
    // Cuota llena.
  }
}
