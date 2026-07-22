import { useState } from "react";
import { useCollection, type Entity } from "../../shared/lib/use-collection";
import "./notes.css";

type Owner = "shared" | "irene" | "vicente";

interface Note extends Entity {
  title: string;
  body: string;
  owner: Owner;
  paper: string;
}

/** Papeles de carta, del más frío al más cálido. */
const PAPERS = ["#cfeae4", "#f3e0c8", "#e6dcf0", "#fbdcdc", "#d9e8c4"];

const TABS: { id: Owner; label: string }[] = [
  { id: "shared", label: "Compartidas" },
  { id: "irene", label: "Irene" },
  { id: "vicente", label: "Vicente" },
];

export default function NotesApp() {
  const notes = useCollection<Note>("ipug.notes");
  const [tab, setTab] = useState<Owner>("shared");
  const [openId, setOpenId] = useState<string | null>(null);

  const open = notes.items.find((n) => n.id === openId) ?? null;
  const visible = notes.items.filter((n) => n.owner === tab);

  function add() {
    const note = notes.create({
      title: "",
      body: "",
      owner: tab,
      paper: PAPERS[notes.items.length % PAPERS.length],
    });
    setOpenId(note.id);
  }

  if (open) {
    return (
      <div className="nt-editor">
        <div className="nt-editor__head">
          <input
            className="nt-editor__title"
            value={open.title}
            placeholder="Título"
            onChange={(e) => notes.update(open.id, { title: e.target.value })}
          />
          <button type="button" className="nk-btn nk-btn--sm" onClick={() => setOpenId(null)}>
            Guardar
          </button>
        </div>

        <textarea
          className="nt-sheet"
          value={open.body}
          placeholder="Escribe aquí…"
          onChange={(e) => notes.update(open.id, { body: e.target.value })}
          style={{ backgroundColor: open.paper }}
        />

        <div className="nt-editor__foot">
          <div className="nt-owner">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={open.owner === t.id}
                onClick={() => notes.update(open.id, { owner: t.id })}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="nk-btn nk-btn--danger nk-btn--sm"
            onClick={() => {
              notes.remove(open.id);
              setOpenId(null);
            }}
          >
            Borrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="nt">
      <div className="nt-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="nt-tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <button type="button" className="nk-btn" onClick={add}>
        + Nota nueva
      </button>

      {visible.length === 0 ? (
        <p className="nt-empty">Aquí no hay nada todavía.</p>
      ) : (
        <ul className="nt-list">
          {visible.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                className="nt-paper"
                style={{ ["--nt-paper" as string]: note.paper }}
                onClick={() => setOpenId(note.id)}
              >
                <h3 className="nt-paper__title">{note.title || "Sin título"}</h3>
                {note.body && <p className="nt-paper__excerpt">{note.body}</p>}
                <div className="nt-paper__meta">
                  <span>{TABS.find((t) => t.id === note.owner)?.label}</span>
                  <span>{new Date(note.updatedAt).toLocaleDateString("es-ES")}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
