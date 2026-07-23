import { useState } from "react";
import { evaluate, present, type AngleUnit } from "./model/evaluate";
import "./calculator.css";

type Mode = "simple" | "scientific";

/** Cada tecla: lo que muestra y lo que inserta en la expresión. */
interface Key {
  label: string;
  /** Texto que se añade a la expresión. Por defecto, el propio `label`. */
  insert?: string;
  kind?: "num" | "op" | "fn" | "eq" | "act";
  /** Ocupa dos columnas (el 0). */
  wide?: boolean;
}

const SIMPLE: Key[] = [
  { label: "C", kind: "act" },
  { label: "⌫", kind: "act" },
  { label: "%", kind: "op" },
  { label: "÷", kind: "op" },
  { label: "7", kind: "num" }, { label: "8", kind: "num" }, { label: "9", kind: "num" },
  { label: "×", kind: "op" },
  { label: "4", kind: "num" }, { label: "5", kind: "num" }, { label: "6", kind: "num" },
  { label: "−", kind: "op" },
  { label: "1", kind: "num" }, { label: "2", kind: "num" }, { label: "3", kind: "num" },
  { label: "+", kind: "op" },
  { label: "0", kind: "num", wide: true },
  { label: ",", kind: "num" },
  { label: "=", kind: "eq" },
];

/** Fila extra de funciones que se antepone en modo científico. */
const SCI: Key[] = [
  { label: "sin", insert: "sin(", kind: "fn" },
  { label: "cos", insert: "cos(", kind: "fn" },
  { label: "tan", insert: "tan(", kind: "fn" },
  { label: "(", kind: "fn" },
  { label: ")", kind: "fn" },
  { label: "ln", insert: "ln(", kind: "fn" },
  { label: "log", insert: "log(", kind: "fn" },
  { label: "√", insert: "√(", kind: "fn" },
  { label: "xʸ", insert: "^", kind: "fn" },
  { label: "x²", insert: "^2", kind: "fn" },
  { label: "π", kind: "fn" },
  { label: "e", kind: "fn" },
  { label: "n!", insert: "!", kind: "fn" },
  { label: "1/x", insert: "^-1", kind: "fn" },
  { label: "|x|", insert: "abs(", kind: "fn" },
];

export default function CalculatorApp() {
  const [mode, setMode] = useState<Mode>("simple");
  const [angle, setAngle] = useState<AngleUnit>("deg");
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("");
  /** Al pulsar `=`, el siguiente dígito empieza un cálculo nuevo. */
  const [justEvaluated, setJustEvaluated] = useState(false);
  /** El resultado como número, para poder seguir calculando sobre él. */
  const [lastValue, setLastValue] = useState(0);

  // Vista previa del resultado mientras se escribe, sin llegar a fijarlo.
  const preview = livePreview(expr, angle);

  function press(key: Key) {
    if (key.kind === "act") {
      if (key.label === "C") reset();
      else backspace();
      return;
    }
    if (key.kind === "eq") return equals();

    const text = key.insert ?? key.label;

    // Tras un `=`, teclear un número arranca de cero, pero teclear un operador
    // sigue calculando sobre el resultado anterior. Se parte del valor numérico,
    // no del texto: en hex el texto es "0x1A", que no se puede volver a teclear.
    if (justEvaluated) {
      setExpr(key.kind === "op" ? String(lastValue) + text : text);
      setJustEvaluated(false);
      setResult("");
      return;
    }

    setExpr((e) => e + text);
  }

  function equals() {
    if (!expr) return;
    try {
      const value = evaluate(expr, angle);
      setResult(present(value, angle));
      setLastValue(value);
      setJustEvaluated(true);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Error");
      setJustEvaluated(true);
    }
  }

  function backspace() {
    setJustEvaluated(false);
    setExpr((e) => e.slice(0, -1));
  }

  function reset() {
    setExpr("");
    setResult("");
    setJustEvaluated(false);
  }

  return (
    <div className="calc">
      <div className="calc__modes">
        <button
          type="button"
          className="calc__mode"
          aria-pressed={mode === "simple"}
          onClick={() => setMode("simple")}
        >
          Simple
        </button>
        <button
          type="button"
          className="calc__mode"
          aria-pressed={mode === "scientific"}
          onClick={() => setMode("scientific")}
        >
          Científica
        </button>
      </div>

      <div className="calc__screen">
        <div className="calc__expr">{prettyExpr(expr) || "0"}</div>
        <div className="calc__result">
          {justEvaluated ? result : preview !== null ? `= ${preview}` : " "}
        </div>
      </div>

      {mode === "scientific" && (
        <div className="calc__sci-head">
          <div className="calc__angle">
            {(
              [
                ["deg", "DEG"],
                ["rad", "RAD"],
                ["hex", "HEX"],
              ] as [AngleUnit, string][]
            ).map(([unit, label]) => (
              <button
                key={unit}
                type="button"
                aria-pressed={angle === unit}
                onClick={() => setAngle(unit)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "scientific" && (
        <div className="calc__sci">
          {SCI.map((k) => (
            <button
              key={k.label}
              type="button"
              className={`calc__key calc__key--${k.kind}`}
              onClick={() => press(k)}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}

      <div className="calc__pad">
        {SIMPLE.map((k) => (
          <button
            key={k.label}
            type="button"
            className={`calc__key calc__key--${k.kind}${k.wide ? " calc__key--wide" : ""}`}
            onClick={() => press(k)}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** El resultado en vivo, o `null` si la expresión aún no evalúa a nada. */
function livePreview(expr: string, angle: AngleUnit): string | null {
  if (!expr || /[+\-×÷*/^(]$/.test(expr)) return null;
  try {
    return present(evaluate(expr, angle), angle);
  } catch {
    return null;
  }
}

/** Deja la expresión más legible sin cambiar lo que significa. */
function prettyExpr(expr: string): string {
  return expr.replace(/\*/g, "×").replace(/\//g, "÷").replace(/sqrt\(/g, "√(");
}
