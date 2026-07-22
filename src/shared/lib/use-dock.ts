import { useCallback, useState } from "react";
import { appsById, dockApps, type MiniAppManifest } from "../../apps/registry";

const STORAGE_KEY = "ipug.dock";

/** La barra inferior tiene cuatro huecos fijos. */
export const DOCK_SLOTS = 4;

/**
 * Qué apps viven en la barra fija inferior, y en qué orden.
 *
 * Se guarda aparte del orden de la rejilla porque son dos listas distintas: una
 * app del dock sigue apareciendo también arriba.
 *
 * En fase 2 pasa a `app_preferences` en D1 con la clave `dock`, junto al orden
 * de los iconos. Ver docs/MIGRACION-BACKEND.md §6.
 */
export function useDock() {
  const [ids, setIds] = useState<string[]>(readDock);

  const save = useCallback((next: string[]) => {
    const capped = next.slice(0, DOCK_SLOTS);
    writeDock(capped);
    setIds(capped);
  }, []);

  /** Reordena dentro del dock. */
  const move = useCallback(
    (fromId: string, toId: string) => {
      setIds((prev) => {
        const from = prev.indexOf(fromId);
        const to = prev.indexOf(toId);
        if (from === -1 || to === -1 || from === to) return prev;

        const next = [...prev];
        next.splice(to, 0, next.splice(from, 1)[0]);
        writeDock(next);
        return next;
      });
    },
    [],
  );

  /**
   * Mete una app en el dock. Si ya está, sólo la recoloca. Si el dock está
   * lleno, la que ocupaba ese hueco sale: los cuatro huecos son fijos, así que
   * meter una siempre implica sacar otra.
   */
  const insert = useCallback((appId: string, beforeId?: string) => {
    setIds((prev) => {
      const without = prev.filter((id) => id !== appId);
      const at = beforeId ? without.indexOf(beforeId) : without.length;
      const index = at === -1 ? without.length : at;

      const next = [...without];
      next.splice(index, 0, appId);

      // Si nos hemos pasado, cae la última que no sea la recién metida.
      while (next.length > DOCK_SLOTS) {
        const victim = next.findLastIndex((id) => id !== appId);
        next.splice(victim, 1);
      }

      writeDock(next);
      return next;
    });
  }, []);

  const remove = useCallback((appId: string) => {
    setIds((prev) => {
      if (!prev.includes(appId)) return prev;
      const next = prev.filter((id) => id !== appId);
      writeDock(next);
      return next;
    });
  }, []);

  const apps = ids
    .map((id) => appsById.get(id))
    .filter((app): app is MiniAppManifest => app !== undefined);

  return { ids, apps, move, insert, remove, save };
}

function defaultDock(): string[] {
  return dockApps.slice(0, DOCK_SLOTS).map((app) => app.id);
}

/** Descarta ids de apps que ya no existen y respeta el tope de huecos. */
function readDock(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!Array.isArray(raw)) return defaultDock();

    const kept = raw.filter((id): id is string => typeof id === "string" && appsById.has(id));
    return kept.length > 0 ? kept.slice(0, DOCK_SLOTS) : defaultDock();
  } catch {
    return defaultDock();
  }
}

function writeDock(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Modo privado o cuota llena: se pierde al recargar, no es grave.
  }
}
