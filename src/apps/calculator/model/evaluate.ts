/**
 * Evaluador de expresiones matemáticas.
 *
 * Se escribe a mano en vez de usar `eval` por dos motivos: `eval` ejecutaría
 * cualquier cosa que se teclee (agujero de seguridad) y no entiende ni `π` ni
 * `sin` ni el modo grados. Es un analizador descendente recursivo, que respeta
 * la precedencia y la asociatividad sin trucos.
 *
 * Gramática:
 *   expr    := term (('+' | '-') term)*
 *   term    := factor (('*' | '/') factor)*
 *   factor  := unary ('^' factor)?        // la potencia asocia a la derecha
 *   unary   := ('-' | '+') unary | postfix
 *   postfix := primary ('!' | '%')*
 *   primary := número | constante | '(' expr ')' | función '(' expr ')'
 */

/**
 * El modo del selector superior.
 *
 * `deg`/`rad` son unidades de ángulo para la trigonometría. `hex` no es un
 * ángulo, sino cómo se enseña el resultado: en base 16. En hex la trigonometría
 * usa radianes, que es lo natural cuando no hay unidad de grados elegida.
 */
export type AngleUnit = "deg" | "rad" | "hex";

interface Token {
  type: "num" | "op" | "lparen" | "rparen" | "func" | "const";
  value: string;
}

const FUNCS = new Set([
  "sin", "cos", "tan", "asin", "acos", "atan", "ln", "log", "sqrt", "abs",
]);

/** Evalúa la expresión. Lanza `Error` si está mal escrita o da algo no finito. */
export function evaluate(input: string, angle: AngleUnit = "deg"): number {
  const tokens = tokenize(input);
  const parser = new Parser(tokens, angle);
  const value = parser.parseExpr();
  parser.expectEnd();
  if (!Number.isFinite(value)) throw new Error("Resultado no válido");
  return value;
}

/* --------------------------------------------------------------- tokenizer */

function tokenize(input: string): Token[] {
  // Se normalizan los símbolos bonitos de los botones a los de siempre.
  const s = input
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/√/g, "sqrt")
    .replace(/π/g, "π")
    .replace(/,/g, ".");

  const tokens: Token[] = [];
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    if (ch === " ") {
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
      tokens.push({ type: "num", value: num });
      continue;
    }

    if (/[a-zA-Z]/.test(ch)) {
      let name = "";
      while (i < s.length && /[a-zA-Z]/.test(s[i])) name += s[i++];
      if (name === "e") tokens.push({ type: "const", value: "e" });
      else if (FUNCS.has(name)) tokens.push({ type: "func", value: name });
      else throw new Error(`No conozco «${name}»`);
      continue;
    }

    if (ch === "π") {
      tokens.push({ type: "const", value: "π" });
      i++;
      continue;
    }

    if ("+-*/^!%".includes(ch)) {
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

    throw new Error(`Símbolo raro: «${ch}»`);
  }

  return tokens;
}

/* ------------------------------------------------------------------ parser */

class Parser {
  private pos = 0;
  private tokens: Token[];
  private angle: AngleUnit;

  constructor(tokens: Token[], angle: AngleUnit) {
    this.tokens = tokens;
    this.angle = angle;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token {
    const t = this.tokens[this.pos++];
    if (!t) throw new Error("La expresión se corta antes de tiempo");
    return t;
  }

  expectEnd() {
    if (this.pos < this.tokens.length) throw new Error("Sobra algo al final");
  }

  parseExpr(): number {
    let value = this.parseTerm();
    while (this.peek()?.type === "op" && "+-".includes(this.peek()!.value)) {
      const op = this.next().value;
      const rhs = this.parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    while (this.peek()?.type === "op" && "*/".includes(this.peek()!.value)) {
      const op = this.next().value;
      const rhs = this.parseFactor();
      if (op === "/" && rhs === 0) throw new Error("No se puede dividir entre cero");
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  private parseFactor(): number {
    const base = this.parseUnary();
    if (this.peek()?.type === "op" && this.peek()!.value === "^") {
      this.next();
      // Recursivo a la derecha: 2^3^2 = 2^(3^2) = 512.
      return Math.pow(base, this.parseFactor());
    }
    return base;
  }

  private parseUnary(): number {
    const t = this.peek();
    if (t?.type === "op" && (t.value === "-" || t.value === "+")) {
      this.next();
      const v = this.parseUnary();
      return t.value === "-" ? -v : v;
    }
    return this.parsePostfix();
  }

  private parsePostfix(): number {
    let value = this.parsePrimary();
    while (this.peek()?.type === "op" && "!%".includes(this.peek()!.value)) {
      const op = this.next().value;
      value = op === "!" ? factorial(value) : value / 100;
    }
    return value;
  }

  private parsePrimary(): number {
    const t = this.next();

    if (t.type === "num") {
      const n = Number(t.value);
      if (Number.isNaN(n)) throw new Error(`Número mal escrito: «${t.value}»`);
      return n;
    }

    if (t.type === "const") return t.value === "π" ? Math.PI : Math.E;

    if (t.type === "lparen") {
      const value = this.parseExpr();
      if (this.next().type !== "rparen") throw new Error("Falta cerrar un paréntesis");
      return value;
    }

    if (t.type === "func") {
      if (this.next().type !== "lparen") throw new Error(`«${t.value}» necesita un paréntesis`);
      const arg = this.parseExpr();
      if (this.next().type !== "rparen") throw new Error("Falta cerrar un paréntesis");
      return this.applyFunc(t.value, arg);
    }

    throw new Error("Esperaba un número aquí");
  }

  private applyFunc(name: string, x: number): number {
    // Cuánto vale una vuelta completa en la unidad elegida. En hex se calcula
    // en radianes; el hex sólo afecta a cómo se muestra el resultado, no a la
    // trigonometría.
    const turn = this.angle === "deg" ? 360 : 2 * Math.PI;
    const toRad = (v: number) => (v / turn) * 2 * Math.PI;
    const fromRad = (v: number) => (v / (2 * Math.PI)) * turn;

    switch (name) {
      case "sin": return Math.sin(toRad(x));
      case "cos": return Math.cos(toRad(x));
      case "tan": return Math.tan(toRad(x));
      case "asin": return fromRad(Math.asin(x));
      case "acos": return fromRad(Math.acos(x));
      case "atan": return fromRad(Math.atan(x));
      case "ln": return Math.log(x);
      case "log": return Math.log10(x);
      case "sqrt": return Math.sqrt(x);
      case "abs": return Math.abs(x);
      default: throw new Error(`Función desconocida: «${name}»`);
    }
  }
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new Error("El factorial sólo va con enteros ≥ 0");
  if (n > 170) return Infinity; // más allá se sale del rango de un número
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

/** Redondea la basurilla de coma flotante y da coma decimal española. */
export function formatResult(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  const rounded = Math.round(n * 1e12) / 1e12;
  if (rounded !== 0 && (Math.abs(rounded) >= 1e15 || Math.abs(rounded) < 1e-10)) {
    return rounded.toExponential(8).replace(/\.?0+e/, "e").replace(".", ",");
  }
  return String(rounded).replace(".", ",");
}

/**
 * El resultado en hexadecimal.
 *
 * El hex sólo tiene sentido con enteros, así que se redondea. La parte decimal
 * se muestra aparte en decimal, porque `0x1A,8` no lo entiende nadie.
 */
export function formatHex(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  const whole = Math.trunc(n);
  const hex = (whole < 0 ? "-0x" : "0x") + Math.abs(whole).toString(16).toUpperCase();
  const frac = n - whole;
  return frac === 0 ? hex : `${hex} (${formatResult(n)})`;
}

export function present(n: number, mode: AngleUnit): string {
  return mode === "hex" ? formatHex(n) : formatResult(n);
}
