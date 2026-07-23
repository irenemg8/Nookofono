/**
 * Predicción del ciclo.
 *
 * A partir de las fechas de inicio de las últimas reglas, estima la duración
 * media del ciclo y con ella predice el próximo periodo y la ventana fértil.
 *
 * ⚠️ Es una estimación estadística, **no un método anticonceptivo**. Se avisa
 * de ello en la propia app: la ventana fértil de calendario es orientativa.
 *
 * El modelo es el de calendario clásico:
 *  - Ovulación ≈ 14 días **antes** del siguiente periodo.
 *  - Fértil = los ~5 días antes de ovular más el día de ovular (los
 *    espermatozoides aguantan unos días).
 */

/** `YYYY-MM-DD` en hora local. */
export type DateKey = string;

export interface Cycle {
  /** Primer día de la regla. */
  start: DateKey;
  /** Días que duró el sangrado, si se sabe. */
  bleedDays?: number;
}

export interface Prediction {
  /** Duración media del ciclo, en días. */
  avgLength: number;
  /** Duración media del sangrado. */
  avgBleed: number;
  /** Inicio previsto del próximo periodo. */
  nextPeriod: DateKey;
  /** Ventana fértil prevista [inicio, fin]. */
  fertileStart: DateKey;
  fertileEnd: DateKey;
  /** Día de ovulación previsto. */
  ovulation: DateKey;
  /** Cuántos ciclos se han usado para estimar (más = más fiable). */
  basedOn: number;
}

const DAY = 86_400_000;
const DEFAULT_LENGTH = 28;
const DEFAULT_BLEED = 5;
const LUTEAL = 14; // días entre ovulación y siguiente regla

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

/**
 * Calcula la predicción a partir del histórico de ciclos.
 *
 * Se usan las duraciones reales entre inicios consecutivos; si sólo hay un
 * ciclo (o ninguno), se cae a la media típica de 28 días para no quedarse
 * mudo, avisando con `basedOn`.
 */
export function predict(cycles: Cycle[]): Prediction | null {
  if (cycles.length === 0) return null;

  const sorted = [...cycles].sort((a, b) => a.start.localeCompare(b.start));
  const last = sorted[sorted.length - 1];

  // Duraciones entre inicios consecutivos.
  const lengths: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const len = daysBetween(sorted[i - 1].start, sorted[i].start);
    // Se descartan valores absurdos (registros erróneos) para que no descuadren.
    if (len >= 15 && len <= 60) lengths.push(len);
  }

  const avgLength = lengths.length
    ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
    : DEFAULT_LENGTH;

  const bleeds = sorted.map((c) => c.bleedDays).filter((n): n is number => typeof n === "number");
  const avgBleed = bleeds.length
    ? Math.round(bleeds.reduce((a, b) => a + b, 0) / bleeds.length)
    : DEFAULT_BLEED;

  const nextPeriod = addDays(last.start, avgLength);
  const ovulation = addDays(nextPeriod, -LUTEAL);
  const fertileStart = addDays(ovulation, -5);
  const fertileEnd = addDays(ovulation, 1);

  return {
    avgLength,
    avgBleed,
    nextPeriod,
    ovulation,
    fertileStart,
    fertileEnd,
    basedOn: lengths.length,
  };
}

/** En qué fase cae un día concreto, según la predicción y el histórico. */
export type Phase = "period" | "fertile" | "ovulation" | "predicted-period" | "none";

export function phaseOf(day: DateKey, cycles: Cycle[], pred: Prediction | null): Phase {
  // ¿Cayó dentro de una regla ya registrada?
  for (const c of cycles) {
    const bleed = c.bleedDays ?? (pred?.avgBleed ?? DEFAULT_BLEED);
    const end = addDays(c.start, bleed - 1);
    if (day >= c.start && day <= end) return "period";
  }

  if (!pred) return "none";

  if (day === pred.ovulation) return "ovulation";
  if (day >= pred.fertileStart && day <= pred.fertileEnd) return "fertile";

  const predEnd = addDays(pred.nextPeriod, pred.avgBleed - 1);
  if (day >= pred.nextPeriod && day <= predEnd) return "predicted-period";

  return "none";
}
