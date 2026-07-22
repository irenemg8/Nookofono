import { useState } from "react";

export interface Point {
  id: string;
  at: string;
  grams: number;
}

const W = 300;
const H = 130;
const PAD = { top: 16, right: 14, bottom: 24, left: 34 };

/**
 * Evolución del peso.
 *
 * Serie única, así que no lleva leyenda: el título ya dice qué es. Una sola
 * tonalidad —el verde del sistema—, rejilla discreta, y etiqueta directa sólo
 * en el último punto, no en todos. Al tocar un punto se muestra su valor.
 */
export function WeightChart({ points }: { points: Point[] }) {
  const [picked, setPicked] = useState<string | null>(null);

  if (points.length === 0) return null;

  const sorted = [...points].sort((a, b) => a.at.localeCompare(b.at));
  const values = sorted.map((p) => p.grams);

  // Un margen del 8% arriba y abajo evita que la línea toque los bordes. Con un
  // solo pesaje no hay rango, así que se inventa uno para poder dibujar.
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || 1000;
  const min = rawMin - span * 0.08;
  const max = rawMax + span * 0.08;

  const x = (i: number) =>
    sorted.length === 1
      ? PAD.left + (W - PAD.left - PAD.right) / 2
      : PAD.left + (i / (sorted.length - 1)) * (W - PAD.left - PAD.right);

  const y = (g: number) =>
    PAD.top + (1 - (g - min) / (max - min)) * (H - PAD.top - PAD.bottom);

  const line = sorted.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(p.grams)}`).join(" ");
  const area = `${line} L${x(sorted.length - 1)} ${H - PAD.bottom} L${x(0)} ${H - PAD.bottom} Z`;

  const last = sorted[sorted.length - 1];
  const selected = sorted.find((p) => p.id === picked) ?? null;

  return (
    <figure className="wc">
      <figcaption className="wc__caption">
        Peso de Nilo
        <span>{kg(last.grams)} kg hoy</span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="wc__svg" role="img">
        {/* Rejilla: sólo mínimo y máximo, para no competir con los datos. */}
        {[rawMax, rawMin].map((g) => (
          <g key={g}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(g)}
              y2={y(g)}
              className="wc__grid"
              vectorEffect="non-scaling-stroke"
            />
            <text x={PAD.left - 6} y={y(g) + 3.5} className="wc__tick" textAnchor="end">
              {kg(g)}
            </text>
          </g>
        ))}

        <path d={area} className="wc__area" />
        <path d={line} className="wc__line" vectorEffect="non-scaling-stroke" fill="none" />

        {sorted.map((p, i) => (
          <circle
            key={p.id}
            cx={x(i)}
            cy={y(p.grams)}
            r={p.id === picked ? 6 : 4.5}
            className={`wc__dot${p.id === picked ? " wc__dot--on" : ""}`}
            onClick={() => setPicked(p.id === picked ? null : p.id)}
          />
        ))}

        {/* Etiqueta directa sólo en el último punto. */}
        {!selected && (
          <text
            x={x(sorted.length - 1)}
            y={y(last.grams) - 10}
            className="wc__value"
            textAnchor="end"
          >
            {kg(last.grams)} kg
          </text>
        )}

        <text x={PAD.left} y={H - 6} className="wc__tick">
          {shortDate(sorted[0].at)}
        </text>
        {sorted.length > 1 && (
          <text x={W - PAD.right} y={H - 6} className="wc__tick" textAnchor="end">
            {shortDate(last.at)}
          </text>
        )}
      </svg>

      <p className="wc__readout">
        {selected
          ? `${kg(selected.grams)} kg · ${longDate(selected.at)}`
          : "Toca un punto para ver el pesaje"}
      </p>
    </figure>
  );
}

function kg(grams: number) {
  return (grams / 1000).toFixed(1);
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
