import { useEffect, useRef, useState } from "react";
import type { PersonId } from "../../../shared/lib/use-current-user";
import type { useRemoteCollection } from "../../../shared/lib/use-remote-collection";
import { ConfirmDialog, RemoveBadge } from "../../../shared/ui/ConfirmDialog";
import {
  SPORT_EMOJIS,
  formatDuration,
  type SportKind,
  type SportSession,
} from "../model/types";

type Sports = ReturnType<typeof useRemoteCollection<SportKind>>;
type Sessions = ReturnType<typeof useRemoteCollection<SportSession>>;

export function Train({
  me,
  sports,
  sessions,
}: {
  me: PersonId;
  sports: Sports;
  sessions: Sessions;
}) {
  const list = [...sports.items].sort((a, b) => a.position - b.position);
  const [sportId, setSportId] = useState<string>("");
  const selected = list.find((s) => s.id === sportId) ?? list[0];

  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<SportKind | null>(null);
  const [note, setNote] = useState("");

  // --- Cronómetro ---
  const [elapsed, setElapsed] = useState(0); // segundos
  const [running, setRunning] = useState(false);
  const startedRef = useRef(0); // epoch ms del último arranque
  const baseRef = useRef(0); // segundos acumulados antes del arranque actual

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setElapsed(baseRef.current + (Date.now() - startedRef.current) / 1000);
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  function toggle() {
    if (running) {
      baseRef.current = elapsed;
      setRunning(false);
    } else {
      startedRef.current = Date.now();
      setRunning(true);
    }
  }

  function reset() {
    setRunning(false);
    baseRef.current = 0;
    setElapsed(0);
  }

  async function save() {
    const secs = Math.round(elapsed);
    if (secs < 1 || !selected) return;
    await sessions.create({
      user: me,
      sport: selected.name,
      emoji: selected.emoji,
      durationSec: secs,
      note: note.trim(),
      doneAt: Date.now(),
    });
    reset();
    setNote("");
  }

  async function addSport(name: string, emoji: string) {
    setAdding(false);
    const item = await sports.create({ name, emoji, position: sports.items.length });
    if (item) setSportId(item.id);
  }

  return (
    <div className="sp-train">
      <div className="sp-pick__head">
        <span className="sp-legend">Deporte</span>
        <button type="button" className="sp-editlink" onClick={() => setEditing((e) => !e)}>
          {editing ? "Listo" : "Editar"}
        </button>
      </div>

      <div className="sp-sports">
        {list.map((s) => (
          <div key={s.id} className="sp-sport__wrap">
            <button
              type="button"
              className={`sp-sport${selected?.id === s.id ? " sp-sport--on" : ""}`}
              onClick={() => setSportId(s.id)}
            >
              <span className="sp-sport__emoji">{s.emoji}</span>
              <span className="sp-sport__name">{s.name}</span>
            </button>
            {editing && list.length > 1 && (
              <RemoveBadge danger label={`Quitar ${s.name}`} onRemove={() => setRemoving(s)} />
            )}
          </div>
        ))}
        <button type="button" className="sp-sport sp-sport--add" onClick={() => setAdding(true)}>
          <span className="sp-sport__emoji">＋</span>
          <span className="sp-sport__name">Otro</span>
        </button>
      </div>

      {/* Cronómetro */}
      <div className="sp-timer">
        <div className="sp-timer__sport">
          {selected ? `${selected.emoji} ${selected.name}` : "Elige un deporte"}
        </div>
        <div className={`sp-timer__clock${running ? " sp-timer__clock--run" : ""}`}>
          {formatDuration(elapsed)}
        </div>
        <div className="sp-timer__btns">
          <button type="button" className="sp-round sp-round--ghost" onClick={reset} aria-label="Reiniciar">
            ↺
          </button>
          <button
            type="button"
            className="sp-round sp-round--go"
            onClick={toggle}
            aria-label={running ? "Pausar" : "Empezar"}
          >
            {running ? "❚❚" : "▶"}
          </button>
          <button
            type="button"
            className="sp-round sp-round--save"
            onClick={save}
            disabled={Math.round(elapsed) < 1}
            aria-label="Guardar sesión"
          >
            ✓
          </button>
        </div>
      </div>

      <label className="sp-note">
        <span className="sp-legend">Nota</span>
        <textarea
          rows={2}
          value={note}
          placeholder="Cómo ha ido, series, sensaciones…"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <p className="sp-hint">Al guardar se apunta en tu historial (el de {me === "irene" ? "Irene" : "Vicente"}).</p>

      {adding && <AddSport onClose={() => setAdding(false)} onSave={addSport} />}

      {removing && (
        <ConfirmDialog
          title="¿Quitar este deporte?"
          body={`Se quita «${removing.name}» de la lista. Tus sesiones anteriores de ese deporte se quedan en el historial.`}
          confirmLabel="Quitar"
          onConfirm={() => {
            sports.remove(removing.id);
            if (sportId === removing.id) setSportId("");
            setRemoving(null);
          }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

function AddSport({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (name: string, emoji: string) => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(SPORT_EMOJIS[0]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), emoji);
  }

  return (
    <div className="nk-sheet" onPointerDown={onClose}>
      <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
        <header className="nk-sheet__head">
          <h2>Nuevo deporte</h2>
          <button type="button" className="nk-sheet__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <form className="sp-form" onSubmit={submit}>
          <label>
            <span className="sp-legend">Nombre</span>
            <input
              autoFocus
              value={name}
              placeholder="Escalada, boxeo, remo…"
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div>
            <span className="sp-legend">Icono</span>
            <div className="sp-emojis">
              {SPORT_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  className={`sp-emoji${emoji === em ? " sp-emoji--on" : ""}`}
                  aria-pressed={emoji === em}
                  onClick={() => setEmoji(em)}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div className="sp-form__actions">
            <button type="button" className="nk-btn nk-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="nk-btn">
              Añadir
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
