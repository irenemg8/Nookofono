import { enabledApps, type MiniAppManifest } from "./registry";
import { WIDGET_CELLS, widgets, type WidgetManifest } from "./widgets";

/** Lo que puede vivir en la rejilla: un icono de app o un widget. */
export type HomeItem = (MiniAppManifest & { kind: "app" }) | WidgetManifest;

/** Celdas por página: 4 columnas × 3 filas. */
export const PAGE_CELLS = 12;

export const homeItems: HomeItem[] = [
  ...enabledApps.map((app) => ({ ...app, kind: "app" as const })),
  ...widgets.filter((w) => w.enabled),
].sort((a, b) => a.page - b.page);

export function cellsOf(item: HomeItem): number {
  return item.kind === "widget" ? WIDGET_CELLS[item.size] : 1;
}

export function isWidget(item: HomeItem): item is WidgetManifest {
  return item.kind === "widget";
}

/**
 * Trocea la lista ordenada en páginas de `PAGE_CELLS` celdas.
 *
 * Un widget 2×2 gasta cuatro celdas, así que si no cabe entero al final de una
 * página, salta a la siguiente en vez de partirse. La rejilla usa
 * `grid-auto-flow: dense`, de modo que los iconos sueltos rellenan el hueco que
 * quede detrás.
 */
export function paginate(items: HomeItem[]): HomeItem[][] {
  const pages: HomeItem[][] = [];
  let page: HomeItem[] = [];
  let used = 0;

  for (const item of items) {
    const cells = cellsOf(item);
    if (used + cells > PAGE_CELLS) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(item);
    used += cells;
  }

  if (page.length > 0) pages.push(page);
  return pages.length > 0 ? pages : [[]];
}
