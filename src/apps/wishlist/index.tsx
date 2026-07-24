import { useState } from "react";
import { useCurrentUser, type PersonId } from "../../shared/lib/use-current-user";
import { useRemoteCollection, type Entity } from "../../shared/lib/use-remote-collection";
import { ConfirmDialog, RemoveBadge } from "../../shared/ui/ConfirmDialog";
import "./wishlist.css";

type Kind = "peli" | "serie";
type Who = "irene" | "vicente" | "both";

interface WatchItem extends Entity {
  title: string;
  kind: Kind;
  who: Who;
  note: string;
  seen: boolean;
  seenAt: number;
  position: number;
}

const KIND_EMOJI: Record<Kind, string> = { peli: "🎬", serie: "📺" };
const KIND_LABEL: Record<Kind, string> = { peli: "Peli", serie: "Serie" };
const WHO_LABEL: Record<Who, string> = { irene: "Irene", vicente: "Vicente", both: "Los dos" };
const WHO_COLOR: Record<Who, string> = { irene: "#e86a92", vicente: "#5aa9e6", both: "var(--nk-leaf)" };

type Filter = "all" | Kind;

export default function WishlistApp() {
  const items = useRemoteCollection<WatchItem>("/api/wishlist");
  const me = useCurrentUser();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<WatchItem | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const shown = items.items.filter((i) => filter === "all" || i.kind === filter);
  const toWatch = shown.filter((i) => !i.seen).sort((a, b) => b.createdAt - a.createdAt);
  const seen = shown.filter((i) => i.seen).sort((a, b) => b.seenAt - a.seenAt);

  if (items.status === "loading") return <p className="wl-empty">Cargando…</p>;
  if (items.status === "error") return <p className="wl-empty">{items.error}</p>;

  return (
    <div className="wl">
      <button type="button" className="wl-new" onClick={() => setAdding(true)}>
        + Añadir peli o serie
      </button>

      <div className="wl-filters">
        {(["all", "peli", "serie"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className="wl-chip"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Todo" : f === "peli" ? "Pelis" : "Series"}
          </button>
        ))}
      </div>

      {items.items.length === 0 ? (
        <p className="wl-empty">Vuestra lista está vacía. Apunta algo que queráis ver.</p>
      ) : (
        <>
          <section>
            <h2 className="wl-head">Por ver · {toWatch.length}</h2>
            {toWatch.length === 0 ? (
              <p className="wl-empty">Nada pendiente aquí.</p>
            ) : (
              <ul className="wl-list">
                {toWatch.map((i) => (
                  <Card
                    key={i.id}
                    item={i}
                    onToggle={() => items.update(i.id, { seen: true, seenAt: Date.now() })}
                    onRemove={() => setPending(i)}
                  />
                ))}
              </ul>
            )}
          </section>

          {seen.length > 0 && (
            <section>
              <h2 className="wl-head wl-head--seen">Vistas · {seen.length}</h2>
              <ul className="wl-list">
                {seen.map((i) => (
                  <Card
                    key={i.id}
                    item={i}
                    onToggle={() => items.update(i.id, { seen: false, seenAt: 0 })}
                    onRemove={() => setPending(i)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {adding && (
        <AddForm
          me={me}
          onClose={() => setAdding(false)}
          onSave={(data) => {
            setAdding(false);
            items.create({ ...data, seen: false, seenAt: 0, position: items.items.length });
          }}
        />
      )}

      {pending && (
        <ConfirmDialog
          title="¿Borrar de la lista?"
          body={`Se borra «${pending.title}».`}
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

function Card({
  item,
  onToggle,
  onRemove,
}: {
  item: WatchItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <li className={`wl-item${item.seen ? " wl-item--seen" : ""}`}>
      <button
        type="button"
        className="wl-check"
        aria-pressed={item.seen}
        aria-label={item.seen ? "Marcar por ver" : "Marcar vista"}
        onClick={onToggle}
      >
        ✓
      </button>

      <span className="wl-emoji">{KIND_EMOJI[item.kind]}</span>

      <div className="wl-body">
        <strong className="wl-title">{item.title}</strong>
        <div className="wl-meta">
          <span>{KIND_LABEL[item.kind]}</span>
          <span className="wl-who">
            <span className="wl-who__dot" style={{ background: WHO_COLOR[item.who] }} />
            {WHO_LABEL[item.who]}
          </span>
        </div>
        {item.note && <p className="wl-note">{item.note}</p>}
      </div>

      <RemoveBadge danger label={`Borrar ${item.title}`} onRemove={onRemove} />
    </li>
  );
}

function AddForm({
  me,
  onClose,
  onSave,
}: {
  me: PersonId;
  onClose: () => void;
  onSave: (data: { title: string; kind: Kind; who: Who; note: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>("peli");
  const [who, setWho] = useState<Who>("both");
  const [note, setNote] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), kind, who, note: note.trim() });
  }

  return (
    <div className="nk-sheet" onPointerDown={onClose}>
      <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
        <header className="nk-sheet__head">
          <h2>Añadir a la lista</h2>
          <button type="button" className="nk-sheet__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <form className="wl-form" onSubmit={submit}>
          <label>
            <span className="wl-legend">Título</span>
            <input
              autoFocus
              value={title}
              placeholder="El nombre de la peli o serie"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <div>
            <span className="wl-legend">¿Qué es?</span>
            <div className="wl-chips">
              {(["peli", "serie"] as Kind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  className="wl-chip"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                >
                  {KIND_EMOJI[k]} {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="wl-legend">¿De quién es la idea?</span>
            <div className="wl-chips">
              {(["irene", "vicente", "both"] as Who[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`wl-chip wl-chip--${w}`}
                  aria-pressed={who === w}
                  onClick={() => setWho(w)}
                >
                  {WHO_LABEL[w]}
                </button>
              ))}
            </div>
          </div>

          <label>
            <span className="wl-legend">Nota (opcional)</span>
            <textarea
              rows={2}
              value={note}
              placeholder="Dónde está, quién la recomendó…"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          <div className="wl-form__actions">
            <button type="button" className="nk-btn nk-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="nk-btn">
              Añadir
            </button>
          </div>
          <p className="wl-hint">Lo apunta {me === "irene" ? "Irene" : "Vicente"}, pero la lista es de los dos.</p>
        </form>
      </div>
    </div>
  );
}
