import { useEffect, useRef, useState } from "react";
import type { PersonId } from "../../../shared/lib/use-current-user";
import type { useRemoteCollection } from "../../../shared/lib/use-remote-collection";
import { ConfirmDialog, RemoveBadge } from "../../../shared/ui/ConfirmDialog";
import {
  formatDuration,
  type Exercise,
  type Routine,
  type SportSession,
} from "../model/types";

type Routines = ReturnType<typeof useRemoteCollection<Routine>>;
type Sessions = ReturnType<typeof useRemoteCollection<SportSession>>;

export function Routines({
  me,
  routines,
  sessions,
}: {
  me: PersonId;
  routines: Routines;
  sessions: Sessions;
}) {
  const mine = routines.items
    .filter((r) => r.user === me)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const [editing, setEditing] = useState<Routine | "new" | null>(null);
  const [running, setRunning] = useState<Routine | null>(null);
  const [pending, setPending] = useState<Routine | null>(null);

  async function saveRoutine(name: string, exercises: Exercise[], existing: Routine | "new") {
    setEditing(null);
    if (existing === "new") {
      await routines.create({ user: me, name, exercises });
    } else {
      await routines.update(existing.id, { name, exercises });
    }
  }

  if (running) {
    return (
      <RoutineRunner
        routine={running}
        onClose={() => setRunning(null)}
        onSave={(durationSec) => {
          sessions.create({
            user: me,
            sport: running.name,
            emoji: "📋",
            durationSec,
            note: "Rutina",
            doneAt: Date.now(),
          });
          setRunning(null);
        }}
      />
    );
  }

  if (editing) {
    return (
      <RoutineEditor
        initial={editing === "new" ? null : editing}
        onCancel={() => setEditing(null)}
        onSave={(name, exercises) => saveRoutine(name, exercises, editing)}
      />
    );
  }

  return (
    <div className="sp-routines">
      <button type="button" className="sp-newroutine" onClick={() => setEditing("new")}>
        + Nueva rutina
      </button>

      {mine.length === 0 ? (
        <p className="sp-empty">Crea un listado de ejercicios para cargarlo cuando entrenes.</p>
      ) : (
        <ul className="sp-rlist">
          {mine.map((r) => (
            <li key={r.id} className="sp-rcard">
              <div className="sp-rcard__body">
                <strong>{r.name}</strong>
                <span className="sp-rcard__meta">
                  {r.exercises.length} ejercicio{r.exercises.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="sp-rcard__acts">
                <button type="button" className="nk-btn nk-btn--ghost" onClick={() => setEditing(r)}>
                  Editar
                </button>
                <button type="button" className="nk-btn" onClick={() => setRunning(r)}>
                  Empezar
                </button>
              </div>
              <RemoveBadge danger label={`Borrar ${r.name}`} onRemove={() => setPending(r)} />
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <ConfirmDialog
          title="¿Borrar esta rutina?"
          body={`Se borra el listado «${pending.name}».`}
          confirmLabel="Borrar"
          onConfirm={() => {
            routines.remove(pending.id);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- editor */

function RoutineEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: Routine | null;
  onCancel: () => void;
  onSave: (name: string, exercises: Exercise[]) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [rows, setRows] = useState<Exercise[]>(
    initial?.exercises.length ? initial.exercises : [{ name: "", kind: "reps", amount: 10 }],
  );

  function setRow(i: number, patch: Partial<Exercise>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { name: "", kind: "reps", amount: 10 }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit() {
    const clean = rows.map((r) => ({ ...r, name: r.name.trim() })).filter((r) => r.name);
    if (!name.trim() || clean.length === 0) return;
    onSave(name.trim(), clean);
  }

  return (
    <div className="sp-editor">
      <label>
        <span className="sp-legend">Nombre de la rutina</span>
        <input
          autoFocus
          value={name}
          placeholder="Piernas, movilidad, full body…"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <span className="sp-legend">Ejercicios</span>
      <ul className="sp-exlist">
        {rows.map((r, i) => (
          <li key={i} className="sp-exrow">
            <input
              className="sp-exrow__name"
              value={r.name}
              placeholder="Sentadillas"
              onChange={(e) => setRow(i, { name: e.target.value })}
            />
            <div className="sp-exrow__kind">
              <button
                type="button"
                className={`sp-toggle${r.kind === "reps" ? " sp-toggle--on" : ""}`}
                onClick={() => setRow(i, { kind: "reps" })}
              >
                reps
              </button>
              <button
                type="button"
                className={`sp-toggle${r.kind === "time" ? " sp-toggle--on" : ""}`}
                onClick={() => setRow(i, { kind: "time" })}
              >
                seg
              </button>
            </div>
            <input
              className="sp-exrow__amt"
              type="number"
              min={1}
              value={r.amount}
              onChange={(e) => setRow(i, { amount: Math.max(1, Number(e.target.value) || 1) })}
            />
            {rows.length > 1 && (
              <button
                type="button"
                className="sp-exrow__x"
                onClick={() => removeRow(i)}
                aria-label="Quitar ejercicio"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>

      <button type="button" className="sp-addex" onClick={addRow}>
        + Añadir ejercicio
      </button>

      <div className="sp-form__actions">
        <button type="button" className="nk-btn nk-btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="nk-btn" onClick={submit}>
          Guardar rutina
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- runner */

function RoutineRunner({
  routine,
  onClose,
  onSave,
}: {
  routine: Routine;
  onClose: () => void;
  onSave: (durationSec: number) => void;
}) {
  const [done, setDone] = useState<boolean[]>(() => routine.exercises.map(() => false));

  // Cronómetro total de la rutina, arranca al abrir.
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  useEffect(() => {
    const id = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 500);
    return () => clearInterval(id);
  }, []);

  const allDone = done.every(Boolean);
  const doneCount = done.filter(Boolean).length;

  function toggle(i: number) {
    setDone((prev) => prev.map((d, idx) => (idx === i ? !d : d)));
  }

  return (
    <div className="sp-runner">
      <div className="sp-runner__head">
        <div>
          <strong>{routine.name}</strong>
          <span className="sp-runner__sub">
            {doneCount}/{routine.exercises.length} · {formatDuration(elapsed)}
          </span>
        </div>
        <button type="button" className="nk-btn nk-btn--ghost" onClick={onClose}>
          Salir
        </button>
      </div>

      <ul className="sp-run">
        {routine.exercises.map((ex, i) => (
          <li key={i} className={`sp-run__item${done[i] ? " sp-run__item--done" : ""}`}>
            <button
              type="button"
              className="sp-run__check"
              aria-pressed={done[i]}
              aria-label={done[i] ? "Marcar sin hacer" : "Marcar hecho"}
              onClick={() => toggle(i)}
            >
              ✓
            </button>
            <span className="sp-run__name">{ex.name}</span>
            {ex.kind === "reps" ? (
              <span className="sp-run__amt">×{ex.amount}</span>
            ) : (
              <Countdown seconds={ex.amount} onDone={() => setDone((p) => p.map((d, idx) => (idx === i ? true : d)))} />
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="nk-btn sp-finish"
        onClick={() => onSave(Math.max(1, Math.round(elapsed)))}
      >
        {allDone ? "Terminar y guardar" : "Guardar y salir"}
      </button>
    </div>
  );
}

/** Cuenta atrás para un ejercicio por tiempo. */
function Countdown({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const endRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const rem = Math.ceil((endRef.current - Date.now()) / 1000);
      if (rem <= 0) {
        setLeft(0);
        setRunning(false);
        onDone();
        clearInterval(id);
      } else {
        setLeft(rem);
      }
    }, 200);
    return () => clearInterval(id);
  }, [running, onDone]);

  function start() {
    if (running) {
      setRunning(false);
      return;
    }
    endRef.current = Date.now() + (left > 0 ? left : seconds) * 1000;
    if (left <= 0) setLeft(seconds);
    setRunning(true);
  }

  return (
    <button
      type="button"
      className={`sp-run__timer${running ? " sp-run__timer--run" : ""}`}
      onClick={start}
    >
      {running ? `${left}s ❚❚` : `${left}s ▶`}
    </button>
  );
}
