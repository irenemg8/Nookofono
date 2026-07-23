import { useRef, useState } from "react";
import { deleteBlob, download, getBlob, putBlob } from "../../shared/lib/filestore";
import { useCurrentUser } from "../../shared/lib/use-current-user";
import { useRemoteCollection } from "../../shared/lib/use-remote-collection";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { exportSheetBlob } from "../files/model/save-sheet";
import { humanSize, isSheet, type FileItem } from "../files/model/types";
import { emptySheet, type Sheet } from "./model/grid";
import { importFile } from "./model/xlsx";
import { SheetEditor } from "./ui/SheetEditor";
import "./sheets.css";

/**
 * Hojas de cálculo.
 *
 * No tiene almacén propio: es una **vista de los `.xlsx`/`.csv` de RAGugtín**.
 * Un fichero es el mismo se mire desde aquí o desde Archivos —una sola fuente de
 * verdad, cero copias—. Crear una hoja nueva la guarda como fichero en la raíz
 * de RAGugtín; editarla reescribe ese mismo fichero.
 */
export default function SheetsApp() {
  const me = useCurrentUser();
  const files = useRemoteCollection<FileItem>("/api/files");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<FileItem | null>(null);
  const [initialSheet, setInitialSheet] = useState<Sheet | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  // De todo RAGugtín, sólo las hojas de cálculo.
  const sheets = files.items.filter(isSheet).sort((a, b) => b.updatedAt - a.updatedAt);
  const openFile = sheets.find((f) => f.id === openId) ?? null;

  async function createBlank() {
    const sheet = emptySheet("Hoja nueva");
    const blob = await exportSheetBlob(sheet);
    const item = await files.create({
      name: "Hoja nueva.xlsx",
      folderId: "", // raíz de RAGugtín
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: blob.size,
      tags: [],
      uploadedBy: me,
    });
    if (item) {
      await putBlob(item.id, blob).catch(() => {});
      setInitialSheet(sheet);
      setOpenId(item.id);
    }
  }

  async function importXlsx(file: File | undefined) {
    if (!file) return;
    try {
      // Se valida que se lee antes de crear el fichero.
      await importFile(file);
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
        setOpenId(item.id);
        setInitialSheet(null);
      }
    } catch {
      alert("No se pudo leer el fichero. ¿Es un .xlsx o .csv válido?");
    }
  }

  async function open(file: FileItem) {
    const blob = await getBlob(file.id);
    const sheet = blob
      ? await importFile(new File([blob], file.name, { type: file.mime })).catch(() =>
          emptySheet(file.name),
        )
      : emptySheet(file.name);
    setInitialSheet(sheet);
    setOpenId(file.id);
  }

  async function save(sheet: Sheet) {
    if (!openFile) return;
    const blob = await exportSheetBlob(sheet);
    await putBlob(openFile.id, blob);
    await files.update(openFile.id, { name: ensureExt(sheet.name), size: blob.size });
  }

  if (files.status === "loading") return <p className="xl-empty">Cargando…</p>;
  if (files.status === "error") return <p className="xl-empty">{files.error}</p>;

  if (openFile && initialSheet) {
    return <SheetEditor initial={initialSheet} onSave={save} onClose={() => setOpenId(null)} />;
  }

  return (
    <div className="xl">
      <div className="xl-actions">
        <button type="button" className="nk-btn" onClick={createBlank}>
          + Hoja nueva
        </button>
        <button type="button" className="nk-btn nk-btn--ghost" onClick={() => uploadRef.current?.click()}>
          Cargar archivo
        </button>
        <input
          ref={uploadRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          onChange={(e) => importXlsx(e.target.files?.[0])}
        />
      </div>

      {sheets.length === 0 ? (
        <p className="xl-empty">No hay ninguna hoja todavía. Crea una o carga un Excel.</p>
      ) : (
        <ul className="xl-list">
          {sheets.map((f) => (
            <li key={f.id}>
              <div
                className="xl-row"
                role="button"
                tabIndex={0}
                onClick={() => open(f)}
                onKeyDown={(e) => e.key === "Enter" && open(f)}
              >
                <span className="xl-row__icon">
                  {f.name.toLowerCase().endsWith(".csv") ? "CSV" : "XLS"}
                </span>
                <span className="xl-row__body">
                  <span className="xl-row__name">{f.name}</span>
                  <span className="xl-row__meta">
                    {humanSize(f.size)} · {new Date(f.updatedAt).toLocaleDateString("es-ES")}
                  </span>
                </span>

                <button
                  type="button"
                  className="xl-row__act"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const blob = await getBlob(f.id);
                    if (blob) download(blob, f.name);
                  }}
                  aria-label="Descargar hoja"
                  title="Descargar"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="xl-row__x"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPending(f);
                  }}
                  aria-label="Borrar hoja"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="xl-note">
        Son los Excel de RAG-Pugtín. Lo que crees o cargues aquí aparece también en Archivos.
      </p>

      {pending && (
        <ConfirmDialog
          title="¿Borrar esta hoja?"
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

function ensureExt(name: string): string {
  return /\.(xlsx|xls|csv)$/i.test(name) ? name : `${name}.xlsx`;
}
