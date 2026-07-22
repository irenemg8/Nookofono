import { useCallback, useState } from "react";
import { appsById } from "../../apps/registry";
import {
  DEFAULT_WIDGETS,
  WIDGET_SPAN,
  type WidgetInstance,
  type WidgetSize,
} from "../../apps/widgets";

const STORAGE_KEY = "ipug.widgets";

/**
 * Widgets colocados en la pantalla de inicio.
 *
 * En fase 2 pasa a `app_preferences` en D1 con la clave `widgets`, junto al
 * orden de los iconos y el dock. Ver docs/MIGRACION-BACKEND.md §6.
 */
export function useWidgets() {
  const [widgets, setWidgets] = useState<WidgetInstance[]>(read);

  const add = useCallback((appId: string, size: WidgetSize) => {
    setWidgets((prev) => {
      const next = [
        ...prev,
        {
          kind: "widget" as const,
          id: `w-${appId}-${size}-${crypto.randomUUID().slice(0, 8)}`,
          appId,
          size,
          // Entra al final; después se arrastra a donde se quiera.
          page: Math.max(1, ...prev.map((w) => w.page)),
        },
      ];
      write(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setWidgets((prev) => {
      const next = prev.filter((w) => w.id !== id);
      write(next);
      return next;
    });
  }, []);

  return { widgets, add, remove };
}

/** Descarta widgets cuya app ya no existe o cuyo tamaño se ha retirado. */
function read(): WidgetInstance[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!Array.isArray(raw)) return DEFAULT_WIDGETS;

    return raw.filter(
      (w): w is WidgetInstance =>
        w != null &&
        typeof w.id === "string" &&
        typeof w.appId === "string" &&
        appsById.has(w.appId) &&
        typeof w.size === "string" &&
        w.size in WIDGET_SPAN,
    );
  } catch {
    return DEFAULT_WIDGETS;
  }
}

function write(widgets: WidgetInstance[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  } catch {
    // Modo privado o cuota llena: se pierde al recargar, no es grave.
  }
}
