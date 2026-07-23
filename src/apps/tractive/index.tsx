import { useState } from "react";
import tractiveIcon from "../../assets/tractive.webp";
import { notify } from "../../shared/lib/ntfy";
import { useCurrentUser } from "../../shared/lib/use-current-user";
import { useRemoteCollection, type Entity } from "../../shared/lib/use-remote-collection";
import "./tractive.css";

const TOPIC = "ipug-tractive-5e8b2c1a9f74";

/** El aviso que le llega a Vicente. */
const MESSAGE = "Pug pug, el Tractive me dice que te has ido lejos, vuelve Pug";

interface Ping extends Entity {
  text: string;
}

export default function TractiveApp() {
  const me = useCurrentUser();
  // Sólo Irene puede mandar el aviso; Vicente sólo lo recibe.
  return me === "irene" ? <Sender /> : <Receiver />;
}

/* ------------------------------------------------------------------- Irene */

function Sender() {
  const pings = useRemoteCollection<Ping>("/api/tractive");
  const [tab, setTab] = useState<"buscar" | "historial">("buscar");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const ok = await notify({
        topic: TOPIC,
        title: "Tractive",
        body: MESSAGE,
        priority: "urgent",
        tags: ["dog2", "round_pushpin"],
      });
      if (!ok) throw new Error();
      await pings.create({ text: MESSAGE });
      // Un minuto de espera para no bombardear.
      setCooldown(60);
      const tick = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(tick);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch {
      setError("No se pudo enviar. Comprueba la conexión.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="tr">
      <div className="tr-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "buscar"} onClick={() => setTab("buscar")}>
          Buscar a Vicente
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

      {tab === "buscar" ? (
        <>
          <section className="tr-panel">
            <p className="tr-say">{MESSAGE}</p>

            <button
              type="button"
              className="tr-btn"
              onClick={send}
              disabled={sending || cooldown > 0}
              aria-label="Avisar a Vicente"
            >
              <img src={tractiveIcon} alt="" draggable={false} />
            </button>

            <div className="tr-caption">
              <b>{sending ? "Avisando…" : cooldown > 0 ? "Aviso enviado" : "¿Dónde está Pug Pug?"}</b>
              <span>
                {cooldown > 0 ? `Puedes repetir en ${cooldown} s` : "Le llega el aviso al momento"}
              </span>
            </div>

            {error && <p className="tr-error">{error}</p>}
          </section>

          <div className="tr-setup">
            <h3>Para que le suene a Vicente</h3>
            Vicente necesita la app <b>ntfy</b> instalada y suscrita a este canal:
            <code>{TOPIC}</code>
          </div>
        </>
      ) : (
        <History pings={pings.items} />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- Vicente */

function Receiver() {
  const pings = useRemoteCollection<Ping>("/api/tractive");

  return (
    <div className="tr">
      <div className="tr-receiver">
        <img src={tractiveIcon} alt="" />
        <h2>Tu Tractive</h2>
        <p>
          Aquí te avisa Irene cuando te está buscando. Ten la app <b>ntfy</b> instalada y suscrita
          para que suene aunque tengas iPug cerrada.
        </p>
      </div>

      <History pings={pings.items} />
    </div>
  );
}

/* --------------------------------------------------------------- historial */

function History({ pings }: { pings: Ping[] }) {
  const sorted = [...pings].sort((a, b) => b.createdAt - a.createdAt);

  if (sorted.length === 0) {
    return <p className="tr-empty">Todavía no ha hecho falta.</p>;
  }

  return (
    <ul className="tr-list">
      {sorted.map((p) => (
        <li key={p.id} className="tr-item">
          <img src={tractiveIcon} alt="" />
          <div className="tr-item__body">
            <div className="tr-item__text">{p.text}</div>
            <div className="tr-item__when">{when(p.createdAt)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

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
