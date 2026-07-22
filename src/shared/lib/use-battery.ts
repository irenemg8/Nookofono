import { useEffect, useState } from "react";

/**
 * Estado real de la batería del dispositivo.
 *
 * ⚠️ La Battery Status API sólo existe en navegadores Chromium (Chrome, Edge,
 * Opera y Chrome de Android). **Safari y Firefox la eliminaron por privacidad**,
 * así que en el iPhone —que es donde más nos interesaría— no hay dato.
 *
 * Cuando no está soportada devolvemos `supported: false` en lugar de inventar un
 * número: la barra de estado dibuja la pila vacía y omite el porcentaje.
 */
export interface BatteryState {
  supported: boolean;
  /** 0–100, redondeado. */
  level: number;
  charging: boolean;
}

interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
}

type NavigatorWithBattery = Navigator & {
  getBattery?: () => Promise<BatteryManager>;
};

export function useBattery(): BatteryState {
  const [state, setState] = useState<BatteryState>({
    supported: false,
    level: 0,
    charging: false,
  });

  useEffect(() => {
    const nav = navigator as NavigatorWithBattery;
    if (typeof nav.getBattery !== "function") return;

    let battery: BatteryManager | null = null;
    let cancelled = false;

    const read = () => {
      if (!battery) return;
      setState({
        supported: true,
        level: Math.round(battery.level * 100),
        charging: battery.charging,
      });
    };

    nav.getBattery().then((b) => {
      if (cancelled) return;
      battery = b;
      read();
      b.addEventListener("levelchange", read);
      b.addEventListener("chargingchange", read);
    });

    return () => {
      cancelled = true;
      battery?.removeEventListener("levelchange", read);
      battery?.removeEventListener("chargingchange", read);
    };
  }, []);

  return state;
}
