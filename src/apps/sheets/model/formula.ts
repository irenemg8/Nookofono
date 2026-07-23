import { colIndex, makeAddr, parseAddr } from "./grid";

/**
 * Motor de fórmulas.
 *
 * Una fórmula es una celda que empieza por `=`. Soporta números, referencias
 * (`A1`), rangos (`A1:B3`), las funciones de siempre (SUMA, PROMEDIO, MÍN, MÁX,
 * CONTAR, PRODUCTO, y sus nombres en inglés) y aritmética con precedencia.
 *
 * Es un analizador descendente recursivo, primo del de la calculadora, con dos
 * añadidos: las referencias, que se resuelven pidiéndoselas a las otras celdas,
 * y un guardia contra referencias circulares (`A1` que se apoya en `A1`), que si
 * no colgaría el navegador.
 */

export interface CellValue {
  /** Lo que se enseña en la celda. */
  text: string;
  /** El número, si la celda evalúa a uno. Para poder sumar celdas de fórmula. */
  num: number | null;
  error: boolean;
}

const FUNCS: Record<string, (xs: number[]) => number> = {
  SUM: (xs) => xs.reduce((a, b) => a + b, 0),
  SUMA: (xs) => xs.reduce((a, b) => a + b, 0),
  AVERAGE: (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0),
  PROMEDIO: (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0),
  MIN: (xs) => (xs.length ? Math.min(...xs) : 0),
  "MÍN": (xs) => (xs.length ? Math.min(...xs) : 0),
  MAX: (xs) => (xs.length ? Math.max(...xs) : 0),
  "MÁX": (xs) => (xs.length ? Math.max(...xs) : 0),
  COUNT: (xs) => xs.length,
  CONTAR: (xs) => xs.length,
  PRODUCT: (xs) => xs.reduce((a, b) => a * b, 1),
  PRODUCTO: (xs) => xs.reduce((a, b) => a * b, 1),
};

/**
 * Calcula el valor mostrado de todas las celdas de una vez.
 *
 * Se resuelve con memoria: cada celda se evalúa como mucho una vez, y las que se
 * están evaluando quedan marcadas para cortar los ciclos.
 */
export function computeGrid(cells: Record<string, string>): Record<string, CellValue> {
  const cache: Record<string, CellValue> = {};
  const inProgress = new Set<string>();

  function evalCell(addr: string): CellValue {
    if (cache[addr]) return cache[addr];

    const raw = cells[addr] ?? "";
    if (!raw) return { text: "", num: 0, error: false };

    // No es fórmula: número si se puede leer como tal, si no texto. Se cachea
    // igual, o la rejilla lo pintaría en blanco (sólo guardaba las fórmulas).
    if (!raw.startsWith("=")) {
      const n = toNumber(raw);
      const value: CellValue = { text: raw, num: n, error: false };
      cache[addr] = value;
      return value;
    }

    if (inProgress.has(addr)) return fail("#CICLO");
    inProgress.add(addr);

    let result: CellValue;
    try {
      const value = new Parser(raw.slice(1), evalCell).parse();
      result = { text: formatNum(value), num: value, error: false };
    } catch {
      result = fail("#ERROR");
    }

    inProgress.delete(addr);
    cache[addr] = result;
    return result;
  }

  for (const addr of Object.keys(cells)) evalCell(addr);
  return cache;
}

function fail(text: string): CellValue {
  return { text, num: null, error: true };
}

function toNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (cleaned === "" || Number.isNaN(Number(cleaned))) return null;
  return Number(cleaned);
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "#ERROR";
  return String(Math.round(n * 1e10) / 1e10).replace(".", ",");
}

/* ------------------------------------------------------------------ parser */

type Token = { type: "num" | "op" | "lparen" | "rparen" | "comma" | "ref" | "range" | "func"; value: string };

class Parser {
  private tokens: Token[];
  private pos = 0;
  private get: (addr: string) => CellValue;

  constructor(input: string, get: (addr: string) => CellValue) {
    this.tokens = tokenize(input);
    this.get = get;
  }

  parse(): number {
    const v = this.expr();
    if (this.pos < this.tokens.length) throw new Error("sobra");
    return v;
  }

  private peek() {
    return this.tokens[this.pos];
  }
  private next() {
    const t = this.tokens[this.pos++];
    if (!t) throw new Error("corta");
    return t;
  }

  private expr(): number {
    let v = this.term();
    while (this.peek()?.type === "op" && "+-".includes(this.peek()!.value)) {
      const op = this.next().value;
      const r = this.term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  private term(): number {
    let v = this.factor();
    while (this.peek()?.type === "op" && "*/".includes(this.peek()!.value)) {
      const op = this.next().value;
      const r = this.factor();
      if (op === "/" && r === 0) throw new Error("div0");
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }

  private factor(): number {
    const base = this.unary();
    if (this.peek()?.type === "op" && this.peek()!.value === "^") {
      this.next();
      return Math.pow(base, this.factor());
    }
    return base;
  }

  private unary(): number {
    const t = this.peek();
    if (t?.type === "op" && (t.value === "-" || t.value === "+")) {
      this.next();
      const v = this.unary();
      return t.value === "-" ? -v : v;
    }
    return this.primary();
  }

  private primary(): number {
    const t = this.next();

    if (t.type === "num") return Number(t.value.replace(",", "."));

    if (t.type === "ref") {
      const v = this.get(t.value.toUpperCase());
      if (v.error) throw new Error("ref");
      return v.num ?? 0;
    }

    if (t.type === "lparen") {
      const v = this.expr();
      if (this.next().type !== "rparen") throw new Error("paren");
      return v;
    }

    if (t.type === "func") {
      const fn = FUNCS[t.value.toUpperCase()];
      if (!fn) throw new Error("func");
      if (this.next().type !== "lparen") throw new Error("fparen");
      const args = this.collectArgs();
      if (this.next().type !== "rparen") throw new Error("paren");
      return fn(args);
    }

    throw new Error("primary");
  }

  /** Junta los números de los argumentos de una función, expandiendo rangos. */
  private collectArgs(): number[] {
    const out: number[] = [];
    if (this.peek()?.type === "rparen") return out;

    for (;;) {
      const t = this.peek();
      if (t?.type === "range") {
        this.next();
        out.push(...this.expandRange(t.value));
      } else {
        out.push(this.expr());
      }
      if (this.peek()?.type === "comma") {
        this.next();
        continue;
      }
      break;
    }
    return out;
  }

  private expandRange(range: string): number[] {
    const [a, b] = range.split(":");
    const from = parseAddr(a);
    const to = parseAddr(b);
    if (!from || !to) throw new Error("range");

    const nums: number[] = [];
    for (let r = Math.min(from.r, to.r); r <= Math.max(from.r, to.r); r++) {
      for (let c = Math.min(from.c, to.c); c <= Math.max(from.c, to.c); c++) {
        const v = this.get(makeAddr(r, c));
        if (v.error) throw new Error("range-err");
        if (v.num !== null && v.text !== "") nums.push(v.num);
      }
    }
    return nums;
  }
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = input;

  while (i < s.length) {
    const ch = s[i];
    if (ch === " ") {
      i++;
      continue;
    }
    if (/[0-9.,]/.test(ch)) {
      let n = "";
      while (i < s.length && /[0-9.,]/.test(s[i])) n += s[i++];
      tokens.push({ type: "num", value: n });
      continue;
    }
    if (/[A-Za-zÁÉÍÓÚÑ]/.test(ch)) {
      let word = "";
      while (i < s.length && /[A-Za-zÁÉÍÓÚÑ0-9]/.test(s[i])) word += s[i++];
      // ¿Es un rango (A1:B3), una referencia (A1) o una función (SUMA)?
      if (s[i] === ":" && /^[A-Za-z]+\d+$/.test(word)) {
        i++;
        let end = "";
        while (i < s.length && /[A-Za-z0-9]/.test(s[i])) end += s[i++];
        tokens.push({ type: "range", value: `${word}:${end}` });
      } else if (/^[A-Za-z]+\d+$/.test(word)) {
        tokens.push({ type: "ref", value: word });
      } else {
        tokens.push({ type: "func", value: word });
      }
      continue;
    }
    if ("+-*/^".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lparen", value: ch });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", value: ch });
      i++;
      continue;
    }
    if (ch === ";" || ch === ",") {
      tokens.push({ type: "comma", value: ch });
      i++;
      continue;
    }
    throw new Error(`raro: ${ch}`);
  }
  return tokens;
}

// Se re-exporta para que el índice no tenga que importar de grid además.
export { colIndex };
