import { useRef, useState } from "react";
import {
  downloadPhoto,
  usePhotoLibrary,
  type PhotoRef,
} from "../../shared/lib/use-photo-library";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import "./photos.css";

/**
 * Fotos — la galería compartida.
 *
 * Subir, borrar y descargar, en cuadrícula. Toca una foto y se abre a pantalla
 * completa con sus botones. Las que vienen con la app (en `src/assets/photos/`)
 * salen también aquí, pero no se pueden borrar.
 */
export default function PhotosApp() {
  const lib = usePhotoLibrary();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<PhotoRef | null>(null);
  const [pending, setPending] = useState<PhotoRef | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) await lib.upload(file);
    }
    setBusy(false);
    if (uploadRef.current) uploadRef.current.value = "";
  }

  if (lib.status === "loading") return <p className="ph-empty">Cargando…</p>;
  if (lib.status === "error") return <p className="ph-empty">{lib.error}</p>;

  return (
    <div className="ph">
      <div className="ph-actions">
        <button
          type="button"
          className="nk-btn"
          onClick={() => uploadRef.current?.click()}
          disabled={busy}
        >
          {busy ? "Subiendo…" : "+ Subir fotos"}
        </button>
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {lib.refs.length === 0 ? (
        <p className="ph-empty">Todavía no hay fotos. Sube la primera.</p>
      ) : (
        <ul className="ph-grid">
          {lib.refs.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="ph-cell"
                onClick={() => setViewing(p)}
                aria-label={`Ver ${p.name}`}
              >
                <img src={p.url} alt={p.name} loading="lazy" decoding="async" draggable={false} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <div className="ph-viewer" onPointerDown={() => setViewing(null)}>
          <img
            src={viewing.url}
            alt={viewing.name}
            draggable={false}
            onPointerDown={(e) => e.stopPropagation()}
          />
          <div className="ph-viewer__bar" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" className="nk-btn nk-btn--ghost" onClick={() => downloadPhoto(viewing)}>
              Descargar
            </button>
            {!viewing.bundled && (
              <button
                type="button"
                className="nk-btn nk-btn--danger"
                onClick={() => {
                  setPending(viewing);
                  setViewing(null);
                }}
              >
                Borrar
              </button>
            )}
            <button type="button" className="nk-btn" onClick={() => setViewing(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {pending && (
        <ConfirmDialog
          title="¿Borrar esta foto?"
          body="Se borrará de la galería para los dos. No se puede deshacer."
          confirmLabel="Borrar"
          onConfirm={() => {
            lib.remove(pending.id);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
