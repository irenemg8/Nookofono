import { useEffect, useState } from "react";
import { useCurrentUser, type PersonId } from "../../shared/lib/use-current-user";
import { useDebouncedSave } from "../../shared/lib/use-debounced-save";
import { useRemoteCollection, type Entity } from "../../shared/lib/use-remote-collection";
import { ConfirmDialog, RemoveBadge } from "../../shared/ui/ConfirmDialog";
import "./home.css";

/**
 * Casa — las tareas del hogar.
 *
 * Cada tarea tiene una **cadencia** (cada cuántas semanas toca). No hay un botón
 * de "reiniciar la semana": si la última vez que se hizo queda más lejos que su
 * cadencia, vuelve a estar **pendiente** ella sola. Así el domingo por la noche
 * un cron de servidor puede mirar qué sigue pendiente y avisar, sin que nadie
 * tenga que resetear nada (ver `docs/BACKEND-CASA.md`).
 */

interface Chore extends Entity {
  title: string;
  /** Cada cuántas semanas toca hacerla. 1 = todas las semanas. */
  everyWeeks: number;
  /** Última vez que se hizo (epoch ms). 0 = nunca. */
  lastDoneAt: number;
  /** Quién la hizo la última vez. */
  lastDoneBy: "" | PersonId;
  /** Sitio en la lista. */
  position: number;
}

const WEEK = 7 * 86_400_000;
const NAMES: Record<PersonId, string> = { irene: "Irene", vicente: "Vicente" };

/** Las de siempre, para arrancar con un toque. */
const SEED: { title: string; everyWeeks: number }[] = [
  { title: "Limpieza WC", everyWeeks: 1 },
  { title: "Limpieza mampara ducha", everyWeeks: 2 },
  { title: "Fregar el suelo", everyWeeks: 1 },
  { title: "Mantenimiento Roomba", everyWeeks: 1 },
  { title: "Limpieza vitro", everyWeeks: 1 },
  { title: "Cambiar las sábanas", everyWeeks: 1 },
  { title: "Quitar pelos de la cama de Nilo", everyWeeks: 1 },
];

/** ¿Toca hacerla? Sí si nunca se hizo o si su cadencia ya venció. */
function isPending(c: Chore, now: number): boolean {
  if (!c.lastDoneAt) return true;
  return now - c.lastDoneAt >= c.everyWeeks * WEEK;
}

const CADENCE_LABEL = (w: number) =>
  w <= 1 ? "cada semana" : w === 2 ? "cada 2 sem" : w === 4 ? "cada mes" : `cada ${w} sem`;

/** «hoy», «ayer», «hace 3 días», «hace 2 sem». */
function ago(ts: number, now: number): string {
  const days = Math.floor((now - ts) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 14) return `hace ${days} días`;
  return `hace ${Math.floor(days / 7)} sem`;
}

export default function HomeApp() {
  const chores = useRemoteCollection<Chore>("/api/casa");
  const me = useCurrentUser();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Chore | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Un tic por minuto por si al usar la app cruza la medianoche y algo pasa a
  // estar pendiente: barato y mantiene la lista honesta.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const sorted = [...chores.items].sort((a, b) => a.position - b.position);
  const todo = sorted.filter((c) => isPending(c, now));
  const done = sorted.filter((c) => !isPending(c, now));

  async function add(title: string, everyWeeks: number) {
    setAdding(false);
    await chores.create({
      title,
      everyWeeks,
      lastDoneAt: 0,
      lastDoneBy: "",
      position: chores.items.length,
    });
  }

  async function seed() {
    setSeeding(false);
    let base = chores.items.length;
    for (const s of SEED) {
      await chores.create({
        title: s.title,
        everyWeeks: s.everyWeeks,
        lastDoneAt: 0,
        lastDoneBy: "",
        position: base++,
      });
    }
  }

  function markDone(c: Chore) {
    chores.update(c.id, { lastDoneAt: Date.now(), lastDoneBy: me });
  }

  function markPending(c: Chore) {
    // Se marcó por error, o toca otra vez: se olvida la última vez.
    chores.update(c.id, { lastDoneAt: 0, lastDoneBy: "" });
  }

  if (chores.status === "loading") return <p className="hm-empty">Cargando…</p>;
  if (chores.status === "error") return <p className="hm-empty">{chores.error}</p>;

  return (
    <div className="hm">
      <button type="button" className="hm-new" onClick={() => setAdding(true)}>
        + Tarea del hogar…
      </button>

      {chores.items.length === 0 ? (
        <div className="hm-blank">
          <p className="hm-empty">La casa está sin tareas todavía.</p>
          <button type="button" className="nk-btn" onClick={() => setSeeding(true)}>
            Poner las de siempre
          </button>
        </div>
      ) : (
        <>
          {todo.length > 0 && (
            <section>
              <h2 className="hm-head hm-head--todo">Toca hacer · {todo.length}</h2>
              <ul className="hm-list">
                {todo.map((c) => (
                  <ChoreRow
                    key={c.id}
                    chore={c}
                    now={now}
                    onToggle={() => markDone(c)}
                    onCadence={(w) => chores.update(c.id, { everyWeeks: w })}
                    onRename={(t) => chores.update(c.id, { title: t })}
                    onRemove={() => setPending(c)}
                  />
                ))}
              </ul>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <h2 className="hm-head">Al día · {done.length}</h2>
              <ul className="hm-list">
                {done.map((c) => (
                  <ChoreRow
                    key={c.id}
                    chore={c}
                    now={now}
                    settled
                    onToggle={() => markPending(c)}
                    onCadence={(w) => chores.update(c.id, { everyWeeks: w })}
                    onRename={(t) => chores.update(c.id, { title: t })}
                    onRemove={() => setPending(c)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <p className="hm-hint">
        Los domingos por la noche, si algo sigue pendiente, os llega un aviso.
      </p>

      {adding && <ChoreForm onClose={() => setAdding(false)} onSave={add} />}

      {seeding && (
        <ConfirmDialog
          title="¿Poner las tareas de siempre?"
          body="Se añadirán WC, mampara, suelo, Roomba, vitro, sábanas y pelos de Nilo. Podrás editarlas y borrar las que no."
          confirmLabel="Ponerlas"
          onConfirm={seed}
          onCancel={() => setSeeding(false)}
        />
      )}

      {pending && (
        <ConfirmDialog
          title="¿Borrar esta tarea?"
          body={`Se borrará «${pending.title}» de las tareas de casa.`}
          confirmLabel="Borrar"
          onConfirm={() => {
            chores.remove(pending.id);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------- fila */

function ChoreRow({
  chore,
  now,
  settled,
  onToggle,
  onCadence,
  onRename,
  onRemove,
}: {
  chore: Chore;
  now: number;
  settled?: boolean;
  onToggle: () => void;
  onCadence: (weeks: number) => void;
  onRename: (title: string) => void;
  onRemove: () => void;
}) {
  const [title, setTitle] = useState(chore.title);
  const { push } = useDebouncedSave<string>((v) => onRename(v.trim() || "Sin nombre"));

  function edit(v: string) {
    setTitle(v);
    push(v);
  }

  // La cadencia cicla al tocarla: semanal → 2 sem → mensual → semanal.
  function cycleCadence() {
    const next = chore.everyWeeks <= 1 ? 2 : chore.everyWeeks === 2 ? 4 : 1;
    onCadence(next);
  }

  return (
    <li className={`hm-item${settled ? " hm-item--done" : ""}`}>
      <button
        type="button"
        className="hm-check"
        aria-pressed={settled}
        aria-label={settled ? "Marcar como pendiente" : "Marcar como hecha"}
        onClick={onToggle}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className="hm-item__body">
        <input
          className="hm-item__title"
          value={title}
          onChange={(e) => edit(e.target.value)}
          placeholder="Sin nombre"
        />
        <div className="hm-item__meta">
          <button type="button" className="hm-cadence" onClick={cycleCadence} title="Cambiar cada cuánto toca">
            {CADENCE_LABEL(chore.everyWeeks)}
          </button>
          {chore.lastDoneAt > 0 && (
            <span className="hm-last">
              {chore.lastDoneBy ? `${NAMES[chore.lastDoneBy]} · ` : ""}
              {ago(chore.lastDoneAt, now)}
            </span>
          )}
        </div>
      </div>

      <RemoveBadge danger label={`Borrar ${chore.title}`} onRemove={onRemove} />
    </li>
  );
}

/* ------------------------------------------------------------------ formulario */

function ChoreForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (title: string, everyWeeks: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [everyWeeks, setEveryWeeks] = useState(1);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(title.trim(), everyWeeks);
  }

  return (
    <div className="nk-sheet" onPointerDown={onClose}>
      <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
        <header className="nk-sheet__head">
          <h2>Tarea del hogar</h2>
          <button type="button" className="nk-sheet__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <form className="hm-form" onSubmit={submit}>
          <label>
            <span>Qué hay que hacer</span>
            <input
              autoFocus
              value={title}
              placeholder="Limpiar el filtro de la campana"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <div>
            <span className="hm-form__legend">Cada cuánto toca</span>
            <div className="hm-chips">
              {[1, 2, 4].map((w) => (
                <button
                  key={w}
                  type="button"
                  className="hm-chip"
                  aria-pressed={everyWeeks === w}
                  onClick={() => setEveryWeeks(w)}
                >
                  {CADENCE_LABEL(w)}
                </button>
              ))}
            </div>
          </div>

          <div className="hm-form__actions">
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
