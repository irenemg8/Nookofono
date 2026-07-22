import { useState } from "react";
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useCollection, type Entity } from "../../shared/lib/use-collection";
import { useLongPress } from "../../shared/lib/use-long-press";
import { ConfirmDialog, RemoveBadge } from "../../shared/ui/ConfirmDialog";
import "./notes.css";

/** Igual que en la pantalla de inicio, para que el gesto se sienta el mismo. */
const LONG_PRESS_MS = 3000;

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
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<Note | null>(null);

  const open = notes.items.find((n) => n.id === openId) ?? null;
  const visible = notes.items.filter((n) => n.owner === tab);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 80, tolerance: 8 } }),
  );

  function add() {
    const note = notes.create({
      title: "",
      body: "",
      owner: tab,
      paper: PAPERS[notes.items.length % PAPERS.length],
    });
    setOpenId(note.id);
  }

  /**
   * Se reordena sobre la lista completa, no sobre la visible: las notas de las
   * otras pestañas tienen que conservar su sitio.
   */
  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;

    const all = [...notes.items];
    const from = all.findIndex((n) => n.id === active.id);
    const to = all.findIndex((n) => n.id === over.id);
    if (from === -1 || to === -1) return;

    all.splice(to, 0, all.splice(from, 1)[0]);
    notes.persist(all);
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
        </div>
      </div>
    );
  }

  const list =
    visible.length === 0 ? (
      <p className="nt-empty">Aquí no hay nada todavía.</p>
    ) : (
      <ul className="nt-list">
        {visible.map((note) =>
          editing ? (
            <SortableNote key={note.id} note={note} onRemove={() => setPending(note)} />
          ) : (
            <NoteCard
              key={note.id}
              note={note}
              onOpen={() => setOpenId(note.id)}
              onLongPress={() => setEditing(true)}
            />
          ),
        )}
      </ul>
    );

  return (
    <div
      className="nt"
      // Tocar fuera de una nota sale del modo edición.
      onPointerDown={(e) => {
        if (editing && !(e.target as HTMLElement).closest(".nt-paper, .nk-remove")) {
          setEditing(false);
        }
      }}
    >
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

      {!editing && (
        <button type="button" className="nk-btn" onClick={add}>
          + Nota nueva
        </button>
      )}

      {editing ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={visible.map((n) => n.id)}
            strategy={verticalListSortingStrategy}
          >
            {list}
          </SortableContext>
        </DndContext>
      ) : (
        list
      )}

      {pending && (
        <ConfirmDialog
          title="¿Borrar esta nota?"
          body={`Se borrará «${pending.title || "Sin título"}» y no se podrá recuperar.`}
          confirmLabel="Borrar"
          onConfirm={() => {
            notes.remove(pending.id);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ tarjetas */

function NoteBody({ note }: { note: Note }) {
  return (
    <>
      <h3 className="nt-paper__title">{note.title || "Sin título"}</h3>
      {note.body && <p className="nt-paper__excerpt">{note.body}</p>}
      <div className="nt-paper__meta">
        <span>{TABS.find((t) => t.id === note.owner)?.label}</span>
        <span>{new Date(note.updatedAt).toLocaleDateString("es-ES")}</span>
      </div>
    </>
  );
}

function NoteCard({
  note,
  onOpen,
  onLongPress,
}: {
  note: Note;
  onOpen: () => void;
  onLongPress: () => void;
}) {
  const { handlers, firedRef } = useLongPress(onLongPress, LONG_PRESS_MS);

  return (
    <li>
      <button
        type="button"
        className="nt-paper"
        style={{ ["--nt-paper" as string]: note.paper }}
        {...handlers}
        onClick={() => !firedRef.current && onOpen()}
      >
        <NoteBody note={note} />
      </button>
    </li>
  );
}

function SortableNote({ note, onRemove }: { note: Note; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  });

  return (
    <li className="nt-slot">
      <div
        ref={setNodeRef}
        className={`nt-paper nt-sortable nt-sortable--wiggle${isDragging ? " nt-sortable--dragging" : ""}`}
        style={{
          ["--nt-paper" as string]: note.paper,
          transform: CSS.Transform.toString(transform),
          transition,
        }}
        {...attributes}
        {...listeners}
      >
        <NoteBody note={note} />
      </div>

      <RemoveBadge danger label={`Borrar ${note.title || "nota"}`} onRemove={onRemove} />
    </li>
  );
}
