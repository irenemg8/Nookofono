import { daysBetween, fromKey } from "./dates";

export type Repeat = "none" | "daily" | "weekly" | "biweekly" | "monthly" | "yearly";

export const REPEAT_LABEL: Record<Repeat, string> = {
  none: "No se repite",
  daily: "Cada día",
  weekly: "Cada semana",
  biweekly: "Cada dos semanas",
  monthly: "Cada mes",
  yearly: "Cada año",
};

export interface Repeatable {
  /** Primera vez, `YYYY-MM-DD`. */
  date: string;
  repeat: Repeat;
  /** Última fecha en la que puede caer. Vacío = para siempre. */
  repeatUntil: string;
}

/**
 * Si un evento cae en un día concreto.
 *
 * Se comprueba día a día en lugar de generar la lista de repeticiones: para un
 * mes son 42 comprobaciones triviales, mientras que generar ocurrencias de algo
 * "cada día para siempre" no termina nunca.
 *
 * ⚠️ **Lo mensual se salta los meses cortos a propósito.** Algo del día 31 no
 * aparece en febrero ni en los meses de 30 días, en vez de correrse al 28 o al
 * 30. Mover la fecha sería inventarse un día que nadie eligió.
 */
export function occursOn(event: Repeatable, key: string): boolean {
  if (event.date === key) return true;
  if (event.repeat === "none") return false;

  // Nunca antes de la primera vez, ni después del final si lo tiene.
  if (key < event.date) return false;
  if (event.repeatUntil && key > event.repeatUntil) return false;

  const start = fromKey(event.date);
  const day = fromKey(key);

  switch (event.repeat) {
    case "daily":
      return true;
    case "weekly":
      return start.getDay() === day.getDay();
    case "biweekly":
      return start.getDay() === day.getDay() && daysBetween(event.date, key) % 14 === 0;
    case "monthly":
      return start.getDate() === day.getDate();
    case "yearly":
      return start.getDate() === day.getDate() && start.getMonth() === day.getMonth();
    default:
      return false;
  }
}
