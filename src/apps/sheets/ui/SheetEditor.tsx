import { useMemo, useState } from "react";
import { computeGrid } from "../model/formula";
import { colName, makeAddr, type Sheet } from "../model/grid";
import { exportFile } from "../model/xlsx";
import "../sheets.css";

/**
 * Editor de una hoja de cálculo.
 *
 * Trabaja sobre un `Sheet` suelto —no sobre un documento guardado—, así que lo
 * usan tanto la app Excel como RAGugtín para editar un `.xlsx` que se ha subido
 * como fichero. Cada cambio se avisa por `onSave`; quien lo use decide dónde va.
 */
export function SheetEditor({
  initial,
  onSave,
  onClose,
  backLabel = "‹",
}: {
  initial: Sheet;
  onSave: (sheet: Sheet) => void;
  onClose: () => void;
  backLabel?: string;
}) {
  const [sheet, setSheet] = useState<Sheet>(initial);
  const [selected, setSelected] = useState("A1");
  const [draft, setDraft] = useState(initial.cells["A1"] ?? "");
  const [downloading, setDownloading] = useState(false);

  const computed = useMemo(() => computeGrid(sheet.cells), [sheet.cells]);

  function persist(next: Sheet) {
    setSheet(next);
    onSave(next);
  }

  function select(addr: string) {
    setSelected(addr);
    setDraft(sheet.cells[addr] ?? "");
  }

  function commit(value: string) {
    const cells = { ...sheet.cells };
    if (value === "") delete cells[selected];
    else cells[selected] = value;
    persist({ ...sheet, cells });
  }

  return (
    <div className="xl-editor">
      <div className="xl-bar">
        <button type="button" className="xl-bar__btn" onClick={onClose} aria-label="Volver">
          {backLabel}
        </button>
        <input
          className="xl-bar__name"
          value={sheet.name}
          onChange={(e) => persist({ ...sheet, name: e.target.value })}
        />
        <button type="button" className="nk-btn nk-btn--sm" onClick={() => setDownloading(true)}>
          ↓ Descargar
        </button>
      </div>

      <div className="xl-formula">
        <span className="xl-formula__addr">{selected}</span>
        <input
          value={draft}
          placeholder="Valor o fórmula (=SUMA(A1:A5))"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit(draft);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>

      <div className="xl-grid-wrap">
        <table className="xl-grid">
          <thead>
            <tr>
              <th />
              {Array.from({ length: sheet.cols }, (_, c) => (
                <th key={c}>{colName(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sheet.rows }, (_, r) => (
              <tr key={r}>
                <th>{r + 1}</th>
                {Array.from({ length: sheet.cols }, (_, c) => {
                  const addr = makeAddr(r, c);
                  const value = computed[addr];
                  const isNum = value?.num !== null && (sheet.cells[addr] ?? "") !== "";
                  return (
                    <td
                      key={c}
                      className={[
                        "xl-cell",
                        isNum ? "xl-cell--num" : "",
                        value?.error ? "xl-cell--err" : "",
                        selected === addr ? "xl-cell--on" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => select(addr)}
                    >
                      {value?.text ?? ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="xl-actions">
        <button
          type="button"
          className="nk-btn nk-btn--ghost"
          onClick={() => persist({ ...sheet, rows: sheet.rows + 10 })}
        >
          + Filas
        </button>
        <button
          type="button"
          className="nk-btn nk-btn--ghost"
          onClick={() => persist({ ...sheet, cols: sheet.cols + 4 })}
        >
          + Columnas
        </button>
      </div>

      {downloading && (
        <div className="nk-sheet" onPointerDown={() => setDownloading(false)}>
          <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
            <header className="nk-sheet__head">
              <h2>Descargar «{sheet.name}»</h2>
              <button
                type="button"
                className="nk-sheet__close"
                onClick={() => setDownloading(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </header>
            <div className="xl-formats">
              <button
                type="button"
                className="xl-format"
                onClick={() => {
                  exportFile(sheet, "xlsx");
                  setDownloading(false);
                }}
              >
                <span className="xl-format__ext">XLSX</span>
                <span className="xl-format__desc">Excel, con las fórmulas que entiende</span>
              </button>
              <button
                type="button"
                className="xl-format"
                onClick={() => {
                  exportFile(sheet, "csv");
                  setDownloading(false);
                }}
              >
                <span className="xl-format__ext">CSV</span>
                <span className="xl-format__desc">Texto plano, para abrir en cualquier sitio</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
