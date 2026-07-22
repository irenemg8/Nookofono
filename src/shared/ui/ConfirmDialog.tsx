/**
 * Diálogo de confirmación para acciones que borran algo.
 *
 * Vive en `shared/ui` porque lo usan tanto la pantalla de inicio (quitar un
 * widget) como las mini-apps (quitar un destino, una nota…), y todas deben
 * preguntar igual.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Quitar",
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="nk-modal" onPointerDown={onCancel}>
      <div
        className="nk-modal__panel"
        role="alertdialog"
        aria-modal="true"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h2 className="nk-modal__title">{title}</h2>
        <p className="nk-modal__body">{body}</p>
        <div className="nk-modal__actions">
          <button type="button" className="nk-btn nk-btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="nk-btn nk-btn--danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Aspa de quitar, en la esquina de una tarjeta o un widget. */
export function RemoveBadge({
  label,
  danger = false,
  onRemove,
}: {
  label: string;
  danger?: boolean;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      className={`nk-remove${danger ? " nk-remove--danger" : ""}`}
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
