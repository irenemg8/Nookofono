/**
 * Widgets de la pantalla de inicio.
 *
 * Un widget ocupa varias celdas de la rejilla y muestra contenido en sitio en
 * lugar de abrir una app. Comparte la lista de orden con los iconos, así que se
 * arrastra igual que ellos.
 *
 * A diferencia de las apps, los widgets **no están fijados en el código**: se
 * añaden y se quitan desde el botón "+" del modo edición, y la lista vive en el
 * dispositivo. Ver `use-widgets.ts`.
 */
export type WidgetSize = "2x2" | "4x2" | "4x4";

export interface WidgetInstance {
  kind: "widget";
  /** Identificador único de esta instancia; puede haber varios de la misma app. */
  id: string;
  /** Qué app le da contenido. */
  appId: string;
  size: WidgetSize;
  page: number;
}

/** Columnas y filas que ocupa cada tamaño en la rejilla de 4 columnas. */
export const WIDGET_SPAN: Record<WidgetSize, { cols: number; rows: number }> = {
  "2x2": { cols: 2, rows: 2 },
  "4x2": { cols: 4, rows: 2 },
  "4x4": { cols: 4, rows: 4 },
};

export const WIDGET_CELLS: Record<WidgetSize, number> = {
  "2x2": 4,
  "4x2": 8,
  "4x4": 16,
};

export const WIDGET_SIZE_LABEL: Record<WidgetSize, string> = {
  "2x2": "Pequeño",
  "4x2": "Mediano",
  "4x4": "Grande",
};

/**
 * Qué apps ofrecen widget y en qué tamaños.
 *
 * `ready: false` significa que el hueco se dibuja pero todavía no hay contenido
 * real detrás. Se muestran igualmente en el menú, atenuados, para que se vea
 * hacia dónde va la cosa.
 */
export interface WidgetSource {
  appId: string;
  sizes: WidgetSize[];
  ready: boolean;
}

export const WIDGET_CATALOG: WidgetSource[] = [
  { appId: "photos", sizes: ["2x2", "4x2", "4x4"], ready: true },
  { appId: "calendar", sizes: ["2x2", "4x2"], ready: false },
  { appId: "weather", sizes: ["2x2", "4x2"], ready: false },
  { appId: "nilo", sizes: ["2x2"], ready: false },
  { appId: "money", sizes: ["2x2", "4x2"], ready: false },
  { appId: "tasks", sizes: ["2x2", "4x2"], ready: false },
  { appId: "shopping", sizes: ["2x2"], ready: false },
  { appId: "music", sizes: ["2x2", "4x2"], ready: false },
];

/** Los dos widgets de fotos con los que arranca la pantalla la primera vez. */
export const DEFAULT_WIDGETS: WidgetInstance[] = [
  { kind: "widget", id: "widget-photos-1", appId: "photos", size: "2x2", page: 1 },
  { kind: "widget", id: "widget-photos-2", appId: "photos", size: "2x2", page: 2 },
];
