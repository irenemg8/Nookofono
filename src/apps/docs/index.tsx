import { useRef, useState } from "react";
import { deleteBlob, download, getBlob, putBlob } from "../../shared/lib/filestore";
import { useCurrentUser } from "../../shared/lib/use-current-user";
import { useRemoteCollection } from "../../shared/lib/use-remote-collection";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { humanSize, isDoc, type FileItem } from "../files/model/types";
import { exportDocBlob, exportDocxBlob, importDocx } from "./model/docx";
import { DocEditor } from "./ui/DocEditor";
import "./docs.css";

/**
 * Docs.
 *
 * Como la app Excel, no tiene almacén propio: es una **vista de los `.docx`/
 * `.doc` de RAGugtín**. Un documento es el mismo se abra desde aquí o desde
 * Archivos. Crear uno nuevo lo guarda como fichero en la raíz de RAGugtín;
 * editarlo reescribe ese mismo fichero.
 */
export default function DocsApp() {
  const me = useCurrentUser();
  const files = useRemoteCollection<FileItem>("/api/files");
  const [open, setOpen] = useState<{ file: FileItem; html: string } | null>(null);
  const [pending, setPending] = useState<FileItem | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const docs = files.items.filter(isDoc).sort((a, b) => b.updatedAt - a.updatedAt);

  async function createBlank() {
    const html = "<h1>Documento nuevo</h1><p></p>";
    const blob = await exportDocxBlob(html).catch(() => exportDocBlob(html));
    const item = await files.create({
      name: nameFor(blob, "Documento nuevo"),
      folderId: "",
      mime: blob.type,
      size: blob.size,
      tags: [],
      uploadedBy: me,
    });
    if (item) {
      await putBlob(item.id, blob).catch(() => {});
      setOpen({ file: item, html });
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      const html = await importDocx(file);
      const item = await files.create({
        name: file.name,
        folderId: "",
        mime: file.type,
        size: file.size,
        tags: [],
        uploadedBy: me,
      });
      if (item) {
        await putBlob(item.id, file).catch(() => {});
        setOpen({ file: item, html });
      }
    } catch {
      alert("No se pudo leer el documento. ¿Es un .docx?");
    }
  }

  async function openDoc(file: FileItem) {
    const blob = await getBlob(file.id);
    const html = blob
      ? await importDocx(new File([blob], file.name, { type: file.mime })).catch(() => "<p></p>")
      : "<p></p>";
    setOpen({ file, html });
  }

  async function save(html: string, name: string) {
    if (!open) return;
    // Se guarda como .docx de verdad; si la librería fallara, como .doc.
    const blob = await exportDocxBlob(html).catch(() => exportDocBlob(html));
    await putBlob(open.file.id, blob);
    await files.update(open.file.id, { name: ensureExt(name), size: blob.size, mime: blob.type });
  }

  if (files.status === "loading") return <p className="dc-empty">Cargando…</p>;
  if (files.status === "error") return <p className="dc-empty">{files.error}</p>;

  if (open) {
    return (
      <DocEditor
        initialHtml={open.html}
        initialName={open.file.name}
        onSave={save}
        onClose={() => setOpen(null)}
      />
    );
  }

  return (
    <div className="dc">
      <div className="dc-actions">
        <button type="button" className="nk-btn" onClick={createBlank}>
          + Documento
        </button>
        <button type="button" className="nk-btn nk-btn--ghost" onClick={() => uploadRef.current?.click()}>
          Cargar Word
        </button>
        <input
          ref={uploadRef}
          type="file"
          accept=".docx,.doc"
          hidden
          onChange={(e) => importFile(e.target.files?.[0])}
        />
      </div>

      {docs.length === 0 ? (
        <p className="dc-empty">No hay documentos todavía. Crea uno o carga un Word.</p>
      ) : (
        <ul className="dc-list">
          {docs.map((f) => (
            <li key={f.id}>
              <div
                className="dc-row"
                role="button"
                tabIndex={0}
                onClick={() => openDoc(f)}
                onKeyDown={(e) => e.key === "Enter" && openDoc(f)}
              >
                <span className="dc-row__icon">DOC</span>
                <span className="dc-row__body">
                  <span className="dc-row__name">{f.name}</span>
                  <span className="dc-row__meta">
                    {humanSize(f.size)} · {new Date(f.updatedAt).toLocaleDateString("es-ES")}
                  </span>
                </span>

                <button
                  type="button"
                  className="dc-row__act"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const blob = await getBlob(f.id);
                    if (blob) download(blob, f.name);
                  }}
                  aria-label="Descargar"
                  title="Descargar"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="dc-row__x"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPending(f);
                  }}
                  aria-label="Borrar"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="dc-note">
        Son los Word de RAG-Pugtín. Lo que crees o cargues aquí aparece también en Archivos.
      </p>

      {pending && (
        <ConfirmDialog
          title="¿Borrar este documento?"
          body={`Se borrará «${pending.name}» de RAG-Pugtín.`}
          confirmLabel="Borrar"
          onConfirm={() => {
            deleteBlob(pending.id);
            files.remove(pending.id);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

function nameFor(blob: Blob, base: string): string {
  const ext = blob.type.includes("wordprocessingml") ? "docx" : "doc";
  return `${base}.${ext}`;
}

function ensureExt(name: string): string {
  return /\.(docx?|html?)$/i.test(name) ? name : `${name}.docx`;
}
