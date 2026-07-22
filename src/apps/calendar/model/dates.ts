/**
 * Utilidades de fecha del calendario.
 *
 * Todo se maneja como `YYYY-MM-DD` construido a partir de la fecha **local**,
 * nunca con `toISOString()`: ese convierte a UTC, y en España eso significa que
 * a partir de las 22:00 (o 23:00 en verano) un evento de hoy se guardaría con
 * la fecha de mañana. Es el fallo clásico de los calendarios.
 */

export const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

export const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

/**
 * Las 42 casillas de la cuadrícula, empezando en lunes.
 *
 * Siempre seis semanas, aunque el mes quepa en cinco: si la rejilla cambiara de
 * alto al pasar de mes, el contenido de debajo daría saltos.
 */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // getDay() da 0 para domingo; aquí la semana empieza en lunes.
  const offset = (first.getDay() + 6) % 7;

  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));
}

/** "vie, 8 de junio" */
export function longDate(key: string): string {
  const d = fromKey(key);
  const day = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][d.getDay()];
  return `${day}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** Suma minutos a "HH:MM" y devuelve la hora de fin. */
export function endTime(start: string, minutes: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function humanDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
