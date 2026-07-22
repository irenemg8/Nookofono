import { useCallback, useMemo, useState } from "react";
import type { HomeItem } from "../../apps/home-items";

const STORAGE_KEY = "ipug.icon-order";

/**
 * Orden de los elementos de la pantalla de inicio (iconos y widgets),
 * persistido en el dispositivo.
 *
 * Recibe el catálogo completo porque los widgets se añaden y se quitan en
 * caliente. El orden guardado se reconcilia contra él: los ids desconocidos se
 * descartan y los elementos nuevos entran al final. Así, añadir un widget nunca
 * rompe la colocación que ya había.
 *
 * En fase 2 esto pasa a `app_preferences` en D1 con la clave `icon_order`. Ver
 * docs/MIGRACION-BACKEND.md §6.
 */
export function useAppOrder(catalog: HomeItem[]) {
  const [order, setOrder] = useState<string[]>(readOrder);

  const ids = useMemo(() => reconcile(order, catalog), [order, catalog]);

  const items = useMemo(() => {
    const byId = new Map(catalog.map((item) => [item.id, item]));
    return ids.map((id) => byId.get(id)!).filter(Boolean);
  }, [ids, catalog]);

  const move = useCallback(
    (fromId: string, toId: string) => {
      // Se parte de la lista reconciliada, no del estado en bruto: si no, mover
      // un widget recién añadido no haría nada, porque todavía no está guardado.
      setOrder((prev) => {
        const base = reconcile(prev, catalog);
        const from = base.indexOf(fromId);
        const to = base.indexOf(toId);
        if (from === -1 || to === -1 || from === to) return prev;

        const next = [...base];
        next.splice(to, 0, next.splice(from, 1)[0]);
        writeOrder(next);
        return next;
      });
    },
    [catalog],
  );

  return { items, order: ids, move };
}

function reconcile(order: string[], catalog: HomeItem[]): string[] {
  const known = new Set(catalog.map((item) => item.id));
  const kept = order.filter((id) => known.has(id));
  const seen = new Set(kept);
  const fresh = catalog.filter((item) => !seen.has(item.id)).map((item) => item.id);
  return [...kept, ...fresh];
}

function readOrder(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeOrder(order: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Modo privado o cuota llena: el orden se pierde al recargar, no es grave.
  }
}
