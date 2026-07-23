import { useState } from "react";
import imbecilIcon from "../../assets/imbecil.webp";
import { notify } from "../../shared/lib/ntfy";
import { useCurrentUser, type PersonId } from "../../shared/lib/use-current-user";
import { useRemoteCollection, type Entity } from "../../shared/lib/use-remote-collection";
import "./imbecil.css";

const TOPIC = "ipug-imbecil-8f3d5b1c609a";

interface Ping extends Entity {
  from: PersonId;
  text: string;
  emoji: string;
}

/** Los avisos que puede mandar Irene. */
const IRENE_OPTIONS = [
  { emoji: "🔪", text: "Belinda me está apuñalando" },
  { emoji: "🥺", text: "Belinda está muy necesitada" },
  { emoji: "😡", text: "Belinda está enfadada contigo, más te vale venir y arreglarlo" },
];

/** El aviso de Vicente. */
const VICENTE_MESSAGE = { emoji: "🥒", text: "Cosita está necesitado" };

export default function ImbecilApp() {
  const me = useCurrentUser();
  const pings = useRemoteCollection<Ping>("/api/imbecil");
  const [tab, setTab] = useState<"enviar" | "historial">("enviar");
  const [choice, setChoice] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const outgoing = me === "irene" ? IRENE_OPTIONS[choice] : VICENTE_MESSAGE;
  const targetName = me === "irene" ? "Vicente" : "Irene";

  async function send() {
    setSending(true);
    setError(null);
    try {
      const ok = await notify({
        topic: TOPIC,
        title: "Imbécil",
        body: outgoing.text,
        priority: "urgent",
        tags: [me === "irene" ? "drop_of_blood" : "cucumber"],
      });
      if (!ok) throw new Error();
      await pings.create({ from: me, text: outgoing.text, emoji: outgoing.emoji });
      setCooldown(30);
      const t = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(t);
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
    <div className="im">
      <div className="im-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "enviar"} onClick={() => setTab("enviar")}>
          Avisar
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

      {tab === "enviar" ? (
        <>
          <section className="im-panel">
            <p className="im-say">
              {outgoing.emoji} {outgoing.text}
            </p>

            {me === "irene" && (
              <div className="im-picker">
                {IRENE_OPTIONS.map((o, i) => (
                  <button
                    key={i}
                    type="button"
                    className="im-option"
                    aria-pressed={choice === i}
                    onClick={() => setChoice(i)}
                  >
                    <span className="im-option__emoji">{o.emoji}</span>
                    {o.text}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              className="im-btn"
              onClick={send}
              disabled={sending || cooldown > 0}
              aria-label={`Avisar a ${targetName}`}
            >
              <img src={imbecilIcon} alt="" draggable={false} />
            </button>

            <div className="im-caption">
              <b>{sending ? "Avisando…" : cooldown > 0 ? "Aviso enviado" : `Avisar a ${targetName}`}</b>
              <span>{cooldown > 0 ? `Puedes repetir en ${cooldown} s` : "Le llega al momento"}</span>
            </div>

            {error && <p className="im-error">{error}</p>}
          </section>

          <div className="im-setup">
            <h3>Para que le suene a {targetName}</h3>
            {targetName} necesita la app <b>ntfy</b> instalada y suscrita a este canal:
            <code>{TOPIC}</code>
          </div>
        </>
      ) : (
        <History pings={pings.items} />
      )}
    </div>
  );
}

function History({ pings }: { pings: Ping[] }) {
  const sorted = [...pings].sort((a, b) => b.createdAt - a.createdAt);
  if (sorted.length === 0) return <p className="im-empty">Todavía nadie ha llamado imbécil al otro.</p>;

  return (
    <ul className="im-list">
      {sorted.map((p) => (
        <li key={p.id} className="im-item">
          <span className="im-item__emoji">{p.emoji}</span>
          <div className="im-item__body">
            <div className="im-item__text">{p.text}</div>
            <div className="im-item__when">
              {p.from === "irene" ? "Irene" : "Vicente"} · {when(p.createdAt)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function when(at: number): string {
  const mins = Math.floor((Date.now() - at) / 60_000);
  if (mins < 1) return "ahora mismo";
  if (mins < 60) return `hace ${mins} min`;
  if (mins < 24 * 60) return `hace ${Math.floor(mins / 60)} h`;
  return new Date(at).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
