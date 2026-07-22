import { useState } from "react";
import { useSos, type Alert } from "./model/use-sos";
import "./sos.css";

type Tab = "auxilio" | "historial";

export default function SosApp() {
  const { me, history, send, sending, error, cooldown, topic } = useSos();
  const [tab, setTab] = useState<Tab>("auxilio");

  return (
    <div className="sos">
      <div className="sos-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "auxilio"} onClick={() => setTab("auxilio")}>
          Auxilio
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "historial"}
          onClick={() => setTab("historial")}
        >
          Historial
        </button>
      </div>

      {tab === "auxilio" ? (
        <div className="sos-stage">
          <button
            type="button"
            className="sos-button"
            onClick={send}
            disabled={sending || cooldown > 0}
          >
            <span className="sos-button__label">
              {sending ? "Avisando…" : cooldown > 0 ? "Avisado" : "Cacahuete"}
              <span className="sos-button__sub">
                {cooldown > 0 ? `Puedes repetir en ${cooldown} s` : "Pulsa si lo necesitas"}
              </span>
            </span>
          </button>

          {error ? (
            <p className="sos-error">{error}</p>
          ) : (
            <p className="sos-hint">
              {me === "irene" ? "Vicente" : "Irene"} recibirá un aviso en el móvil al instante.
            </p>
          )}

          <div className="sos-setup">
            <h3>Para que llegue el aviso</h3>
            Los dos necesitáis la app <b>ntfy</b> instalada y suscrita a este canal:
            <code>{topic}</code>
            Sin ella el aviso se manda igual y queda en el historial, pero no suena en el móvil.
          </div>
        </div>
      ) : (
        <History history={history} />
      )}
    </div>
  );
}

function History({ history }: { history: Alert[] }) {
  if (history.length === 0) {
    return <p className="sos-empty">Todavía no ha hecho falta pedir auxilio.</p>;
  }

  return (
    <ul className="sos-list">
      {history.map((a) => (
        <li key={a.id} className="sos-item">
          <span className="sos-item__who">{a.from === "irene" ? "🌸" : a.from === "vicente" ? "🌿" : "🥜"}</span>
          <div className="sos-item__body">
            <div className="sos-item__text">{a.text}</div>
            <div className="sos-item__when">{when(a.at)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** "Hace un rato" para lo reciente, fecha completa para lo viejo. */
function when(at: number): string {
  const mins = Math.floor((Date.now() - at) / 60_000);
  if (mins < 1) return "Ahora mismo";
  if (mins < 60) return `Hace ${mins} min`;
  if (mins < 24 * 60) return `Hace ${Math.floor(mins / 60)} h`;

  return new Date(at).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
