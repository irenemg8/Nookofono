import dayLock from "../assets/wallpapers/day_principal.webp";
import nightLock from "../assets/wallpapers/night_principal.webp";
import nightHome from "../assets/wallpapers/night.webp";
import type { TimeOfDay } from "../shared/lib/use-time-of-day";

/**
 * Fondos según la hora.
 *
 * - **Bloqueo**: la isla con la palmera, en su versión de día o de noche.
 * - **Inicio**: de día no lleva imagen, se queda la playa dibujada con CSS; de
 *   noche usa el cielo estrellado. La ola y el dock siguen siendo elementos
 *   propios en ambos casos, así que la imagen sólo cubre la zona de iconos.
 */
export const wallpapers: Record<TimeOfDay, { lock: string; home: string | null }> = {
  day: { lock: dayLock, home: null },
  night: { lock: nightLock, home: nightHome },
};
