import { useEffect, useState } from "react";

export type TimeOfDay = "day" | "night";

/** El día empieza a las 7:00 y termina a las 21:00. */
const DAY_START = 7;
const DAY_END = 21;

/**
 * Si es de día o de noche, según la hora del dispositivo.
 *
 * Se comprueba cada minuto. Como devuelve un string y no un `Date`, React
 * descarta el render salvo en el minuto exacto en que cambia el tema — que es
 * dos veces al día.
 */
export function useTimeOfDay(): TimeOfDay {
  const [phase, setPhase] = useState<TimeOfDay>(current);

  useEffect(() => {
    const id = setInterval(() => setPhase(current()), 60_000);
    return () => clearInterval(id);
  }, []);

  return phase;
}

function current(): TimeOfDay {
  const h = new Date().getHours();
  return h >= DAY_START && h < DAY_END ? "day" : "night";
}
