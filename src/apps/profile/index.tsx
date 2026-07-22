import sello1 from "../../assets/stamps/sello1.webp";
import sello2 from "../../assets/stamps/sello2.webp";
import sello3 from "../../assets/stamps/sello3.webp";
import { useCurrentUser } from "../../shared/lib/use-current-user";
import { photoOf } from "./model/photos";
import { PEOPLE } from "./model/people";
import { usePassport } from "./model/use-passports";
import "./profile.css";

/** Máximo del comentario en el juego. Lo respetamos porque es parte del encanto. */
const GREETING_MAX = 24;

const STAMPS = [sello1, sello2, sello3];
/** Cada sello va girado un poco distinto, como si los hubieran ido pegando. */
const ROTATIONS = ["-7deg", "5deg", "-3deg"];

export default function ProfileApp() {
  const me = useCurrentUser();
  const { passport, setComment, flush, loading } = usePassport();

  // El nombre y la foto siguen en el código: no son datos que se editen, y la
  // foto es un fichero del repositorio, no una fila.
  const person = PEOPLE[me];
  const photo = photoOf(me);

  return (
    <div className="pp">
      <article className="pp-card">
        <header className="pp-cover">
          <div className="pp-stamps">
            {STAMPS.map((stamp, i) => (
              <img
                key={stamp}
                className="pp-stamp"
                src={stamp}
                alt=""
                draggable={false}
                style={{ ["--rot" as string]: ROTATIONS[i] }}
              />
            ))}
          </div>

        {/*  <span className="pp-brand">
            <img src={airlinesIcon} alt="" />
            PugPug Airlines
          </span>*/}
        </header>

        <div className="pp-body">
          <p className="pp-label">Pasaporte</p>

          <div className="pp-photo">{photo && <img src={photo} alt={person.name} />}</div>

          <dl className="pp-fields">
            <div className="pp-field">
              <dt>Nombre</dt>
              <dd>{person.name || "—"}</dd>
            </div>
            <div className="pp-field">
              <dt>Isla</dt>
              <dd>{passport.islandName || "—"}</dd>
            </div>
            <div className="pp-field">
              <dt>Fruta autóctona</dt>
              <dd>{passport.nativeFruit || "—"}</dd>
            </div>
            <div className="pp-field">
              <dt>Cumpleaños</dt>
              <dd>{birthdayLabel(passport.birthday)}</dd>
            </div>
          </dl>

          <div className="pp-greeting">
            <span>Lema</span>
            <input
              className="pp-bubble"
              value={passport.comment}
              maxLength={GREETING_MAX}
              placeholder={loading ? "…" : "¡Hola!"}
              disabled={loading}
              onChange={(e) => setComment(e.target.value)}
              // Al salir del campo se sube ya, sin esperar al retardo.
              onBlur={flush}
            />
            <span className="pp-count">
              {passport.comment.length}/{GREETING_MAX}
            </span>
          </div>
        </div>
      </article>
    </div>
  );
}

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * `MM-DD` → "8 de junio".
 *
 * Sin año, como el pasaporte del juego: lo que importa es el día que hay que
 * felicitar. Se formatea a mano y no con `Intl`, porque construir una fecha
 * exige inventarse un año y eso arrastra husos horarios donde no hacen falta.
 */
function birthdayLabel(value: string): string {
  const match = /^(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "—";

  const month = MONTHS[Number(match[1]) - 1];
  return month ? `${Number(match[2])} de ${month}` : "—";
}
