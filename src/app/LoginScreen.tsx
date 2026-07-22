import { useEffect, useRef, useState } from "react";
import type { PersonId } from "../shared/lib/use-current-user";
import type { TimeOfDay } from "../shared/lib/use-time-of-day";
import { verifyCode, type Session } from "../shared/lib/use-session";
import { wallpapers } from "./wallpapers";

const PEOPLE: { id: PersonId; name: string }[] = [
  { id: "irene", name: "Irene" },
  { id: "vicente", name: "Vicente" },
];

const LENGTH = 6;

/**
 * La puerta de entrada: seis dígitos del autenticador.
 *
 * Va antes de la pantalla de bloqueo, no después. Deslizar hacia arriba es un
 * gesto de adorno; lo que de verdad guarda los datos es esto.
 */
export default function LoginScreen({
  onEnter,
  phase,
}: {
  onEnter: (session: Session) => void;
  phase: TimeOfDay;
}) {
  const [who, setWho] = useState<PersonId | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Al elegir persona el teclado sale solo: si no, hay que dar un toque extra
  // en un campo que encima es invisible.
  useEffect(() => {
    if (who) input.current?.focus();
  }, [who]);

  async function send(value: string) {
    if (!who || sending) return;
    setSending(true);
    setError(null);

    const result = await verifyCode(who, value);

    if (result.ok) {
      onEnter(result.session);
      return;
    }

    // El campo se vacía para poder teclear el siguiente código sin borrar a
    // mano; el del autenticador ya habrá cambiado.
    setError(result.message);
    setCode("");
    setSending(false);
    input.current?.focus();
  }

  function onChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, LENGTH);
    setCode(digits);
    if (error) setError(null);
    // Seis dígitos es el código entero: no hace falta un botón de confirmar.
    if (digits.length === LENGTH) void send(digits);
  }

  return (
    <div className="nk-login" style={{ backgroundImage: `url(${wallpapers[phase].lock})` }}>
      <div className="nk-login__panel">
        <p className="nk-login__device">iPug</p>

        {!who ? (
          <>
            <h1 className="nk-login__title">¿Quién eres?</h1>
            <div className="nk-login__people">
              {PEOPLE.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className="nk-btn nk-login__person"
                  onClick={() => setWho(person.id)}
                >
                  {person.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className="nk-login__title">Tu código</h1>
            <p className="nk-login__hint">Los seis dígitos del autenticador.</p>

            {/* El campo real es invisible pero recibe el foco y el teclado; los
                huecos de debajo son sólo el dibujo. Así se aprovecha el teclado
                numérico del móvil sin renunciar al aspecto de la app. */}
            <label className="nk-login__slots">
              <span className="nk-login__label">Código de seis dígitos</span>
              <input
                ref={input}
                className="nk-login__input"
                value={code}
                onChange={(e) => onChange(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={LENGTH}
                disabled={sending}
                aria-invalid={error !== null}
              />
              {Array.from({ length: LENGTH }, (_, i) => (
                <span
                  key={i}
                  className={`nk-login__slot${code.length === i && !sending ? " nk-login__slot--active" : ""}`}
                  aria-hidden="true"
                >
                  {code[i] ?? ""}
                </span>
              ))}
            </label>

            {/* `role="alert"` para que el lector de pantalla lo cante; si no, el
                error es invisible para quien no ve la pantalla. */}
            <p className="nk-login__error" role="alert">
              {error ?? (sending ? "Comprobando…" : "")}
            </p>

            <button
              type="button"
              className="nk-btn nk-btn--ghost nk-btn--sm"
              onClick={() => {
                setWho(null);
                setCode("");
                setError(null);
              }}
            >
              No soy yo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
