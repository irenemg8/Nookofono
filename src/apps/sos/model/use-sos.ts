import { useCallback, useEffect, useState } from "react";
import { useCurrentUser, type PersonId } from "../../../shared/lib/use-current-user";
import { msFrom } from "../../../shared/lib/use-remote-collection";

/**
 * Canal privado de avisos.
 *
 * Dos piezas con trabajos distintos:
 *
 * - **ntfy.sh** hace sonar el móvil del otro. Entrega notificaciones push sin
 *   cuenta ni servidor propio, y sigue siendo la única forma de que un aviso
 *   llegue con la app cerrada.
 * - **La base de datos** guarda el archivo, que así es el mismo para los dos.
 *   Antes vivía en `localStorage`, y eso significaba que cada uno veía sólo los
 *   avisos que había recibido con la app abierta.
 *
 * ⚠️ **Un tema de ntfy es público para quien sepa su nombre.** No hay
 * contraseña: la privacidad depende de que nadie lo adivine. Por eso el nombre
 * es largo y sin sentido. No mandéis por aquí nada que no pudierais gritar en
 * la calle — para el "estoy agobiada, ven" da de sobra.
 *
 * Para que llegue como notificación de verdad hace falta Web Push con VAPID,
 * que está fuera de los seis bloques del plan (ver `docs/PLAN.md` §2).
 */
const TOPIC = "ipug-cacahuete-9f4c2a7be1d6";
const BASE = `https://ntfy.sh/${TOPIC}`;

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
  const [history, setHistory] = useState<Alert[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Segundos que faltan para poder volver a avisar. */
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  /** El archivo compartido, que es el que manda. */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts", { credentials: "include" });
      if (!res.ok) return;

      const rows = (await res.json()) as Record<string, unknown>[];
      setHistory(
        rows.map((row) => ({
          id: String(row.id),
          at: msFrom(row.at),
          from: (row.from as Alert["from"]) ?? "desconocido",
          text: String(row.text ?? ""),
        })),
      );
    } catch {
      // Sin conexión se queda lo que ya estuviera en pantalla.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const send = useCallback(async () => {
    setSending(true);
    setError(null);

    const text = messageFor(me);

    try {
      // Primero lo que hace ruido: si falla el archivo, el aviso ya ha salido.
      const res = await fetch(BASE, {
        method: "POST",
        headers: {
          Title: "Cacahuete",
          Priority: "urgent",
          Tags: `rotating_light,${me}`,
        },
        body: text,
      });

      if (!res.ok) throw new Error();

      // Un minuto de espera: en un apuro se pulsa varias veces sin querer, y
      // no hace falta bombardear el móvil del otro.
      setCooldown(60);
    } catch {
      setError("No se pudo enviar. Comprueba la conexión.");
      setSending(false);
      return;
    }

    // El aviso ya ha sonado. Que no se pueda archivar no lo invalida, así que
    // se avisa de ello sin dar por fallado el envío.
    try {
      const saved = await fetch("/api/alerts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, at: new Date().toISOString() }),
      });
      if (!saved.ok) throw new Error();

      const row = (await saved.json()) as Record<string, unknown>;
      setHistory((prev) => [
        {
          id: String(row.id),
          at: msFrom(row.at),
          from: (row.from as Alert["from"]) ?? me,
          text,
        },
        ...prev,
      ]);
    } catch {
      setError("El aviso ha salido, pero no se ha podido guardar en el historial.");
    } finally {
      setSending(false);
    }
  }, [me]);

  return { me, history, send, sending, error, cooldown, refresh, topic: TOPIC };
}
