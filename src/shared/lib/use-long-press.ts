import { useEffect, useRef } from "react";

/** Cuánto se puede mover el dedo sin que se cancele la pulsación. */
const MOVE_TOLERANCE = 12;

/**
 * Pulsación larga fiable en móvil.
 *
 * Hay tres trampas de iOS Safari que hacen que la versión ingenua
 * (`setTimeout` en `pointerdown`, `clearTimeout` en `pointerup`) no funcione
 * nunca en un iPhone:
 *
 * 1. **`pointerleave` salta con el dedo quieto.** Basta un temblor de un píxel
 *    para que el navegador considere que el puntero ha salido del elemento. Por
 *    eso aquí no se escucha `pointerleave`: se mide la distancia recorrida y
 *    sólo se cancela si supera `MOVE_TOLERANCE`.
 *
 * 2. **La rejilla se desplaza en horizontal.** Al empezar el gesto, Safari no
 *    sabe si vas a deslizar de página o a mantener pulsado, y en cuanto decide
 *    que es un desplazamiento emite `pointercancel`. Se acepta: si el gesto
 *    pasa a ser un desplazamiento, no era una pulsación larga.
 *
 * 3. **El menú contextual del sistema.** Mantener pulsado sobre una imagen
 *    abre el menú de "Guardar imagen" y mata el gesto. Se evita en CSS con
 *    `-webkit-touch-callout: none` y `pointer-events: none` sobre el `img`.
 */
export function useLongPress(onLongPress: () => void, ms: number) {
  const timer = useRef<number>(0);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    window.clearTimeout(timer.current);
    origin.current = null;
  };

  useEffect(() => cancel, []);

  return {
    /** `true` si la última pulsación llegó a disparar: sirve para anular el tap. */
    firedRef: fired,
    handlers: {
      onPointerDown(e: React.PointerEvent) {
        fired.current = false;
        origin.current = { x: e.clientX, y: e.clientY };
        timer.current = window.setTimeout(() => {
          fired.current = true;
          origin.current = null;
          onLongPress();
        }, ms);
      },
      onPointerMove(e: React.PointerEvent) {
        const from = origin.current;
        if (!from) return;
        const dx = e.clientX - from.x;
        const dy = e.clientY - from.y;
        if (Math.hypot(dx, dy) > MOVE_TOLERANCE) cancel();
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onContextMenu(e: React.MouseEvent) {
        e.preventDefault();
      },
    },
  };
}
