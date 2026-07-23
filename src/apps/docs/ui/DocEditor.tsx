import { useEffect, useRef, useState } from "react";
import { exportDocBlob, exportDocxBlob } from "../model/docx";
import { download } from "../../../shared/lib/filestore";
import "../docs.css";

/**
 * Editor de documentos de texto con formato.
 *
 * Trabaja sobre HTML, que es lo que produce e ingiere Word por debajo. Usa un
 * `contenteditable` con una barra de negrita/cursiva/títulos/listas. Cada cambio
 * se avisa por `onSave(html, name)`; quien lo use decide dónde guarda.
 *
 * Reutilizable: lo usan la app Docs y RAGugtín, igual que el editor de hojas.
 */
export function DocEditor({
  initialHtml,
  initialName,
  onSave,
  onClose,
}: {
  initialHtml: string;
  initialName: string;
  onSave: (html: string, name: string) => void;
  onClose: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(initialName);
  const [downloading, setDownloading] = useState(false);

  // El HTML inicial se pone una sola vez; después manda el contenteditable, y
  // volver a inyectarlo movería el cursor a cada tecla.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.innerHTML = initialHtml || "<p><br></p>";
  }, [initialHtml]);

  function currentHtml(): string {
    return bodyRef.current?.innerHTML ?? "";
  }

  function saveNow() {
    onSave(currentHtml(), name);
  }

  /** Aplica un formato a la selección. `execCommand` está deprecado pero es lo
   *  único que funciona igual en todos los navegadores para esto. */
  function format(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    bodyRef.current?.focus();
    saveNow();
  }

  return (
    <div className="dc-editor">
      <div className="dc-bar">
        <button type="button" className="dc-bar__btn" onClick={onClose} aria-label="Volver">
          ‹
        </button>
        <input
          className="dc-bar__name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveNow}
        />
        <button type="button" className="nk-btn nk-btn--sm" onClick={() => setDownloading(true)}>
          ↓ Descargar
        </button>
      </div>

      <div className="dc-toolbar">
        <button type="button" onClick={() => format("bold")} title="Negrita">
          <b>B</b>
        </button>
        <button type="button" onClick={() => format("italic")} title="Cursiva">
          <i>I</i>
        </button>
        <button type="button" onClick={() => format("underline")} title="Subrayado">
          <u>U</u>
        </button>
        <span className="dc-toolbar__sep" />
        <button type="button" onClick={() => format("formatBlock", "<h1>")} title="Título">
          T1
        </button>
        <button type="button" onClick={() => format("formatBlock", "<h2>")} title="Subtítulo">
          T2
        </button>
        <button type="button" onClick={() => format("formatBlock", "<p>")} title="Texto normal">
          ¶
        </button>
        <span className="dc-toolbar__sep" />
        <button type="button" onClick={() => format("insertUnorderedList")} title="Lista">
          •
        </button>
        <button type="button" onClick={() => format("insertOrderedList")} title="Lista numerada">
          1.
        </button>
      </div>

      <div
        ref={bodyRef}
        className="dc-page"
        contentEditable
        suppressContentEditableWarning
        onInput={saveNow}
        onBlur={saveNow}
      />

      {downloading && (
        <div className="nk-sheet" onPointerDown={() => setDownloading(false)}>
          <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
            <header className="nk-sheet__head">
              <h2>Descargar «{name}»</h2>
              <button
                type="button"
                className="nk-sheet__close"
                onClick={() => setDownloading(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </header>
            <div className="dc-formats">
              <button
                type="button"
                className="dc-format"
                onClick={async () => {
                  const blob = await exportDocxBlob(currentHtml());
                  download(blob, ensureExt(name, "docx"));
                  setDownloading(false);
                }}
              >
                <span className="dc-format__ext">DOCX</span>
                <span className="dc-format__desc">Word, con el formato básico</span>
              </button>
              <button
                type="button"
                className="dc-format"
                onClick={() => {
                  download(exportDocBlob(currentHtml()), ensureExt(name, "doc"));
                  setDownloading(false);
                }}
              >
                <span className="dc-format__ext">DOC</span>
                <span className="dc-format__desc">Compatible con cualquier Word</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ensureExt(name: string, ext: string): string {
  const base = name.replace(/\.(docx?|html?|txt)$/i, "");
  return `${base}.${ext}`;
}
