import { useState } from "react";
import auxilioIcon from "../../assets/auxilio_me_agobio_sobrecarga_salvame_cacahuete.webp";
import { messageFor, useSos, type Alert } from "./model/use-sos";
import "./sos.css";

type Tab = "auxilio" | "historial";

const NAMES = { irene: "Irene", vicente: "Vicente" } as const;

export default function SosApp() {
  const { me, history, send, sending, error, cooldown, topic } = useSos();
  const [tab, setTab] = useState<Tab>("auxilio");

  const other = me === "irene" ? "vicente" : "irene";

  return (
    <div className="sos">
      <div className="sos-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "auxilio"}
          onClick={() => setTab("auxilio")}
        >
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
        <>
          <section className="sos-panel">
            {/* El aviso literal, en bocadillo: se ve exactamente qué le llega. */}
            <p className="sos-say">{messageFor(me)}</p>

            <button
              type="button"
              className="sos-bell"
              onClick={send}
              disabled={sending || cooldown > 0}
              aria-label="Pedir auxilio"
            >
              <img src={auxilioIcon} alt="" draggable={false} />
            </button>

            <div className="sos-caption">
              <b>{sending ? "Avisando…" : cooldown > 0 ? "Aviso enviado" : "Bandera blanca"}</b>
              <span>
                {cooldown > 0
                  ? `Puedes repetir en ${cooldown} s`
                  : `Le llega a ${NAMES[other]} al momento`}
              </span>
            </div>

            {error && <p className="sos-error">{error}</p>}
          </section>

          <div className="sos-setup">
            <h3>Para que suene en el móvil</h3>
            Los dos necesitáis la app <b>ntfy</b> instalada y suscrita a este canal:
            <code>{topic}</code>
            Sin ella el aviso se manda igual y queda en el historial, pero el teléfono no avisa.
          </div>
        </>
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
          <span className="sos-item__who">
            {a.from === "desconocido" ? "?" : NAMES[a.from][0]}
          </span>

          <div className="sos-item__body">
            <div className="sos-item__text">{a.text}</div>
            <div className="sos-item__when">{when(a.at)}</div>
          </div>

          <span className="sos-item__stamp">
            {new Date(a.at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
          </span>
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

  return new Date(at).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
  });
}
