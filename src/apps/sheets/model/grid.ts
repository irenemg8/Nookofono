/**
 * Modelo de la hoja de cálculo.
 *
 * Las celdas se guardan en un objeto plano indexado por su nombre ("A1", "B3"),
 * no en una matriz: una hoja mayormente vacía no debe ocupar miles de huecos, y
 * así añadir filas o columnas es sólo cambiar dos números.
 */
export interface Sheet {
  name: string;
  rows: number;
  cols: number;
  /** Contenido crudo de cada celda: texto, número o fórmula ("=A1+B2"). */
  cells: Record<string, string>;
}

export function emptySheet(name = "Hoja"): Sheet {
  return { name, rows: 20, cols: 8, cells: {} };
}

/** Número de columna (0) → letra ("A", "Z", "AA"). */
export function colName(index: number): string {
  let name = "";
  let n = index;
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

/** Letra ("A", "AA") → número de columna (0). */
export function colIndex(name: string): number {
  let n = 0;
  for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** "B3" → { r: 2, c: 1 }, en base 0. */
export function parseAddr(addr: string): { r: number; c: number } | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(addr.trim());
  if (!m) return null;
  return { r: Number(m[2]) - 1, c: colIndex(m[1]) };
}

export function makeAddr(r: number, c: number): string {
  return `${colName(c)}${r + 1}`;
}
