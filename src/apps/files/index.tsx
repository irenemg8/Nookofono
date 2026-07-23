import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import { deleteBlob, download, getBlob, putBlob } from "../../shared/lib/filestore";
import { useCurrentUser, type PersonId } from "../../shared/lib/use-current-user";
import { useRemoteCollection } from "../../shared/lib/use-remote-collection";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { importFile } from "../sheets/model/xlsx";
import { emptySheet, type Sheet } from "../sheets/model/grid";
import { SheetEditor } from "../sheets/ui/SheetEditor";
import { exportSheetBlob } from "./model/save-sheet";
import { humanSize, isSheet, kindOf, type FileItem, type Folder } from "./model/types";
import { FileGlyph, FolderGlyph } from "./ui/glyphs";
import "./files.css";

const NAMES: Record<PersonId, string> = { irene: "Irene", vicente: "Vicente" };

export default function FilesApp() {
  const me = useCurrentUser();
  const folders = useRemoteCollection<Folder>("/api/folders");
  const files = useRemoteCollection<FileItem>("/api/files");

  const [cwd, setCwd] = useState(""); // carpeta actual, "" = raíz
  const [tag, setTag] = useState<string | null>(null);
  const [menuItem, setMenuItem] = useState<{ kind: "folder" | "file"; id: string } | null>(null);
  const [editingSheet, setEditingSheet] = useState<{ file: FileItem; sheet: Sheet } | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const subfolders = folders.items.filter((f) => f.parentId === cwd);
  const here = files.items.filter((f) => f.folderId === cwd);
  const shown = tag ? here.filter((f) => f.tags.includes(tag)) : here;

  // Todas las etiquetas que existen, para el filtro y para sugerir.
  const allTags = useMemo(
    () => [...new Set(files.items.flatMap((f) => f.tags))].sort((a, b) => a.localeCompare(b)),
    [files.items],
  );

  /** Ruta de migas desde la raíz hasta la carpeta actual. */
  const trail = useMemo(() => {
    const path: Folder[] = [];
    let id = cwd;
    const byId = new Map(folders.items.map((f) => [f.id, f]));
    while (id) {
      const f = byId.get(id);
      if (!f) break;
      path.unshift(f);
      id = f.parentId;
    }
    return path;
  }, [cwd, folders.items]);

  async function newFolder() {
    const name = prompt("Nombre de la carpeta")?.trim();
    if (!name) return;
    await folders.create({ name, parentId: cwd, createdBy: me });
  }

  async function upload(list: FileList | null) {
    if (!list) return;
    for (const file of Array.from(list)) {
      const item = await files.create({
        name: file.name,
        folderId: cwd,
        mime: file.type,
        size: file.size,
        tags: [],
        uploadedBy: me,
      });
      if (item) await putBlob(item.id, file).catch(() => {});
    }
  }

  async function openFile(file: FileItem) {
    // Un Excel se abre en el editor; el resto se descargan (o se previsualizan
    // en el futuro). Editar y guardar sólo tiene sentido con hojas.
    if (isSheet(file)) {
      const blob = await getBlob(file.id);
      const sheet = blob
        ? await importFile(new File([blob], file.name, { type: file.mime })).catch(() => emptySheet(file.name))
        : emptySheet(file.name);
      setEditingSheet({ file, sheet });
      return;
    }
    const blob = await getBlob(file.id);
    if (blob) download(blob, file.name);
  }

  async function saveSheet(sheet: Sheet) {
    if (!editingSheet) return;
    const blob = await exportSheetBlob(sheet);
    await putBlob(editingSheet.file.id, blob);
    await files.update(editingSheet.file.id, { size: blob.size, name: ensureXlsx(sheet.name) });
  }

  /** Mover: soltar un elemento sobre una carpeta o una miga lo mete dentro. */
  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const [aKind, aId] = String(active.id).split(":");
    const target = String(over.id); // "folder:<id>", "crumb:<id>" o "crumb:root"

    let dest: string;
    if (target.startsWith("folder:")) dest = target.slice(7);
    else if (target === "crumb:root") dest = "";
    else if (target.startsWith("crumb:")) dest = target.slice(6);
    else return;

    if (aKind === "folder") {
      if (aId === dest) return; // a sí misma
      if (isDescendant(dest, aId)) return; // dentro de su propia descendencia
      folders.update(aId, { parentId: dest });
    } else {
      files.update(aId, { folderId: dest });
    }
  }

  /** ¿`maybe` está dentro de `ancestor` (o es él)? Evita bucles al mover. */
  function isDescendant(maybe: string, ancestor: string): boolean {
    let id = maybe;
    const byId = new Map(folders.items.map((f) => [f.id, f]));
    while (id) {
      if (id === ancestor) return true;
      id = byId.get(id)?.parentId ?? "";
    }
    return false;
  }

  if (editingSheet) {
    return (
      <SheetEditor
        initial={editingSheet.sheet}
        onSave={saveSheet}
        onClose={() => setEditingSheet(null)}
      />
    );
  }

  if (folders.status === "loading" || files.status === "loading") {
    return <p className="rg-empty">Cargando…</p>;
  }
  if (folders.status === "error") return <p className="rg-empty">{folders.error}</p>;

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
      <div className="rg">
        <Breadcrumbs trail={trail} onGo={setCwd} />

        <div className="rg-actions">
          <button type="button" className="nk-btn" onClick={() => uploadRef.current?.click()}>
            ↑ Subir
          </button>
          <button type="button" className="nk-btn nk-btn--ghost" onClick={newFolder}>
            + Carpeta
          </button>
          <input ref={uploadRef} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
        </div>

        {allTags.length > 0 && (
          <div className="rg-tagbar">
            <button
              type="button"
              className="rg-tagbar__chip"
              aria-pressed={tag === null}
              onClick={() => setTag(null)}
            >
              Todo
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                className="rg-tagbar__chip"
                aria-pressed={tag === t}
                onClick={() => setTag(tag === t ? null : t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {subfolders.length === 0 && shown.length === 0 ? (
          <p className="rg-empty">
            {tag ? "Nada con esa etiqueta aquí." : "Carpeta vacía. Sube algo o crea una carpeta."}
          </p>
        ) : (
          <ul className="rg-list">
            {subfolders.map((f) => (
              <FolderRow
                key={f.id}
                folder={f}
                count={countIn(f.id, folders.items, files.items)}
                onOpen={() => setCwd(f.id)}
                onMenu={() => setMenuItem({ kind: "folder", id: f.id })}
              />
            ))}
            {shown.map((f) => (
              <FileRow
                key={f.id}
                file={f}
                onOpen={() => openFile(f)}
                onMenu={() => setMenuItem({ kind: "file", id: f.id })}
              />
            ))}
          </ul>
        )}

        <p className="rg-note">
          Lo que subáis aquí alimenta a Valentín. {NAMES[me]}, verás quién subió cada cosa.
        </p>
      </div>

      {menuItem && (
        <ItemMenu
          menu={menuItem}
          folders={folders}
          files={files}
          allTags={allTags}
          onClose={() => setMenuItem(null)}
          onDownload={async (file) => {
            const blob = await getBlob(file.id);
            if (blob) download(blob, file.name);
          }}
          onDeleteFile={(file) => deleteBlob(file.id)}
        />
      )}
    </DndContext>
  );
}

/* ---------------------------------------------------------------- migas */

function Breadcrumbs({ trail, onGo }: { trail: Folder[]; onGo: (id: string) => void }) {
  return (
    <nav className="rg-crumbs">
      <Crumb id="root" label="RAGugtín" here={trail.length === 0} onGo={() => onGo("")} />
      {trail.map((f, i) => (
        <span key={f.id} style={{ display: "contents" }}>
          <span className="rg-crumbs__sep">›</span>
          <Crumb id={f.id} label={f.name} here={i === trail.length - 1} onGo={() => onGo(f.id)} />
        </span>
      ))}
    </nav>
  );
}

function Crumb({
  id,
  label,
  here,
  onGo,
}: {
  id: string;
  label: string;
  here: boolean;
  onGo: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `crumb:${id}` });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`rg-crumb${here ? " rg-crumb--here" : ""}${isOver ? " rg-crumb--drop" : ""}`}
      onClick={onGo}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------- filas */

function FolderRow({
  folder,
  count,
  onOpen,
  onMenu,
}: {
  folder: Folder;
  count: number;
  onOpen: () => void;
  onMenu: () => void;
}) {
  const drag = useDraggable({ id: `folder:${folder.id}` });
  const drop = useDroppable({ id: `folder:${folder.id}` });

  return (
    <li>
      <div
        ref={(n) => {
          drag.setNodeRef(n);
          drop.setNodeRef(n);
        }}
        className={`rg-item${drag.isDragging ? " rg-item--drag" : ""}${drop.isOver ? " rg-item--over" : ""}`}
        onClick={onOpen}
        {...drag.listeners}
        {...drag.attributes}
      >
        <span className="rg-item__icon rg-item__icon--folder">
          <FolderGlyph />
        </span>
        <span className="rg-item__body">
          <span className="rg-item__name">{folder.name}</span>
          <span className="rg-item__meta">{count === 0 ? "vacía" : `${count} elementos`}</span>
        </span>
        <button
          type="button"
          className="rg-item__more"
          onClick={(e) => {
            e.stopPropagation();
            onMenu();
          }}
          aria-label="Más"
        >
          ⋯
        </button>
      </div>
    </li>
  );
}

function FileRow({
  file,
  onOpen,
  onMenu,
}: {
  file: FileItem;
  onOpen: () => void;
  onMenu: () => void;
}) {
  const drag = useDraggable({ id: `file:${file.id}` });
  const kind = kindOf(file);

  return (
    <li>
      <div
        ref={drag.setNodeRef}
        className={`rg-item${drag.isDragging ? " rg-item--drag" : ""}`}
        onClick={onOpen}
        {...drag.listeners}
        {...drag.attributes}
      >
        <span className={`rg-item__icon rg-item__icon--${kind}`}>
          <FileGlyph kind={kind} />
        </span>
        <span className="rg-item__body">
          <span className="rg-item__name">{file.name}</span>
          <span className="rg-item__meta">
            {humanSize(file.size)}
            {file.uploadedBy && ` · ${NAMES[file.uploadedBy as PersonId]}`}
          </span>
          {file.tags.length > 0 && (
            <span className="rg-item__tags">
              {file.tags.map((t) => (
                <span key={t} className="rg-minitag">
                  {t}
                </span>
              ))}
            </span>
          )}
        </span>
        <button
          type="button"
          className="rg-item__more"
          onClick={(e) => {
            e.stopPropagation();
            onMenu();
          }}
          aria-label="Más"
        >
          ⋯
        </button>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------ helpers */

function countIn(
  folderId: string,
  folders: Folder[],
  files: FileItem[],
): number {
  return (
    folders.filter((f) => f.parentId === folderId).length +
    files.filter((f) => f.folderId === folderId).length
  );
}

function ensureXlsx(name: string): string {
  return /\.(xlsx|xls|csv)$/i.test(name) ? name : `${name}.xlsx`;
}

/* --------------------------------------------------------------- menú */

function ItemMenu({
  menu,
  folders,
  files,
  allTags,
  onClose,
  onDownload,
  onDeleteFile,
}: {
  menu: { kind: "folder" | "file"; id: string };
  folders: ReturnType<typeof useRemoteCollection<Folder>>;
  files: ReturnType<typeof useRemoteCollection<FileItem>>;
  allTags: string[];
  onClose: () => void;
  onDownload: (file: FileItem) => void;
  onDeleteFile: (file: FileItem) => void;
}) {
  const [view, setView] = useState<"menu" | "rename" | "tags">("menu");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const folder = menu.kind === "folder" ? folders.items.find((f) => f.id === menu.id) : null;
  const file = menu.kind === "file" ? files.items.find((f) => f.id === menu.id) : null;
  const name = folder?.name ?? file?.name ?? "";

  const [draft, setDraft] = useState(name);
  const [tagDraft, setTagDraft] = useState("");

  function rename() {
    const clean = draft.trim();
    if (!clean) return;
    if (folder) folders.update(folder.id, { name: clean });
    if (file) files.update(file.id, { name: clean });
    onClose();
  }

  function addTag(t: string) {
    if (!file) return;
    const clean = t.trim();
    if (!clean || file.tags.includes(clean)) return;
    files.update(file.id, { tags: [...file.tags, clean] });
    setTagDraft("");
  }

  function removeTag(t: string) {
    if (!file) return;
    files.update(file.id, { tags: file.tags.filter((x) => x !== t) });
  }

  function del() {
    if (folder) folders.remove(folder.id);
    if (file) {
      onDeleteFile(file);
      files.remove(file.id);
    }
    onClose();
  }

  const liveFile = file ? files.items.find((f) => f.id === file.id) : null;

  return (
    <div className="nk-sheet" onPointerDown={onClose}>
      <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
        <header className="nk-sheet__head">
          <h2>{name}</h2>
          <button type="button" className="nk-sheet__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        {view === "menu" && (
          <div className="rg-menu">
            <button type="button" onClick={() => setView("rename")}>
              ✏️ Renombrar
            </button>
            {file && (
              <button type="button" onClick={() => setView("tags")}>
                🏷️ Etiquetas
              </button>
            )}
            {file && (
              <button type="button" onClick={() => (onDownload(file), onClose())}>
                ↓ Descargar
              </button>
            )}
            <button type="button" className="rg-menu--danger" onClick={() => setConfirmDelete(true)}>
              🗑️ Eliminar
            </button>
          </div>
        )}

        {view === "rename" && (
          <div className="rg-rename">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && rename()}
            />
            <div className="rg-actions">
              <button type="button" className="nk-btn nk-btn--ghost" onClick={() => setView("menu")}>
                Atrás
              </button>
              <button type="button" className="nk-btn" onClick={rename}>
                Guardar
              </button>
            </div>
          </div>
        )}

        {view === "tags" && liveFile && (
          <div>
            <div className="rg-tags-edit">
              {liveFile.tags.length === 0 && (
                <span className="rg-item__meta">Sin etiquetas todavía.</span>
              )}
              {liveFile.tags.map((t) => (
                <span key={t} className="rg-tag">
                  {t}
                  <button type="button" onClick={() => removeTag(t)} aria-label={`Quitar ${t}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="rg-tag-add">
              <input
                value={tagDraft}
                placeholder="Nueva etiqueta"
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTag(tagDraft)}
              />
              <button type="button" className="nk-btn" onClick={() => addTag(tagDraft)}>
                Añadir
              </button>
            </div>

            {allTags.filter((t) => !liveFile.tags.includes(t)).length > 0 && (
              <div className="rg-suggest">
                {allTags
                  .filter((t) => !liveFile.tags.includes(t))
                  .map((t) => (
                    <button key={t} type="button" onClick={() => addTag(t)}>
                      + {t}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {confirmDelete && (
          <ConfirmDialog
            title={folder ? "¿Borrar la carpeta?" : "¿Borrar el fichero?"}
            body={
              folder
                ? `Se borrará «${name}». Lo que contenga quedará suelto.`
                : `Se borrará «${name}» y no se podrá recuperar.`
            }
            confirmLabel="Borrar"
            onConfirm={del}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </div>
    </div>
  );
}
