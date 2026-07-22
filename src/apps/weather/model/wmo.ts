/**
 * Códigos meteorológicos WMO 4677, que es lo que devuelve Open-Meteo.
 *
 * Se agrupan en seis familias porque para la interfaz no aporta nada distinguir
 * entre "llovizna ligera" y "llovizna moderada": lo que cambia es el dibujo.
 */
export type Sky = "clear" | "cloudy" | "overcast" | "fog" | "rain" | "snow" | "storm";

export function skyOf(code: number): Sky {
  if (code === 0 || code === 1) return "clear";
  if (code === 2) return "cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 71 && code <= 77) return "snow";
  if (code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "rain";
}

/** Texto en español, más específico que la familia. */
export function describe(code: number): string {
  const map: Record<number, string> = {
    0: "Despejado",
    1: "Casi despejado",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Niebla",
    48: "Niebla helada",
    51: "Llovizna ligera",
    53: "Llovizna",
    55: "Llovizna intensa",
    56: "Llovizna helada",
    57: "Llovizna helada intensa",
    61: "Lluvia ligera",
    63: "Lluvia",
    65: "Lluvia intensa",
    66: "Lluvia helada",
    67: "Lluvia helada intensa",
    71: "Nieve ligera",
    73: "Nieve",
    75: "Nieve intensa",
    77: "Granizo fino",
    80: "Chubascos ligeros",
    81: "Chubascos",
    82: "Chubascos fuertes",
    85: "Chubascos de nieve",
    86: "Chubascos de nieve fuertes",
    95: "Tormenta",
    96: "Tormenta con granizo",
    99: "Tormenta fuerte con granizo",
  };
  return map[code] ?? "Sin datos";
}
