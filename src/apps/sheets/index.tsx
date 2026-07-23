import { useRef, useState } from "react";
import { useRemoteCollection, type Entity } from "../../shared/lib/use-remote-collection";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { emptySheet, type Sheet } from "./model/grid";
import { exportFile, importFile } from "./model/xlsx";
import { SheetEditor } from "./ui/SheetEditor";
import "./sheets.css";

/** Una hoja guardada. El grid entero va serializado en `data`. */
interface SheetDoc extends Entity {
  name: string;
  /** `Sheet` en JSON, porque la colección guarda campos sueltos, no objetos. */
  data: string;
}

export default function SheetsApp() {
  const docs = useRemoteCollection<SheetDoc>("/api/sheets");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<SheetDoc | null>(null);
  /** La hoja para la que se está eligiendo formato de descarga. */
  const [downloading, setDownloading] = useState<Sheet | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openDoc = docs.items.find((d) => d.id === openId) ?? null;

  async function createBlank() {
    const doc = await docs.create({ name: "Hoja nueva", data: JSON.stringify(emptySheet()) });
    if (doc) setOpenId(doc.id);
  }

  async function importXlsx(file: File | undefined) {
    if (!file) return;
    try {
      const sheet = await importFile(file);
      const doc = await docs.create({ name: sheet.name, data: JSON.stringify(sheet) });
      if (doc) setOpenId(doc.id);
    } catch {
      alert("No se pudo leer el fichero. ¿Es un .xlsx o .csv válido?");
    }
  }

  if (docs.status === "loading") return <p className="xl-empty">Cargando…</p>;
  if (docs.status === "error") return <p className="xl-empty">{docs.error}</p>;

  if (openDoc) {
    return (
      <Editor
        doc={openDoc}
        onSave={(sheet) => docs.update(openDoc.id, { name: sheet.name, data: JSON.stringify(sheet) })}
        onClose={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="xl">
      <div className="xl-actions">
        <button type="button" className="nk-btn" onClick={createBlank}>
          + Hoja nueva
        </button>
        <button type="button" className="nk-btn nk-btn--ghost" onClick={() => fileRef.current?.click()}>
          Cargar archivo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          onChange={(e) => importXlsx(e.target.files?.[0])}
        />
      </div>

      {docs.items.length === 0 ? (
        <p className="xl-empty">No hay ninguna hoja todavía. Crea una o carga un Excel.</p>
      ) : (
        <ul className="xl-list">
          {docs.items.map((d) => {
            const sheet = safeParse(d.data);
            const filled = sheet ? Object.keys(sheet.cells).length : 0;
            return (
              <li key={d.id}>
                {/* Fila clicable como div para no anidar botones dentro de otro. */}
                <div
                  className="xl-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenId(d.id)}
                  onKeyDown={(e) => e.key === "Enter" && setOpenId(d.id)}
                >
                  <span className="xl-row__icon">XLS</span>
                  <span className="xl-row__body">
                    <span className="xl-row__name">{d.name}</span>
                    <span className="xl-row__meta">
                      {filled} celda{filled === 1 ? "" : "s"} ·{" "}
                      {new Date(d.updatedAt).toLocaleDateString("es-ES")}
                    </span>
                  </span>

                  <button
                    type="button"
                    className="xl-row__act"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (sheet) setDownloading(sheet);
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
                      setPending(d);
                    }}
                    aria-label="Borrar hoja"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="xl-note">
        Los ficheros que subas a RAGugtín aparecerán aquí cuando esté listo su almacén compartido.
      </p>

      {pending && (
        <ConfirmDialog
          title="¿Borrar esta hoja?"
          body={`Se borrará «${pending.name}».`}
          confirmLabel="Borrar"
          onConfirm={() => {
            docs.remove(pending.id);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}

      {downloading && (
        <FormatSheet sheet={downloading} onClose={() => setDownloading(null)} />
      )}
    </div>
  );
}

/** Hoja inferior para elegir en qué formato se descarga. */
function FormatSheet({ sheet, onClose }: { sheet: Sheet; onClose: () => void }) {
  function pick(format: "xlsx" | "csv") {
    exportFile(sheet, format);
    onClose();
  }

  return (
    <div className="nk-sheet" onPointerDown={onClose}>
      <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
        <header className="nk-sheet__head">
          <h2>Descargar «{sheet.name}»</h2>
          <button type="button" className="nk-sheet__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="xl-formats">
          <button type="button" className="xl-format" onClick={() => pick("xlsx")}>
            <span className="xl-format__ext">XLSX</span>
            <span className="xl-format__desc">Excel, con las fórmulas que entiende</span>
          </button>
          <button type="button" className="xl-format" onClick={() => pick("csv")}>
            <span className="xl-format__ext">CSV</span>
            <span className="xl-format__desc">Texto plano, para abrir en cualquier sitio</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- editor */

function Editor({
  doc,
  onSave,
  onClose,
}: {
  doc: SheetDoc;
  onSave: (sheet: Sheet) => void;
  onClose: () => void;
}) {
  const initial = safeParse(doc.data) ?? emptySheet(doc.name);
  return <SheetEditor initial={initial} onSave={onSave} onClose={onClose} />;
}

function safeParse(data: string): Sheet | null {
  try {
    const s = JSON.parse(data);
    if (s && typeof s === "object" && s.cells) return s as Sheet;
  } catch {
    // Datos corruptos: se trata como hoja vacía.
  }
  return null;
}
