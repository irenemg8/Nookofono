import { useRef, useState } from "react";
import { useBattery } from "../shared/lib/use-battery";
import { useClock } from "../shared/lib/use-clock";
import type { TimeOfDay } from "../shared/lib/use-time-of-day";
import { wallpapers } from "./wallpapers";

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Cuánto hay que arrastrar hacia arriba para desbloquear. */
const UNLOCK_THRESHOLD = 90;

function FlashlightIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 2h8v3.5L13.5 9v13h-3V9L8 5.5V2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8h3.2l1.4-2h6.8l1.4 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
        fill="currentColor"
      />
      <circle cx="12" cy="13.5" r="3.6" fill="var(--nk-sea-deep)" />
    </svg>
  );
}

export default function LockScreen({
  onUnlock,
  phase,
}: {
  onUnlock: () => void;
  phase: TimeOfDay;
}) {
  const time = useClock();
  const battery = useBattery();
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const wallpaper = wallpapers[phase].lock;

  // Tres tramos, y a medias cuando el navegador no da el dato.
  const step = !battery.supported
    ? "half"
    : battery.level > 66
      ? "full"
      : battery.level > 25
        ? "half"
        : "empty";
  const fill = step === "full" ? "100%" : step === "half" ? "50%" : "0%";

  const now = new Date();
  const date = `${DAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS[now.getMonth()]}`;

  function onPointerDown(e: React.PointerEvent) {
    start.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (start.current === null) return;
    // Sólo hacia arriba, y con resistencia creciente para que se note el tope.
    setDrag(Math.max(0, start.current - e.clientY));
  }

  function onPointerUp() {
    if (start.current === null) return;
    start.current = null;
    if (drag > UNLOCK_THRESHOLD) onUnlock();
    else setDrag(0);
  }

  return (
    <div
      className="nk-lock"
      style={{
        transform: `translateY(${-drag}px)`,
        transition: start.current === null ? "transform .32s cubic-bezier(.32,.72,0,1)" : "none",
        backgroundImage: `url(${wallpaper})`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="nk-lock__top">
        <div className="nk-lock__battery">
          <span className={`nk-battery nk-battery--${step}`}>
            <span className="nk-battery__fill" style={{ width: fill }} />
          </span>
          {battery.supported && <span>{battery.level} %</span>}
          <span className="nk-lock__device">iPug</span>
        </div>

        <p className="nk-lock__time">{time}</p>
        <p className="nk-lock__date">{date}</p>
      </div>

      <div className="nk-lock__bottom">
        <div className="nk-lock__actions">
          <button type="button" className="nk-lock__action" aria-label="Linterna">
            <FlashlightIcon />
          </button>
          <button type="button" className="nk-lock__action" aria-label="Cámara">
            <CameraIcon />
          </button>
        </div>

        <button type="button" className="nk-lock__unlock" onClick={onUnlock}>
          Desliza hacia arriba para abrir
        </button>

        <span className="nk-lock__indicator" aria-hidden="true" />
      </div>
    </div>
  );
}
