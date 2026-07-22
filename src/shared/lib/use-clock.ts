import { useEffect, useState } from "react";

/**
 * Hora real del dispositivo, formateada en español.
 *
 * Comprueba cada segundo pero guarda el *string* ya formateado, así React
 * descarta el render cuando el minuto no ha cambiado: 59 de cada 60 ticks no
 * cuestan nada.
 */
export function useClock(): string {
  const [time, setTime] = useState(formatTime);

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime()), 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

function formatTime(): string {
  return new Date().toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
