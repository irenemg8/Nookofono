import airlinesIcon from "../../assets/airlines.webp";
import sello1 from "../../assets/stamps/sello1.webp";
import sello2 from "../../assets/stamps/sello2.webp";
import sello3 from "../../assets/stamps/sello3.webp";
import { useCurrentUser } from "../../shared/lib/use-current-user";
import { photoOf } from "./model/photos";
import { usePassports } from "./model/use-passports";
import "./profile.css";

/** Máximo del comentario en el juego. Lo respetamos porque es parte del encanto. */
const GREETING_MAX = 24;

const STAMPS = [sello1, sello2, sello3];
/** Cada sello va girado un poco distinto, como si los hubieran ido pegando. */
const ROTATIONS = ["-7deg", "5deg", "-3deg"];

export default function ProfileApp() {
  const me = useCurrentUser();
  const { passports, update } = usePassports();

  const p = passports[me];
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

          <div className="pp-photo">{photo && <img src={photo} alt={p.name} />}</div>

          <div className="pp-fields">
            <label className="pp-field">
              <span>Nombre</span>
              <input value={p.name} onChange={(e) => update(me, { name: e.target.value })} />
            </label>
            <label className="pp-field">
              <span>Isla</span>
              <input value={p.island} onChange={(e) => update(me, { island: e.target.value })} />
            </label>
            <label className="pp-field">
              <span>Fruta autóctona</span>
              <input value={p.fruit} onChange={(e) => update(me, { fruit: e.target.value })} />
            </label>
            <label className="pp-field">
              <span>Cumpleaños</span>
              <input
                value={p.birthday}
                placeholder="29 de octubre"
                onChange={(e) => update(me, { birthday: e.target.value })}
              />
            </label>
          </div>

          <div className="pp-greeting">
            <span>Lema</span>
            <input
              className="pp-bubble"
              value={p.greeting}
              maxLength={GREETING_MAX}
              placeholder="¡Hola!"
              onChange={(e) => update(me, { greeting: e.target.value })}
            />
            <span className="pp-count">
              {p.greeting.length}/{GREETING_MAX}
            </span>
          </div>

          <footer className="pp-foot">
            <span className="pp-rep">🌿 Residente</span>
            <span>Desde {p.since}</span>
          </footer>
        </div>
      </article>
    </div>
  );
}
