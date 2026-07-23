import { useCallback, useEffect, useState } from "react";
import type { PersonId } from "./use-current-user";

/**
 * La sesión con el servidor.
 *
 * La cookie es `HttpOnly`, así que el JavaScript no puede leerla: la única
 * manera de saber si hay sesión es preguntárselo al servidor con `/api/auth/me`.
 * Eso es a propósito — una cookie que el navegador no deja leer tampoco la puede
 * robar un script inyectado.
 *
 * Todas las peticiones van con `credentials: "include"`; sin eso el navegador no
 * manda la cookie y el servidor responde 401 aunque la sesión sea buena.
 */

export type Session = { userId: PersonId; displayName: string };

const NAMES: Record<PersonId, string> = { irene: "Irene", vicente: "Vicente" };

/** Mientras se pregunta al servidor no se sabe: ni dentro ni fuera. */
type State = { status: "checking" } | { status: "in"; session: Session } | { status: "out" };

/**
 * Bypass de desarrollo.
 *
 * Poniendo `VITE_AUTH_BYPASS=irene` (o `vicente`) en un `.env.local` se entra
 * sin pasar por el TOTP, para ver la interfaz en `localhost` sin tener el
 * backend levantado. Está atado a `import.meta.env.DEV`, así que en la web
 * compilada **no existe**: Vite lo elimina del bundle de producción.
 *
 * ⚠️ Salta el login, no la base de datos. Las apps que guardan en el servidor
 * (calendario, notas, tareas…) seguirán diciendo "no se pudo cargar" mientras no
 * haya un backend contestando; el bypass sirve para revisar maquetación y flujo,
 * no para tener datos.
 */
const BYPASS = import.meta.env.DEV
  ? (import.meta.env.VITE_AUTH_BYPASS as PersonId | undefined)
  : undefined;

export function useSession() {
  const [state, setState] = useState<State>(() =>
    BYPASS ? { status: "in", session: { userId: BYPASS, displayName: NAMES[BYPASS] } } : { status: "checking" },
  );

  useEffect(() => {
    if (BYPASS) return; // en bypass no se pregunta al servidor
    let alive = true;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((data: Session | null) => {
        if (!alive) return;
        setState(data ? { status: "in", session: data } : { status: "out" });
      });
    return () => {
      alive = false;
    };
  }, []);

  const enter = useCallback((session: Session) => {
    setState({ status: "in", session });
  }, []);

  const leave = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    setState({ status: "out" });
  }, []);

  return { state, enter, leave };
}

/** Lo que puede salir mal al enviar el código, ya en español. */
export type VerifyResult = { ok: true; session: Session } | { ok: false; message: string };

export async function verifyCode(userId: PersonId, code: string): Promise<VerifyResult> {
  let res: Response;
  try {
    res = await fetch("/api/auth/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, code }),
    });
  } catch {
    return { ok: false, message: "No hay conexión con el servidor" };
  }

  if (res.ok) return { ok: true, session: (await res.json()) as Session };

  // El servidor manda el motivo en español; se usa tal cual y se guarda un
  // texto propio sólo por si la respuesta no trae cuerpo.
  const body = await res.json().catch(() => null);
  const message =
    body?.error?.message ??
    (res.status === 429 ? "Demasiados intentos. Prueba más tarde." : "El código no es válido");

  return { ok: false, message };
}
