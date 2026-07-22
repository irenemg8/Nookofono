import { useEffect, useRef, useState } from "react";
import valentinIcon from "../../assets/Valentin_consejos.webp";
import { useCurrentUser } from "../../shared/lib/use-current-user";
import { hasModel } from "./model/brain";
import { useChat } from "./model/use-chat";
import "./advice.css";

/** Velocidad del texto de Valentín, en milisegundos por carácter. */
const TYPE_MS = 24;

export default function AdviceApp() {
  const me = useCurrentUser();
  const { messages, send, thinking, clear } = useChat();
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  // El último mensaje siempre a la vista, también mientras se escribe.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const last = messages[messages.length - 1];

  function submit() {
    send(draft);
    setDraft("");
  }

  return (
    <div className="va">
      <header className="va-head">
        <img src={valentinIcon} alt="" />
        <div className="va-head__body">
          <div className="va-head__name">Valentín</div>
          <div className="va-head__role">
            {me === "vicente" ? "Tu hijo, con algo que decirte" : "El hijo de Vicente"}
          </div>
        </div>
        <button type="button" onClick={clear}>
          Borrar
        </button>
      </header>

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
