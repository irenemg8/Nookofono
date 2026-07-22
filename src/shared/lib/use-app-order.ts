import { useCallback, useState } from "react";
import { enabledApps, type MiniAppManifest } from "../../apps/registry";

const STORAGE_KEY = "ipug.icon-order";

/**
 * Orden de los iconos en la pantalla de inicio, persistido en el dispositivo.
 *
 * En fase 2 esto pasa a `app_preferences` en D1 con la clave `icon_order`, y
 * entonces el orden se comparte entre los dos móviles. Ver
 * docs/MIGRACION-BACKEND.md §6.
 */
export function useAppOrder() {
  const [order, setOrder] = useState<string[]>(readOrder);

  const move = useCallback((fromId: string, toId: string) => {
    setOrder((prev) => {
      const from = prev.indexOf(fromId);
      const to = prev.indexOf(toId);
      if (from === -1 || to === -1 || from === to) return prev;

      const next = [...prev];
      next.splice(to, 0, next.splice(from, 1)[0]);
      writeOrder(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const next = defaultOrder();
    writeOrder(next);
    setOrder(next);
  }, []);

  const apps = order
    .map((id) => enabledApps.find((app) => app.id === id))
    .filter((app): app is MiniAppManifest => app !== undefined);

  return { apps, order, move, reset };
}

function defaultOrder(): string[] {
  return enabledApps.map((app) => app.id);
}

/**
 * Reconcilia lo guardado con el registry: descarta ids de apps que ya no
 * existen y añade al final las que se hayan dado de alta desde la última vez.
 * Así, añadir una app nueva nunca rompe el orden guardado.
 */
function readOrder(): string[] {
  const fallback = defaultOrder();

  let saved: unknown;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return fallback;
  }

  if (!Array.isArray(saved)) return fallback;

  const known = new Set(fallback);
  const kept = saved.filter((id): id is string => typeof id === "string" && known.has(id));
  const missing = fallback.filter((id) => !kept.includes(id));

  return [...kept, ...missing];
}

function writeOrder(order: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Modo privado o cuota llena: el orden se pierde al recargar, no es grave.
  }
}
