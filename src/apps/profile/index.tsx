import airlinesIcon from "../../assets/airlines.webp";
import sello1 from "../../assets/stamps/sello1.webp";
import sello2 from "../../assets/stamps/sello2.webp";
import sello3 from "../../assets/stamps/sello3.webp";
import { useCurrentUser } from "../../shared/lib/use-current-user";
import { photoOf } from "./model/photos";
import { PEOPLE } from "./model/people";
import { useGreetings } from "./model/use-passports";
import "./profile.css";

/** Máximo del comentario en el juego. Lo respetamos porque es parte del encanto. */
const GREETING_MAX = 24;

const STAMPS = [sello1, sello2, sello3];
/** Cada sello va girado un poco distinto, como si los hubieran ido pegando. */
const ROTATIONS = ["-7deg", "5deg", "-3deg"];

export default function ProfileApp() {
  const me = useCurrentUser();
  const { greetings, setGreeting } = useGreetings();

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

          <span className="pp-brand">
            <img src={airlinesIcon} alt="" />
            PugPug Airlines
          </span>
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
              <dd>{person.island || "—"}</dd>
            </div>
            <div className="pp-field">
              <dt>Fruta autóctona</dt>
              <dd>{person.fruit || "—"}</dd>
            </div>
            <div className="pp-field">
              <dt>Cumpleaños</dt>
              <dd>{person.birthday || "—"}</dd>
            </div>
          </dl>

          <div className="pp-greeting">
            <span>Lema</span>
            <input
              className="pp-bubble"
              value={greetings[me]}
              maxLength={GREETING_MAX}
              placeholder="¡Hola!"
              onChange={(e) => setGreeting(me, e.target.value)}
            />
            <span className="pp-count">
              {greetings[me].length}/{GREETING_MAX}
            </span>
          </div>
        </div>
      </article>
    </div>
  );
}
