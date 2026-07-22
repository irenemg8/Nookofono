import { useState } from "react";
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useDebouncedSave } from "../../shared/lib/use-debounced-save";
import { useRemoteCollection, type Entity } from "../../shared/lib/use-remote-collection";
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
  /** Sitio en la lista. Es lo que guarda el arrastre. */
  position: number;
  pinned: boolean;
}

/** Papeles de carta, del más frío al más cálido. */
const PAPERS = ["#cfeae4", "#f3e0c8", "#e6dcf0", "#fbdcdc", "#d9e8c4"];

const TABS: { id: Owner; label: string }[] = [
  { id: "shared", label: "Compartidas" },
  { id: "irene", label: "Irene" },
  { id: "vicente", label: "Vicente" },
];

export default function NotesApp() {
  const notes = useRemoteCollection<Note>("/api/notes");
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

  async function add() {
    const note = await notes.create({
      title: "",
      body: "",
      owner: tab,
      paper: PAPERS[notes.items.length % PAPERS.length],
      position: notes.items.length,
      pinned: false,
    });
    // Si el servidor no contesta no hay nota que abrir; el hook ya enseña el
    // aviso de que no se pudo guardar.
    if (note) setOpenId(note.id);
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
    void notes.reorder(all);
  }

  if (open) {
    return (
      <NoteEditor
        note={open}
        onChange={(patch) => notes.update(open.id, patch)}
        onClose={() => setOpenId(null)}
      />
    );
  }

  const list =
    visible.length === 0 ? (
      <p className="nt-empty">Aquí no hay nada todavía.</p>
    ) : (
      <ul className="nt-list">
        {visible.map((note, i) =>
          editing ? (
            <SortableNote key={note.id} note={note} index={i} onRemove={() => setPending(note)} />
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

/* -------------------------------------------------------------------- editor */

/**
 * La nota abierta.
 *
 * El texto se lleva en estado propio y sólo sube al servidor cuando se deja de
 * escribir: mandar un `PATCH` por tecla sería una petición por letra, y además
 * las respuestas podrían llegar desordenadas y devolver texto viejo al campo.
 *
 * El dueño y el cierre sí guardan al momento: son un clic, no una ráfaga.
 */
function NoteEditor({
  note,
  onChange,
  onClose,
}: {
  note: Note;
  onChange: (patch: Partial<Note>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState({ title: note.title, body: note.body });
  const { push, flush } = useDebouncedSave<Partial<Note>>(onChange);

  function edit(patch: Partial<typeof draft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    push(patch);
  }

  return (
    <div className="nt-editor">
      <div className="nt-editor__head">
        <input
          className="nt-editor__title"
          value={draft.title}
          placeholder="Título"
          onChange={(e) => edit({ title: e.target.value })}
        />
        <button
          type="button"
          className="nk-btn nk-btn--sm"
          onClick={() => {
            // Sin esto, cerrar justo después de teclear perdería lo último.
            flush();
            onClose();
          }}
        >
          Guardar
        </button>
      </div>

      <textarea
        className="nt-sheet"
        value={draft.body}
        placeholder="Escribe aquí…"
        onChange={(e) => edit({ body: e.target.value })}
        style={{ backgroundColor: note.paper }}
      />

      <div className="nt-editor__foot">
        <div className="nt-owner">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={note.owner === t.id}
              onClick={() => onChange({ owner: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
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

function SortableNote({
  note,
  index,
  onRemove,
}: {
  note: Note;
  index: number;
  onRemove: () => void;
}) {
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
          // Cada nota va por su lado: si comparten ritmo, el conjunto parece
          // una sola pieza vibrando en vez de varios papeles sueltos.
          animationDelay: `${(index % 5) * -0.09}s`,
          animationDuration: `${0.34 + (index % 4) * 0.05}s`,
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
