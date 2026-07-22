import { useCallback, useEffect, useRef, useState } from "react";

export interface WalkResult {
  startedAt: number;
  endedAt: number;
  durationSec: number;
  steps: number;
  distanceM: number;
}

interface Live {
  running: boolean;
  seconds: number;
  steps: number;
  distanceM: number;
  /** Motivo por el que los pasos no se están contando, si es el caso. */
  stepsProblem: string | null;
}

/**
 * Paseo con Nilo: cronómetro, distancia y pasos.
 *
 * ⚠️ **Los pasos son una estimación, no el dato del iPhone.** No existe ninguna
 * forma de leer Salud/HealthKit desde una web: es exclusivo de apps nativas. El
 * contador real del móvil vive en un coprocesador al que el navegador no llega,
 * y por eso sigue contando con la pantalla apagada.
 *
 * Lo que sí se puede, y es lo que hace esto: detectar los picos del
 * acelerómetro mientras la app está abierta. Requisitos:
 *
 * - En iOS hay que pedir permiso con `DeviceMotionEvent.requestPermission()`
 *   **desde un gesto del usuario**; por eso se pide al pulsar "Empezar". Si se
 *   llamara al cargar, Safari devolvería ceros en silencio.
 * - La pantalla tiene que seguir encendida, así que se pide un *wake lock* y se
 *   vuelve a pedir al volver a la pestaña, porque se pierde al salir.
 *
 * La distancia sí es fiable: viene del GPS.
 */
export function useWalk() {
  const [live, setLive] = useState<Live>({
    running: false,
    seconds: 0,
    steps: 0,
    distanceM: 0,
    stepsProblem: null,
  });

  const startedAt = useRef(0);
  const steps = useRef(0);
  const distance = useRef(0);
  const lastFix = useRef<GeolocationCoordinates | null>(null);
  const watchId = useRef<number | null>(null);
  const ticker = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  // Detección de pasos: media móvil para quitar la gravedad y un umbral con
  // tiempo mínimo entre picos, que evita contar el mismo rebote dos veces.
  const smoothed = useRef(0);
  const armed = useRef(true);
  const lastStepAt = useRef(0);

  const onMotion = useCallback((e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;

    const magnitude = Math.hypot(a.x, a.y, a.z);
    smoothed.current = smoothed.current * 0.9 + magnitude * 0.1;
    const delta = magnitude - smoothed.current;

    const now = Date.now();
    if (armed.current && delta > 1.8 && now - lastStepAt.current > 250) {
      steps.current += 1;
      lastStepAt.current = now;
      armed.current = false;
    } else if (delta < 0.4) {
      armed.current = true;
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      wakeLock.current = await navigator.wakeLock?.request("screen");
    } catch {
      // Sin wake lock el paseo sigue, pero hay que mantener la pantalla a mano.
    }
  }, []);

  const start = useCallback(async () => {
    steps.current = 0;
    distance.current = 0;
    lastFix.current = null;
    startedAt.current = Date.now();

    let stepsProblem: string | null = null;

    // iOS 13+: el permiso sólo se concede desde un gesto, y estamos en el
    // manejador del botón, así que este es el único momento válido.
    const DME = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<PermissionState>;
    };

    if (typeof DME?.requestPermission === "function") {
      try {
        const granted = await DME.requestPermission();
        if (granted !== "granted") stepsProblem = "Sin permiso de movimiento";
      } catch {
        stepsProblem = "Sin permiso de movimiento";
      }
    } else if (typeof DeviceMotionEvent === "undefined") {
      stepsProblem = "Este dispositivo no tiene acelerómetro";
    }

    if (!stepsProblem) window.addEventListener("devicemotion", onMotion);

    if (navigator.geolocation) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const prev = lastFix.current;
          if (prev) distance.current += haversine(prev, pos.coords);
          lastFix.current = pos.coords;
        },
        undefined,
        { enableHighAccuracy: true, maximumAge: 2000 },
      );
    }

    await requestWakeLock();

    ticker.current = window.setInterval(() => {
      setLive({
        running: true,
        seconds: Math.round((Date.now() - startedAt.current) / 1000),
        steps: steps.current,
        distanceM: Math.round(distance.current),
        stepsProblem,
      });
    }, 1000);

    setLive({ running: true, seconds: 0, steps: 0, distanceM: 0, stepsProblem });
  }, [onMotion, requestWakeLock]);

  const stop = useCallback((): WalkResult => {
    window.removeEventListener("devicemotion", onMotion);
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (ticker.current !== null) window.clearInterval(ticker.current);
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;

    const endedAt = Date.now();
    const result: WalkResult = {
      startedAt: startedAt.current,
      endedAt,
      durationSec: Math.round((endedAt - startedAt.current) / 1000),
      steps: steps.current,
      distanceM: Math.round(distance.current),
    };

    setLive({ running: false, seconds: 0, steps: 0, distanceM: 0, stepsProblem: null });
    return result;
  }, [onMotion]);

  // El wake lock se pierde al cambiar de pestaña o bloquear: hay que rearmarlo.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && live.running) requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [live.running, requestWakeLock]);

  return { live, start, stop };
}

/** Distancia entre dos posiciones, en metros. */
function haversine(a: GeolocationCoordinates, b: GeolocationCoordinates): number {
  const R = 6_371_000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
