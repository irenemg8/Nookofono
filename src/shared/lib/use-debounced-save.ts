import { useCallback, useEffect, useRef } from "react";

/**
 * Guarda al dejar de escribir, no en cada tecla.
 *
 * Escribir en `localStorage` era gratis, así que las apps guardaban en cada
 * pulsación. Contra la API eso es una petición HTTP por letra: una nota de dos
 * párrafos serían cientos, llegarían desordenadas y la última en responder
 * podría ser la más vieja.
 *
 * Aquí se espera a que pare de teclear. Lo pendiente se manda también al
 * desmontar, para que cerrar la nota justo después de escribir no pierda la
 * última frase.
 */
const DELAY_MS = 600;

export function useDebouncedSave<T>(save: (value: T) => void, delay = DELAY_MS) {
  const timer = useRef<number | null>(null);
  const pending = useRef<T | null>(null);

  // `save` suele ser una función nueva en cada render; con la referencia en un
  // ref, el temporizador siempre llama a la última sin reiniciarse por ello.
  const latest = useRef(save);
  useEffect(() => {
    latest.current = save;
  }, [save]);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current !== null) {
      latest.current(pending.current);
      pending.current = null;
    }
  }, []);

  const push = useCallback(
    (value: T) => {
      pending.current = value;
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        if (pending.current !== null) {
          latest.current(pending.current);
          pending.current = null;
        }
      }, delay);
    },
    [delay],
  );

  // Al cerrar la nota o salir de la app se manda lo que quedara a medias.
  useEffect(() => flush, [flush]);

  return { push, flush };
}
