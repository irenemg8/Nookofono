import { useEffect, useState } from "react";
import { notify } from "../../shared/lib/ntfy";
import { useCurrentUser, type PersonId } from "../../shared/lib/use-current-user";
import { useRemoteCollection, type Entity } from "../../shared/lib/use-remote-collection";
import { ConfirmDialog, RemoveBadge } from "../../shared/ui/ConfirmDialog";
import "./incidents.css";

const TOPIC = "ipug-incidencias-7c4e9a2f81b6";

type Who = "irene" | "vicente" | "both";
type Priority = "baja" | "media" | "alta";

interface Incident extends Entity {
  title: string;
  description: string;
  priority: Priority;
  /** A quién le toca arreglarlo. */
  assignee: Who;
  /** Plazo en días desde que se crea. 0 = sin plazo. */
  dueDays: number;
  done: boolean;
  doneAt: number;
}

const NAMES: Record<PersonId, string> = { irene: "Irene", vicente: "Vicente" };
const WHO_LABEL: Record<Who, string> = { irene: "Irene", vicente: "Vicente", both: "Los dos" };
const WHO_COLOR: Record<Who, string> = { irene: "#e86a92", vicente: "#5aa9e6", both: "var(--nk-leaf)" };
const PRIORITY_LABEL: Record<Priority, string> = { baja: "Sin prisa", media: "Normal", alta: "Urgente" };

/** Días por defecto según prioridad, para el plazo. */
const DEFAULT_DAYS: Record<Priority, number> = { baja: 14, media: 7, alta: 2 };

export default function IncidentsApp() {
  const items = useRemoteCollection<Incident>("/api/incidents");
  const me = useCurrentUser();
  const [composing, setComposing] = useState(false);
  const [pending, setPending] = useState<Incident | null>(null);

  const open = items.items
    .filter((i) => !i.done)
    .sort((a, b) => deadline(a) - deadline(b)); // lo que antes vence, arriba
  const closed = items.items.filter((i) => i.done).sort((a, b) => b.doneAt - a.doneAt);

  async function create(data: {
    title: string;
    description: string;
    priority: Priority;
    assignee: Who;
    dueDays: number;
  }) {
    setComposing(false);
    await items.create({ ...data, done: false, doneAt: 0 });

    // Aviso al móvil del otro (o a ambos) al abrir el parte.
    await notify({
      topic: TOPIC,
      title: "Cosas de manitas",
      body: `${NAMES[me]} apunta: ${data.title}`,
      priority: data.priority === "alta" ? "urgent" : "high",
      tags: ["hammer_and_wrench"],
    });
  }

  if (items.status === "loading") return <p className="in-empty">Cargando…</p>;
  if (items.status === "error") return <p className="in-empty">{items.error}</p>;

  return (
    <div className="in">
      <button type="button" className="in-new" onClick={() => setComposing(true)}>
        + Algo que arreglar…
      </button>

      {open.length > 0 && (
        <div className="in-summary">
          <div>
            <b>{open.length}</b>
            <span>pendientes</span>
          </div>
          <div>
            <b>{open.filter((i) => i.priority === "alta").length}</b>
            <span>urgentes</span>
          </div>
          <div>
            <b>{open.filter((i) => i.dueDays > 0 && deadline(i) < Date.now()).length}</b>
            <span>fuera de plazo</span>
          </div>
        </div>
      )}

      {open.length === 0 && closed.length === 0 ? (
        <p className="in-empty">Nada roto por ahora. Toca madera.</p>
      ) : (
        <ul className="in-list">
          {open.map((i) => (
            <IncidentCard
              key={i.id}
              item={i}
              onDone={() => items.update(i.id, { done: true, doneAt: Date.now() })}
              onRemove={() => setPending(i)}
            />
          ))}
          {closed.map((i) => (
            <IncidentCard key={i.id} item={i} onRemove={() => setPending(i)} />
          ))}
        </ul>
      )}

      <p className="in-hint">Al abrir un parte le llega el aviso al otro.</p>

      {composing && <IncidentForm onClose={() => setComposing(false)} onSave={create} />}

      {pending && (
        <ConfirmDialog
          title="¿Borrar este parte?"
          body={`Se borrará «${pending.title}».`}
          confirmLabel="Borrar"
          onConfirm={() => {
            items.remove(pending.id);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- tarjeta */

function IncidentCard({
  item,
  onDone,
  onRemove,
}: {
  item: Incident;
  onDone?: () => void;
  onRemove: () => void;
}) {
  // Un tic por minuto mantiene vivo el plazo sin gastar en refrescos.
  const [, tick] = useState(0);
  useEffect(() => {
    if (item.done || item.dueDays === 0) return;
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [item.done, item.dueDays]);

  return (
    <li>
      <article className={`in-card${item.done ? " in-card--done" : ""}`}>
        <div className={`in-card__strip in-card__strip--${item.priority}`}>
          🔧 {PRIORITY_LABEL[item.priority]}
        </div>

        <div className="in-card__body">
          <h3 className="in-card__title">{item.title}</h3>
          {item.description && <p className="in-card__desc">{item.description}</p>}

          <div className="in-card__foot">
            <span className="in-who">
              <span className="in-who__dot" style={{ background: WHO_COLOR[item.assignee] }} />
              {WHO_LABEL[item.assignee]}
            </span>

            {item.done ? (
              <span className="in-due">Hecho</span>
            ) : (
              <>
                <DueLabel item={item} />
                {onDone && (
                  <button type="button" className="in-done-btn" onClick={onDone}>
                    Arreglado
                  </button>
                )}
              </>
            )}
          </div>

          {item.done && <span className="in-stamp">Arreglado</span>}
        </div>

        <RemoveBadge danger label={`Borrar ${item.title}`} onRemove={onRemove} />
      </article>
    </li>
  );
}

function DueLabel({ item }: { item: Incident }) {
  if (item.dueDays === 0) return <span className="in-due">Sin plazo</span>;

  const left = deadline(item) - Date.now();
  if (left <= 0) return <span className="in-due in-due--over">Fuera de plazo</span>;

  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor(left / 3_600_000);
  const soon = left < 24 * 3_600_000;
  const text = days >= 1 ? `${days} d` : `${Math.max(hours, 1)} h`;
  return <span className={`in-due${soon ? " in-due--soon" : ""}`}>Quedan {text}</span>;
}

/* ------------------------------------------------------------------ formulario */

function IncidentForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    priority: Priority;
    assignee: Who;
    dueDays: number;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("media");
  const [assignee, setAssignee] = useState<Who>("both");
  /** null = usar el plazo por defecto de la prioridad. */
  const [dueDays, setDueDays] = useState<number | null>(null);

  const effectiveDays = dueDays ?? DEFAULT_DAYS[priority];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      priority,
      assignee,
      dueDays: effectiveDays,
    });
  }

  return (
    <div className="nk-sheet" onPointerDown={onClose}>
      <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
        <header className="nk-sheet__head">
          <h2>Algo que arreglar</h2>
          <button type="button" className="nk-sheet__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <form className="in-form" onSubmit={submit}>
          <label>
            <span>Qué pasa</span>
            <input
              autoFocus
              value={title}
              placeholder="La pata de la silla del salón"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label>
            <span>Detalles</span>
            <textarea
              rows={3}
              value={description}
              placeholder="Se mueve, hay que pegarla o poner un tornillo."
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div>
            <span className="in-form__legend">Prioridad</span>
            <div className="in-chips" style={{ marginTop: 4 }}>
              {(["baja", "media", "alta"] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`in-chip in-chip--${p}`}
                  aria-pressed={priority === p}
                  onClick={() => setPriority(p)}
                >
                  {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="in-form__legend">Le toca a</span>
            <div className="in-chips" style={{ marginTop: 4 }}>
              {(["irene", "vicente", "both"] as Who[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`in-chip in-chip--${w}`}
                  aria-pressed={assignee === w}
                  onClick={() => setAssignee(w)}
                >
                  {WHO_LABEL[w]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="in-form__legend">Plazo</span>
            <div className="in-chips" style={{ marginTop: 4 }}>
              {[0, 1, 3, 7, 14].map((d) => (
                <button
                  key={d}
                  type="button"
                  className="in-chip"
                  aria-pressed={effectiveDays === d}
                  onClick={() => setDueDays(d)}
                >
                  {d === 0 ? "Sin plazo" : d === 1 ? "1 día" : `${d} días`}
                </button>
              ))}
            </div>
          </div>

          <div className="in-form__actions">
            <button type="button" className="nk-btn nk-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="nk-btn">
              Abrir parte
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Momento (epoch ms) en que vence el plazo. Muy grande si no hay plazo. */
function deadline(item: Incident): number {
  if (item.dueDays === 0) return Number.MAX_SAFE_INTEGER;
  return item.createdAt + item.dueDays * 86_400_000;
}
