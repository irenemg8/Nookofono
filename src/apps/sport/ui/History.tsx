import { useState } from "react";
import { download } from "../../../shared/lib/filestore";
import type { PersonId } from "../../../shared/lib/use-current-user";
import type { useRemoteCollection } from "../../../shared/lib/use-remote-collection";
import { ConfirmDialog, RemoveBadge } from "../../../shared/ui/ConfirmDialog";
import { exportSessions, formatDuration, type SportSession } from "../model/types";

type Sessions = ReturnType<typeof useRemoteCollection<SportSession>>;

export function History({ me, sessions }: { me: PersonId; sessions: Sessions }) {
  const mine = sessions.items
    .filter((s) => s.user === me)
    .sort((a, b) => b.doneAt - a.doneAt);

  const [downloading, setDownloading] = useState(false);
  const [pending, setPending] = useState<SportSession | null>(null);

  async function grab(kind: "csv" | "xlsx") {
    setDownloading(false);
    const blob = await exportSessions(mine, kind);
    const stamp = new Date().toISOString().slice(0, 10);
    download(blob, `deporte-${me}-${stamp}.${kind}`);
  }

  const totalSec = mine.reduce((a, s) => a + s.durationSec, 0);

  if (sessions.status === "loading") return <p className="sp-empty">Cargando…</p>;

  return (
    <div className="sp-history">
      {mine.length === 0 ? (
        <p className="sp-empty">Aún no hay sesiones. Cronometra tu primer entreno.</p>
      ) : (
        <>
          <div className="sp-sum">
            <div>
              <b>{mine.length}</b>
              <span>sesiones</span>
            </div>
            <div>
              <b>{formatDuration(totalSec)}</b>
              <span>en total</span>
            </div>
            <button type="button" className="nk-btn nk-btn--ghost" onClick={() => setDownloading(true)}>
              Descargar
            </button>
          </div>

          <ul className="sp-log">
            {mine.map((s) => (
              <li key={s.id} className="sp-log__item">
                <span className="sp-log__emoji">{s.emoji}</span>
                <div className="sp-log__body">
                  <div className="sp-log__top">
                    <strong>{s.sport}</strong>
                    <span className="sp-log__dur">{formatDuration(s.durationSec)}</span>
                  </div>
                  <div className="sp-log__meta">
                    {new Date(s.doneAt).toLocaleString("es-ES", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  {s.note && <p className="sp-log__note">{s.note}</p>}
                </div>
                <RemoveBadge danger label="Borrar sesión" onRemove={() => setPending(s)} />
              </li>
            ))}
          </ul>
        </>
      )}

      {downloading && (
        <div className="nk-sheet" onPointerDown={() => setDownloading(false)}>
          <div className="nk-sheet__panel nk-sheet__panel--short" onPointerDown={(e) => e.stopPropagation()}>
            <header className="nk-sheet__head">
              <h2>Descargar historial</h2>
              <button
                type="button"
                className="nk-sheet__close"
                onClick={() => setDownloading(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </header>
            <div className="sp-dl">
              <button type="button" className="nk-btn" onClick={() => grab("xlsx")}>
                Excel (.xlsx)
              </button>
              <button type="button" className="nk-btn nk-btn--ghost" onClick={() => grab("csv")}>
                CSV (.csv)
              </button>
            </div>
          </div>
        </div>
      )}

      {pending && (
        <ConfirmDialog
          title="¿Borrar esta sesión?"
          body={`Se borra la sesión de ${pending.sport} del historial.`}
          confirmLabel="Borrar"
          onConfirm={() => {
            sessions.remove(pending.id);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
