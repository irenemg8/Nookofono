import { useState } from "react";
import { usePhotoLibrary } from "../../shared/lib/use-photo-library";
import type { PhotoWidgetConfig } from "../widgets";
import "./photos.css";

/**
 * Configura qué enseña un widget de Fotos: una foto fija, al azar de toda la
 * galería, o una selección que va rotando. Se abre desde el modo edición de la
 * pantalla de inicio.
 */
type Mode = "all" | "one" | "some";

const INTERVALS: { sec: number; label: string }[] = [
  { sec: 10, label: "10 s" },
  { sec: 30, label: "30 s" },
  { sec: 300, label: "5 min" },
  { sec: 3600, label: "1 h" },
  { sec: 86400, label: "1 día" },
];

export function WidgetPhotoSheet({
  initial,
  onSave,
  onClose,
}: {
  initial?: PhotoWidgetConfig;
  onSave: (config: PhotoWidgetConfig) => void;
  onClose: () => void;
}) {
  const lib = usePhotoLibrary();

  const [mode, setMode] = useState<Mode>(() => {
    if (!initial || initial.ids.length === 0) return "all";
    return initial.ids.length === 1 ? "one" : "some";
  });
  const [selected, setSelected] = useState<string[]>(initial?.ids ?? []);
  const [intervalSec, setIntervalSec] = useState(initial?.intervalSec ?? 30);

  function toggle(id: string) {
    if (mode === "one") {
      setSelected([id]);
      return;
    }
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function switchMode(m: Mode) {
    setMode(m);
    // Al pasar a "una", nos quedamos con una sola; a "todas", se vacía.
    if (m === "all") setSelected([]);
    else if (m === "one") setSelected((prev) => prev.slice(0, 1));
  }

  function save() {
    const ids = mode === "all" ? [] : selected;
    onSave({ ids, intervalSec });
    onClose();
  }

  const needsPick = mode !== "all";
  const rotates = mode === "all" || (mode === "some" && selected.length > 1);

  return (
    <div className="nk-sheet" onPointerDown={onClose}>
      <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
        <header className="nk-sheet__head">
          <h2>Widget de fotos</h2>
          <button type="button" className="nk-sheet__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="pw">
          <div className="pw-chips">
            <button
              type="button"
              className="hm-chip"
              aria-pressed={mode === "all"}
              onClick={() => switchMode("all")}
            >
              Al azar
            </button>
            <button
              type="button"
              className="hm-chip"
              aria-pressed={mode === "one"}
              onClick={() => switchMode("one")}
            >
              Una fija
            </button>
            <button
              type="button"
              className="hm-chip"
              aria-pressed={mode === "some"}
              onClick={() => switchMode("some")}
            >
              Una selección
            </button>
          </div>

          <p className="pw-hint">
            {mode === "all"
              ? "Va cambiando entre todas las fotos de la galería."
              : mode === "one"
                ? "Toca la foto que quieres fija en el widget."
                : "Toca las fotos que quieres; irá rotando entre ellas."}
          </p>

          {needsPick &&
            (lib.refs.length === 0 ? (
              <p className="ph-empty">No hay fotos aún. Sube alguna en la app Fotos.</p>
            ) : (
              <ul className="pw-grid">
                {lib.refs.map((p) => {
                  const on = selected.includes(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={`pw-cell${on ? " pw-cell--on" : ""}`}
                        onClick={() => toggle(p.id)}
                        aria-pressed={on}
                        aria-label={p.name}
                      >
                        <img src={p.url} alt="" loading="lazy" draggable={false} />
                        {on && <span className="pw-tick">✓</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ))}

          {rotates && (
            <div className="pw-interval">
              <span className="hm-form__legend">Cambia cada</span>
              <div className="pw-chips">
                {INTERVALS.map((it) => (
                  <button
                    key={it.sec}
                    type="button"
                    className="hm-chip"
                    aria-pressed={intervalSec === it.sec}
                    onClick={() => setIntervalSec(it.sec)}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pw-actions">
            <button type="button" className="nk-btn nk-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="nk-btn"
              onClick={save}
              disabled={needsPick && selected.length === 0}
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
