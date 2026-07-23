import { useState } from "react";
import { useDebouncedSave } from "../../shared/lib/use-debounced-save";
import { useRemoteCollection, type Entity } from "../../shared/lib/use-remote-collection";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import "./tasks.css";

type Owner = "shared" | "irene" | "vicente";

interface Task extends Entity {
  text: string;
  done: boolean;
  owner: Owner;
  /** Sitio en la lista. */
  position: number;
}

const TABS: { id: Owner; label: string }[] = [
  { id: "shared", label: "Compartidas" },
  { id: "irene", label: "Irene" },
  { id: "vicente", label: "Vicente" },
];

export default function TasksApp() {
  const tasks = useRemoteCollection<Task>("/api/tasks");
  const [tab, setTab] = useState<Owner>("shared");
  const [draft, setDraft] = useState("");
  const [clearing, setClearing] = useState(false);

  const mine = tasks.items
    .filter((t) => t.owner === tab)
    .sort((a, b) => a.position - b.position);

  // Los hechos caen al fondo, como en la app de la compra de Mercadona: no
  // desaparecen, se apartan.
  const pending = mine.filter((t) => !t.done);
  const done = mine.filter((t) => t.done);

  async function add() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await tasks.create({ text, done: false, owner: tab, position: tasks.items.length });
  }

  if (tasks.status === "loading") {
    return <p className="tk-empty">Cargando…</p>;
  }

  if (tasks.status === "error") {
    return <p className="tk-empty">{tasks.error ?? "No se pudo cargar la lista."}</p>;
  }

  return (
    <div className="tk">
      <div className="tk-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="tk-tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="tk-add">
        <input
          value={draft}
          placeholder="Añadir a la lista…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button type="button" className="nk-btn" onClick={add}>
          Añadir
        </button>
      </div>

      {mine.length === 0 ? (
        <p className="tk-empty">Nada pendiente aquí.</p>
      ) : (
        <ul className="tk-list">
          {pending.map((t) => (
            <TaskRow key={t.id} task={t} tasks={tasks} />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <>
          <div className="tk-done-head">
            <span>Hechas · {done.length}</span>
            <button type="button" className="tk-clear" onClick={() => setClearing(true)}>
              Vaciar hechas
            </button>
          </div>
          <ul className="tk-list">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} tasks={tasks} />
            ))}
          </ul>
        </>
      )}

      {clearing && (
        <ConfirmDialog
          title="¿Vaciar las hechas?"
          body={`Se borrarán las ${done.length} tareas ya marcadas de esta lista. Las pendientes se quedan.`}
          confirmLabel="Vaciar"
          onConfirm={() => {
            done.forEach((t) => tasks.remove(t.id));
            setClearing(false);
          }}
          onCancel={() => setClearing(false)}
        />
      )}
    </div>
  );
}

function TaskRow({
  task,
  tasks,
}: {
  task: Task;
  tasks: ReturnType<typeof useRemoteCollection<Task>>;
}) {
  // El texto se escribe en local y se guarda al parar, para no mandar un PATCH
  // por cada tecla.
  const [text, setText] = useState(task.text);
  const { push } = useDebouncedSave<string>((value) => tasks.update(task.id, { text: value }));

  function edit(value: string) {
    setText(value);
    push(value);
  }

  return (
    <li className={`tk-item${task.done ? " tk-item--done" : ""}`}>
      <button
        type="button"
        className="tk-check"
        aria-pressed={task.done}
        aria-label={task.done ? "Marcar como pendiente" : "Marcar como hecha"}
        onClick={() => tasks.update(task.id, { done: !task.done })}
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

      <input
        className="tk-text"
        value={text}
        onChange={(e) => edit(e.target.value)}
        placeholder="Sin texto"
      />

      <button
        type="button"
        className="tk-x"
        onClick={() => tasks.remove(task.id)}
        aria-label="Borrar tarea"
      >
        ×
      </button>
    </li>
  );
}
