import { useRef, useState } from "react";
import airlinesIcon from "../../assets/airlines.webp";
import { usePassports, type PersonId } from "./model/use-passports";
import "./profile.css";

const PEOPLE: { id: PersonId; label: string }[] = [
  { id: "irene", label: "Irene" },
  { id: "vicente", label: "Vicente" },
];

/** Máximo del comentario en el juego. Lo respetamos porque es parte del encanto. */
const GREETING_MAX = 24;

export default function ProfileApp() {
  const { passports, update } = usePassports();
  const [who, setWho] = useState<PersonId>("irene");
  const fileRef = useRef<HTMLInputElement>(null);

  const p = passports[who];

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update(who, { photo: String(reader.result) });
    reader.readAsDataURL(file);
  }

  return (
    <div className="pp">
      <div className="pp-switch">
        {PEOPLE.map((person) => (
          <button
            key={person.id}
            type="button"
            aria-pressed={who === person.id}
            onClick={() => setWho(person.id)}
          >
            {person.label}
          </button>
        ))}
      </div>

      <article className="pp-card">
        <header className="pp-cover">
          <div className="pp-stamps">
            <span className="pp-stamp pp-stamp--round" style={{ ["--rot" as string]: "-8deg" }}>
              Llegada
            </span>
            <span className="pp-stamp pp-stamp--visa" style={{ ["--rot" as string]: "5deg" }}>
              Visado aprobado
            </span>
            <span className="pp-stamp pp-stamp--departure" style={{ ["--rot" as string]: "-4deg" }}>
              Salida
            </span>
            <span className="pp-stamp" style={{ ["--rot" as string]: "7deg" }}>
              Inmigración
            </span>
          </div>

          <span className="pp-brand">
            <img src={airlinesIcon} alt="" />
            PugPug Airlines
          </span>
        </header>

        <div className="pp-body">
          <p className="pp-label">Pasaporte</p>

          <button type="button" className="pp-photo" onClick={() => fileRef.current?.click()}>
            {p.photo ? <img src={p.photo} alt="" /> : <span>Toca para poner tu foto</span>}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />

          <div className="pp-fields">
            <label className="pp-field">
              <span>Nombre</span>
              <input value={p.name} onChange={(e) => update(who, { name: e.target.value })} />
            </label>
            <label className="pp-field">
              <span>Isla</span>
              <input value={p.island} onChange={(e) => update(who, { island: e.target.value })} />
            </label>
            <label className="pp-field">
              <span>Fruta autóctona</span>
              <input value={p.fruit} onChange={(e) => update(who, { fruit: e.target.value })} />
            </label>
            <label className="pp-field">
              <span>Cumpleaños</span>
              <input
                value={p.birthday}
                placeholder="29 de octubre"
                onChange={(e) => update(who, { birthday: e.target.value })}
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
              onChange={(e) => update(who, { greeting: e.target.value })}
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
