import { createContext, useContext } from "react";

export type PersonId = "irene" | "vicente";

/**
 * Quién está usando el móvil.
 *
 * Sale de la sesión real: se entra con el código del autenticador y el servidor
 * dice quién eres en `GET /api/auth/me`. Antes esto se guardaba en el
 * dispositivo, lo que significaba que el móvil no distinguía de verdad a Irene
 * de Vicente — cualquiera podía escribir la clave a mano y hacerse pasar por el
 * otro.
 *
 * El contexto lo rellena `App` con la sesión ya verificada. Fuera de la sesión
 * no hay escritorio que pintar, así que ninguna app llega a montarse sin él.
 */
export const CurrentUserContext = createContext<PersonId | null>(null);

export function useCurrentUser(): PersonId {
  const me = useContext(CurrentUserContext);

  // No debería pasar: `App` no monta ninguna app sin sesión. Si pasa, es un
  // fallo de montaje y conviene que se vea, no que la app enseñe datos de otra
  // persona por defecto.
  if (!me) {
    throw new Error("useCurrentUser() fuera de la sesión: falta CurrentUserContext");
  }

  return me;
}
