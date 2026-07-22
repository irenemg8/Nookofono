import { useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "../../../shared/lib/use-current-user";
import { useDebouncedSave } from "../../../shared/lib/use-debounced-save";

/**
 * El pasaporte de quien está usando el móvil.
 *
 * Cada uno ve el suyo: el servidor sólo deja editar el propio
 * (`PATCH /api/profile/:id` devuelve 403 si no coincide con la sesión), y aquí
 * ni siquiera se pide el del otro.
 *
 * Antes los datos estaban escritos en `people.ts` y el lema en `localStorage`,
 * así que el pasaporte era distinto en cada móvil y no había forma de corregir
 * una fruta sin desplegar.
 */
export interface Passport {
  islandName: string;
  nativeFruit: string;
  /** `MM-DD`: cumpleaños sin año. */
  birthday: string;
  registeredAt: string;
  /** El lema, lo único que se edita desde la app. */
  comment: string;
}

const EMPTY: Passport = {
  islandName: "",
  nativeFruit: "",
  birthday: "",
  registeredAt: "",
  comment: "",
};

export function usePassport() {
  const me = useCurrentUser();
  const [passport, setPassport] = useState<Passport>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    fetch(`/api/profile/${me}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((row: Record<string, unknown> | null) => {
        if (!alive) return;
        if (row) {
          setPassport({
            islandName: String(row.islandName ?? ""),
            nativeFruit: String(row.nativeFruit ?? ""),
            birthday: String(row.birthday ?? ""),
            registeredAt: String(row.registeredAt ?? ""),
            comment: String(row.comment ?? ""),
          });
        } else {
          setError("No se pudo cargar el pasaporte.");
        }
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [me]);

  // El lema se escribe letra a letra; se sube al parar, no en cada tecla.
  const save = useCallback(
    async (comment: string) => {
      try {
        const res = await fetch(`/api/profile/${me}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment }),
        });
        if (!res.ok) throw new Error();
        setError(null);
      } catch {
        setError("No se pudo guardar el lema.");
      }
    },
    [me],
  );

  const { push, flush } = useDebouncedSave<string>(save);

  const setComment = useCallback(
    (comment: string) => {
      setPassport((prev) => ({ ...prev, comment }));
      push(comment);
    },
    [push],
  );

  return { me, passport, setComment, flush, loading, error };
}
