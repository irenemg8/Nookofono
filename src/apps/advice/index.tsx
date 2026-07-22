import { useEffect, useRef, useState } from "react";
import valentinIcon from "../../assets/Valentin_consejos.webp";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { hasModel } from "./model/brain";
import { titleOf, useChats, type Conversation } from "./model/use-chat";
import "./advice.css";

/** Velocidad del texto de Valentín, en milisegundos por carácter. */
const TYPE_MS = 24;

export default function AdviceApp() {
  const { chats, active, thinking, send, create, open, remove } = useChats();
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState(false);
  const [pending, setPending] = useState<Conversation | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // El último mensaje siempre a la vista, también mientras escribe él.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages, thinking]);

  const messages = active?.messages ?? [];
  const last = messages[messages.length - 1];

  function submit() {
    send(draft);
    setDraft("");
  }

  return (
    <div className="va">
      {/* Los dos botones flotan sobre la conversación: así no gastan altura. */}
      <div className="va-bar">
        <button type="button" onClick={create} aria-label="Conversación nueva">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-label="Conversaciones"
          aria-expanded={menu}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="va-log" ref={logRef}>
        {messages.map((m) =>
          m.role === "valentin" ? (
            <div className="va-turn" key={m.id}>
              <img className="va-face" src={valentinIcon} alt="" />
              <div className="va-said">
                <span className="va-said__name">Valentín</span>
                <div className="va-bubble">
                  {/* Sólo se teclea el último: los antiguos ya se leyeron. */}
                  {m.id === last?.id ? <Typed text={m.text} /> : m.text}
                </div>
              </div>
            </div>
          ) : (
            <div className="va-turn va-turn--user" key={m.id}>
              <div className="va-said">
                <div className="va-bubble">{m.text}</div>
              </div>
            </div>
          ),
        )}

        {thinking && (
          <div className="va-turn">
            <img className="va-face" src={valentinIcon} alt="" />
            <div className="va-said">
              <span className="va-said__name">Valentín</span>
              <div className="va-bubble">
                <span className="va-dots" aria-label="Escribiendo">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="va-compose">
        <textarea
          value={draft}
          placeholder="Cuéntale…"
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter envía; Mayús+Enter hace salto de línea.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          className="va-send"
          onClick={submit}
          disabled={!draft.trim() || thinking}
          aria-label="Enviar"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
          </svg>
        </button>
      </div>

      {!hasModel && <p className="va-note">Valentín todavía no tiene modelo entrenado.</p>}

      {menu && (
        <div className="va-drawer" onPointerDown={() => setMenu(false)}>
          <aside className="va-drawer__panel" onPointerDown={(e) => e.stopPropagation()}>
            <header>
              <h2>Conversaciones</h2>
              <button type="button" onClick={() => setMenu(false)} aria-label="Cerrar">
                ×
              </button>
            </header>

            <ul>
              {chats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`va-chat${c.id === active?.id ? " va-chat--on" : ""}`}
                    onClick={() => {
                      open(c.id);
                      setMenu(false);
                    }}
                  >
                    <span className="va-chat__title">{titleOf(c)}</span>
                    <span className="va-chat__when">{when(c.updatedAt)}</span>
                  </button>

                  <button
                    type="button"
                    className="va-chat__x"
                    onClick={() => setPending(c)}
                    aria-label="Borrar conversación"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}

      {pending && (
        <ConfirmDialog
          title="¿Borrar esta conversación?"
          body={`Se borrará «${titleOf(pending)}» y todo lo que os dijisteis en ella.`}
          confirmLabel="Borrar"
          onConfirm={() => {
            remove(pending.id);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

/**
 * Texto que aparece letra a letra, como los diálogos del juego.
 * Al tocarlo se completa de golpe, que es lo que hace el juego con el botón A.
 */
function Typed({ text }: { text: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, TYPE_MS);
    return () => clearInterval(id);
  }, [text]);

  const done = shown >= text.length;

  return (
    <span onClick={() => setShown(text.length)}>
      {text.slice(0, shown)}
      {!done && <span className="va-caret" />}
    </span>
  );
}

function when(at: number): string {
  const mins = Math.floor((Date.now() - at) / 60_000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  if (mins < 24 * 60) return `Hace ${Math.floor(mins / 60)} h`;
  return new Date(at).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
