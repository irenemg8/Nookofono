/**
 * Predicción del ciclo.
 *
 * A partir de las fechas de inicio de las últimas reglas estima la duración del
 * ciclo y, con ella, predice el próximo periodo y la ventana fértil.
 *
 * ⚠️ Es una estimación estadística, **no un método anticonceptivo**, y se avisa
 * en la app. Y respeta que el ciclo puede ser **irregular**: no marca un número
 * fijo de días. Lo previsto se muestra como una **banda** que va del ciclo más
 * corto al más largo que se hayan registrado — estrecha si eres regular, ancha
 * si no lo eres. Es la única forma honesta de dibujarlo.
 */

/** `YYYY-MM-DD` en hora local. */
export type DateKey = string;

export interface Cycle {
  /** Primer día de la regla. */
  start: DateKey;
  /** Días que duró el sangrado; `undefined` si sigue abierta o no se sabe. */
  bleedDays?: number;
}

export interface Prediction {
  /** Duración media del ciclo, en días. */
  avgLength: number;
  /** El ciclo más corto y el más largo observados (banda de incertidumbre). */
  minLength: number;
  maxLength: number;
  /** ¿El ciclo es regular? (la banda es estrecha). */
  regular: boolean;

  /** Mejor estimación del inicio del próximo periodo. */
  nextPeriod: DateKey;
  /** La ventana en la que puede caer el próximo periodo [pronto, tarde]. */
  windowStart: DateKey;
  windowEnd: DateKey;

  /** Día de ovulación más probable. */
  ovulation: DateKey;
  /** Ventana fértil, ya ensanchada según lo irregular que sea el ciclo. */
  fertileStart: DateKey;
  fertileEnd: DateKey;

  /** Cuántos ciclos completos se han usado (más = más fiable). */
  basedOn: number;
}

const DAY = 86_400_000;
const DEFAULT_LENGTH = 28;
const LUTEAL = 14; // días entre ovulación y siguiente regla
/** Hasta esta variación de días se considera "regular". */
const REGULAR_SPREAD = 3;

export function toKey(d: Date): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromKey(k: DateKey): Date {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(k: DateKey, n: number): DateKey {
  return toKey(new Date(fromKey(k).getTime() + n * DAY));
}

export function daysBetween(a: DateKey, b: DateKey): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / DAY);
}

export const todayKey = () => toKey(new Date());

export function predict(cycles: Cycle[]): Prediction | null {
  if (cycles.length === 0) return null;

  const sorted = [...cycles].sort((a, b) => a.start.localeCompare(b.start));
  const last = sorted[sorted.length - 1];

  // Duraciones reales entre inicios consecutivos, descartando valores absurdos.
  const lengths: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const len = daysBetween(sorted[i - 1].start, sorted[i].start);
    if (len >= 15 && len <= 60) lengths.push(len);
  }

  const avgLength = lengths.length
    ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
    : DEFAULT_LENGTH;

  // La banda: del ciclo más corto al más largo. Sin datos, un margen prudente
  // alrededor de la media para no fingir precisión que no hay.
  const minLength = lengths.length ? Math.min(...lengths) : avgLength - 4;
  const maxLength = lengths.length ? Math.max(...lengths) : avgLength + 4;
  const regular = maxLength - minLength <= REGULAR_SPREAD;

  const nextPeriod = addDays(last.start, avgLength);
  const windowStart = addDays(last.start, minLength);
  const windowEnd = addDays(last.start, maxLength);

  // La ovulación cae ~14 días antes de la regla; como la regla tiene una banda,
  // la ovulación también, y la ventana fértil se ensancha con ella.
  const ovulation = addDays(nextPeriod, -LUTEAL);
  const ovEarliest = addDays(windowStart, -LUTEAL);
  const ovLatest = addDays(windowEnd, -LUTEAL);
  const fertileStart = addDays(ovEarliest, -5); // los espermatozoides aguantan
  const fertileEnd = addDays(ovLatest, 1);

  return {
    avgLength,
    minLength,
    maxLength,
    regular,
    nextPeriod,
    windowStart,
    windowEnd,
    ovulation,
    fertileStart,
    fertileEnd,
    basedOn: lengths.length,
  };
}

export type Phase =
  | "period" // regla registrada (real)
  | "fertile"
  | "ovulation"
  | "predicted-period" // banda donde puede caer la próxima regla
  | "none";

export function phaseOf(day: DateKey, cycles: Cycle[], pred: Prediction | null): Phase {
  const today = todayKey();

  // ¿Cayó dentro de una regla ya registrada? Sólo se pintan días REALES:
  //  - cerrada: exactamente los días que duró.
  //  - abierta (sin cerrar): de su inicio hasta hoy, ni un día más. Nada de
  //    proyectar una duración fija hacia el futuro.
  for (const c of cycles) {
    if (typeof c.bleedDays === "number" && c.bleedDays > 0) {
      const end = addDays(c.start, c.bleedDays - 1);
      if (day >= c.start && day <= end) return "period";
    } else {
      // Abierta: sólo desde el inicio hasta hoy.
      if (day >= c.start && day <= today) return "period";
    }
  }

  if (!pred) return "none";

  if (day === pred.ovulation) return "ovulation";
  if (day >= pred.fertileStart && day <= pred.fertileEnd) return "fertile";
  // La banda de la próxima regla: del ciclo más corto al más largo.
  if (day >= pred.windowStart && day <= pred.windowEnd) return "predicted-period";

  return "none";
}
