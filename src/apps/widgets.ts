/**
 * Widgets de la pantalla de inicio.
 *
 * Un widget ocupa varias celdas de la rejilla y no abre ninguna app: muestra
 * contenido en sitio. Comparte lista de orden con los iconos, así que se puede
 * arrastrar igual que ellos.
 */
export interface WidgetManifest {
  kind: "widget";
  id: string;
  /** 2×2 = cuatro celdas de la rejilla. Por ahora es el único tamaño. */
  size: "2x2";
  /** De dónde saca el contenido. Hoy sólo fotos. */
  source: "photos";
  /** Etiqueta bajo el widget, como en iOS. Vacío para no mostrar ninguna. */
  label?: string;
  page: number;
  enabled: boolean;
}

export const widgets: WidgetManifest[] = [
  {
    kind: "widget",
    id: "widget-photos-1",
    size: "2x2",
    source: "photos",
    label: "Fotos",
    page: 1,
    enabled: true,
  },
  {
    kind: "widget",
    id: "widget-photos-2",
    size: "2x2",
    source: "photos",
    label: "Fotos",
    page: 2,
    enabled: true,
  },
];

/** Celdas de la rejilla que consume cada tamaño. */
export const WIDGET_CELLS: Record<WidgetManifest["size"], number> = {
  "2x2": 4,
};
