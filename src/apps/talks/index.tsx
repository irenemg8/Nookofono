import { useEffect, useState } from "react";
import { notify } from "../../shared/lib/ntfy";
import { useCurrentUser, type PersonId } from "../../shared/lib/use-current-user";
import { useRemoteCollection, type Entity } from "../../shared/lib/use-remote-collection";
import { ConfirmDialog, RemoveBadge } from "../../shared/ui/ConfirmDialog";
import "./talks.css";

/** El canal de avisos de esta app. Ver docs/PLAN.md sobre ntfy. */
const TOPIC = "ipug-porhablar-3d7a1f9c6b2e";

/** Plazo para hablarlo, en milisegundos: 48 horas. */
const WINDOW_MS = 48 * 60 * 60 * 1000;

type Who = "irene" | "vicente" | "both";

interface Talk extends Entity {
  title: string;
  description: string;
  raisedBy: Who;
  done: boolean;
  /** Cuándo se marcó hablado, epoch ms; 0 si sigue abierto. */
  talkedAt: number;
}

const NAMES: Record<PersonId, string> = { irene: "Irene", vicente: "Vicente" };
const WHO_LABEL: Record<Who, string> = { irene: "Irene", vicente: "Vicente", both: "Los dos" };
const WHO_COLOR: Record<Who, string> = {
  irene: "#e86a92",
  vicente: "#5aa9e6",
  both: "var(--nk-leaf)",
};

export default function TalksApp() {
  const talks = useRemoteCollection<Talk>("/api/talks");
  const me = useCurrentUser();
  const [composing, setComposing] = useState(false);
  const [pending, setPending] = useState<Talk | null>(null);

  const open = talks.items.filter((t) => !t.done).sort((a, b) => a.createdAt - b.createdAt);
  const closed = talks.items.filter((t) => t.done).sort((a, b) => b.talkedAt - a.talkedAt);

  async function create(data: { title: string; description: string; raisedBy: Who }) {
    setComposing(false);
    await talks.create({ ...data, done: false, talkedAt: 0 });

    // Aviso al móvil del otro en cuanto se publica el tema.
    await notify({
      topic: TOPIC,
      title: "Tenemos algo de qué hablar",
      body: `${NAMES[me]} ha abierto: ${data.title}`,
      priority: "high",
      tags: ["speech_balloon"],
    });
  }

  if (talks.status === "loading") return <p className="tl-empty">Cargando…</p>;
  if (talks.status === "error") return <p className="tl-empty">{talks.error}</p>;

  return (
    <div className="tl">
      <button type="button" className="tl-new" onClick={() => setComposing(true)}>
        + Tenemos que hablar de…
      </button>
{/*
      {open.length > 0 && (
        <div className="tl-summary">
          <div>
            <b>{open.length}</b>
            <span>sin hablar</span>
          </div>
          <div>
            <b>{open.filter((t) => remaining(t) <= 0).length}</b>
            <span>fuera de plazo</span>
          </div>
        </div>
      )}*/}

      {open.length === 0 && closed.length === 0 ? (
        <p className="tl-empty">No hay nada pendiente de hablar. Bien ahí.</p>
      ) : (
        <ul className="tl-list">
          {open.map((t) => (
            <TalkCard
              key={t.id}
              talk={t}
              onDone={() => talks.update(t.id, { done: true, talkedAt: Date.now() })}
              onRemove={() => setPending(t)}
            />
          ))}
          {closed.map((t) => (
            <TalkCard key={t.id} talk={t} onRemove={() => setPending(t)} />
          ))}
        </ul>
      )}

      <p className="tl-hint">
        Al abrir un tema le llega el aviso al otro. Cada tema tiene 48 h para hablarse.
      </p>

      {composing && <TalkForm me={me} onClose={() => setComposing(false)} onSave={create} />}

      {pending && (
        <ConfirmDialog
          title="¿Borrar este tema?"
          body={`Se borrará «${pending.title}».`}
          confirmLabel="Borrar"
          onConfirm={() => {
            talks.remove(pending.id);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- tarjeta */

function TalkCard({
  talk,
  onDone,
  onRemove,
}: {
  talk: Talk;
  onDone?: () => void;
  onRemove: () => void;
}) {
  // Un tic cada minuto mantiene la cuenta atrás viva sin gastar en refrescos.
  const [, tick] = useState(0);
  useEffect(() => {
    if (talk.done) return;
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [talk.done]);

  const left = remaining(talk);
  const expired = !talk.done && left <= 0;
  const soon = !talk.done && left > 0 && left < 6 * 60 * 60 * 1000;

  return (
    <li>
      <article
        className={`tl-card${talk.done ? " tl-card--done" : ""}${soon ? " tl-card--soon" : ""}`}
      >
        <div className="tl-card__main">
          <span className="tl-card__tag">
            <span className="tl-card__from" style={{ background: WHO_COLOR[talk.raisedBy] }} />
            Lo saca {WHO_LABEL[talk.raisedBy].toLowerCase()}
          </span>

          <h3 className="tl-card__title">{talk.title}</h3>
          {talk.description && <p className="tl-card__desc">{talk.description}</p>}

          <div className="tl-card__foot">
            {talk.done
              ? `Hablado el ${shortDateTime(talk.talkedAt)}`
              : `Abierto el ${shortDateTime(talk.createdAt)}`}
          </div>

          {talk.done && <span className="tl-stamp tl-stamp--done">Hablado</span>}
          {expired && <span className="tl-stamp tl-stamp--expired">Fuera de plazo</span>}
        </div>

        <div className="tl-card__stub">
          {talk.done ? (
            <div className="tl-clock">
              <div className="tl-clock__n">✓</div>
              <div className="tl-clock__u">listo</div>
            </div>
          ) : (
            <>
              <div className="tl-clock">
                <div className="tl-clock__n">{expired ? "0" : countdown(left).n}</div>
                <div className="tl-clock__u">{expired ? "sin plazo" : countdown(left).u}</div>
              </div>
              {onDone && (
                <button
                  type="button"
                  className="tl-check"
                  onClick={onDone}
                  aria-label="Marcar como hablado"
                >
                  ✓
                </button>
              )}
            </>
          )}
        </div>

        <RemoveBadge danger label={`Borrar ${talk.title}`} onRemove={onRemove} />
      </article>
    </li>
  );
}

/* ------------------------------------------------------------------ formulario */

function TalkForm({
  me,
  onClose,
  onSave,
}: {
  me: PersonId;
  onClose: () => void;
  onSave: (data: { title: string; description: string; raisedBy: Who }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [raisedBy, setRaisedBy] = useState<Who>(me);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), description: description.trim(), raisedBy });
  }

  return (
    <div className="nk-sheet" onPointerDown={onClose}>
      <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
        <header className="nk-sheet__head">
          <h2>Tenemos que hablar de…</h2>
          <button type="button" className="nk-sheet__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <form className="tl-form" onSubmit={submit}>
          <label>
            <span>Tema</span>
            <input
              autoFocus
              value={title}
              placeholder="Lo de las vacaciones"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label>
            <span>Qué quieres decir</span>
            <textarea
              rows={4}
              value={description}
              placeholder="Sin rodeos: lo que te ronda."
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div>
            <span className="tl-form__legend" style={{ fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--nk-text-muted)" }}>
              Lo saca
            </span>
            <div className="tl-chips" style={{ marginTop: 4 }}>
              {(["irene", "vicente", "both"] as Who[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`tl-chip tl-chip--${w}`}
                  aria-pressed={raisedBy === w}
                  onClick={() => setRaisedBy(w)}
                >
                  {WHO_LABEL[w]}
                </button>
              ))}
            </div>
          </div>

          <div className="tl-form__actions">
            <button type="button" className="nk-btn nk-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="nk-btn">
              Abrir tema
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- utils */

/** Milisegundos que quedan del plazo de 48 h. Negativo si ya pasó. */
function remaining(talk: Talk): number {
  return talk.createdAt + WINDOW_MS - Date.now();
}

/** El número grande del plazo: horas si queda más de una, si no minutos. */
function countdown(ms: number): { n: string; u: string } {
  const mins = Math.floor(ms / 60_000);
  if (mins >= 60) return { n: String(Math.floor(mins / 60)), u: mins < 120 ? "hora" : "horas" };
  return { n: String(Math.max(mins, 1)), u: "min" };
}

function shortDateTime(ms: number): string {
  return new Date(ms).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
