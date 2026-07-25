import type { Entity } from "../../../shared/lib/use-remote-collection";

/**
 * Una receta del recetario.
 *
 * La colección `/api/recipes` es la **dueña** de las recetas. El Menú semanal
 * sólo guarda referencias a ellas (id + título), así que quitar una comida del
 * menú no borra la receta, y al revés.
 */
/**
 * Un ingrediente de una receta.
 *
 * `text` es lo que se lee y escribe ("200 g de lentejas"). `productId` es el id
 * del producto de Mercadona al que apunta, si se ha enlazado: eso permite
 * añadirlo al carrito de la app Compra desde el Menú. Es opcional —un
 * ingrediente puede ser solo texto— y `null` significa "sin enlazar".
 */
export interface Ingredient {
  text: string;
  productId?: string | null;
}

/**
 * Normaliza un ingrediente venga como venga: las recetas viejas lo guardaban
 * como string suelto, las nuevas como objeto. Así el resto del código trabaja
 * siempre con la forma de objeto sin preocuparse de la transición.
 */
export function toIngredient(raw: string | Ingredient): Ingredient {
  return typeof raw === "string" ? { text: raw, productId: null } : raw;
}

export interface Recipe extends Entity {
  title: string;
  /** Ingredientes; cada uno con su texto y, opcional, el producto de Mercadona. */
  ingredients: Ingredient[];
  /** Tiempo total en minutos. 0 = sin indicar. */
  timeMin: number;
  /** Etiquetas: utensilio (horno, sartén…) y lo que sea (rápido, vegetariano…). */
  tags: string[];
  /** Preparación, en texto libre. */
  steps: string;
  position: number;
}

/** Etiquetas de utensilio que se ofrecen al crear/editar (además de las libres). */
export const EQUIPMENT_TAGS = [
  "horno",
  "sartén",
  "olla",
  "microondas",
  "air fryer",
  "plancha",
  "sin cocinar",
];

/** Sugerencias de etiquetas generales. */
export const OTHER_TAGS = ["rápido", "vegetariano", "vegano", "sin gluten", "postre", "batch cooking"];

/** Cortes del filtro por tiempo, en minutos (0 = cualquiera). */
export const TIME_STEPS = [15, 30, 45, 60];

export function timeLabel(min: number): string {
  if (min <= 0) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
