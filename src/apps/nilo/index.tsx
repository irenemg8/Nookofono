import { useRef, useState } from "react";
import { useCollection, type Entity } from "../../shared/lib/use-collection";
import { usePet } from "./model/use-pet";
import "./nilo.css";

interface Vaccine extends Entity {
  name: string;
  appliedAt: string;
  expiresAt: string;
}

interface WeightEntry extends Entity {
  measuredAt: string;
  grams: number;
}

type Tab = "ficha" | "vacunas" | "peso";

export default function NiloApp() {
  const { pet, update } = usePet();
  const vaccines = useCollection<Vaccine>("ipug.nilo.vaccines");
  const weights = useCollection<WeightEntry>("ipug.nilo.weights");
  const [tab, setTab] = useState<Tab>("ficha");
  const fileRef = useRef<HTMLInputElement>(null);

  const latest = weights.items[0];
  const age = ageFrom(pet.birthday);

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update({ photo: String(reader.result) });
    reader.readAsDataURL(file);
  }

  return (
    <div className="pug">
      <section className="pug-card">
        <div className="pug-head">
          <button type="button" className="pug-photo" onClick={() => fileRef.current?.click()}>
            {pet.photo ? <img src={pet.photo} alt="" /> : <span>Toca para poner su foto</span>}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />

          <div>
            <h2 className="pug-name">{pet.name}</h2>
            <p className="pug-sub">
              {pet.breed}
              {age && ` · ${age}`}
            </p>
          </div>
        </div>

        <dl className="pug-rows">
          <dt>Nacimiento</dt>
          <dd>
            <input
              type="date"
              value={pet.birthday}
              onChange={(e) => update({ birthday: e.target.value })}
            />
          </dd>

          <dt>Microchip</dt>
          <dd>
            <input
              value={pet.chip}
              placeholder="—"
              onChange={(e) => update({ chip: e.target.value })}
            />
          </dd>

          <dt>Pasaporte</dt>
          <dd>
            <input
              value={pet.passport}
              placeholder="—"
              onChange={(e) => update({ passport: e.target.value })}
            />
          </dd>

          <dt>Veterinario</dt>
          <dd>
            <input
              value={pet.vet}
              placeholder="—"
              onChange={(e) => update({ vet: e.target.value })}
            />
          </dd>
        </dl>

        <div className="pug-stats">
          <span className="pug-stat">
            <ScaleIcon />
            {latest ? `${(latest.grams / 1000).toFixed(1)} kg` : "— kg"}
          </span>
          <span className="pug-stat">
            <SyringeIcon />
            {vaccines.items.length} vacunas
          </span>
        </div>
      </section>

      <div className="pug-tabs" role="tablist">
        {(["ficha", "vacunas", "peso"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "ficha" && (
        <div className="pug-streak">
          <span className="pug-streak__medal">🐾</span>
          <div>
            <div className="pug-streak__n">{pet.walkStreak} días</div>
            <div className="pug-streak__label">de paseos seguidos</div>
          </div>
        </div>
      )}

      {tab === "vacunas" && (
        <>
          <button
            type="button"
            className="nk-btn"
            onClick={() =>
              vaccines.create({
                name: "Vacuna nueva",
                appliedAt: today(),
                expiresAt: inAYear(),
              })
            }
          >
            + Añadir vacuna
          </button>

          {vaccines.items.length === 0 ? (
            <p className="pug-empty">Sin vacunas registradas.</p>
          ) : (
            <ul className="pug-list">
              {vaccines.items.map((v) => {
                const state = expiryState(v.expiresAt);
                return (
                  <li key={v.id} className="pug-item">
                    <div className="pug-item__body">
                      <input
                        className="pug-item__title"
                        value={v.name}
                        onChange={(e) => vaccines.update(v.id, { name: e.target.value })}
                        style={{ border: "none", background: "none", width: "100%" }}
                      />
                      <div className="pug-item__meta">
                        Puesta el {fmt(v.appliedAt)} · caduca el {fmt(v.expiresAt)}
                      </div>
                    </div>
                    <span className={`pug-badge${state ? ` pug-badge--${state}` : ""}`}>
                      {state === "due" ? "Caducada" : state === "soon" ? "Pronto" : "Al día"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {tab === "peso" && (
        <>
          <button
            type="button"
            className="nk-btn"
            onClick={() => weights.create({ measuredAt: today(), grams: latest?.grams ?? 8000 })}
          >
            + Añadir pesaje
          </button>

          {weights.items.length === 0 ? (
            <p className="pug-empty">Sin pesajes registrados.</p>
          ) : (
            <ul className="pug-list">
              {weights.items.map((w) => (
                <li key={w.id} className="pug-item">
                  <div className="pug-item__body">
                    <div className="pug-item__title">{(w.grams / 1000).toFixed(1)} kg</div>
                    <div className="pug-item__meta">{fmt(w.measuredAt)}</div>
                  </div>
                  <input
                    type="range"
                    min={3000}
                    max={15000}
                    step={100}
                    value={w.grams}
                    onChange={(e) => weights.update(w.id, { grams: Number(e.target.value) })}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ utils */

function today() {
  return new Date().toISOString().slice(0, 10);
}

function inAYear() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function fmt(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

/** Caducada, a menos de un mes, o al día. */
function expiryState(iso: string): "due" | "soon" | null {
  if (!iso) return null;
  const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "due";
  if (days < 30) return "soon";
  return null;
}

function ageFrom(iso: string): string | null {
  if (!iso) return null;
  const birth = new Date(iso);
  const months =
    (new Date().getFullYear() - birth.getFullYear()) * 12 +
    (new Date().getMonth() - birth.getMonth());
  if (months < 0) return null;
  if (months < 24) return `${months} meses`;
  return `${Math.floor(months / 12)} años`;
}

function ScaleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3v3M5 8h14l2 11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2L5 8Z" strokeLinejoin="round" />
      <circle cx="12" cy="6" r="2" />
    </svg>
  );
}

function SyringeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m18 2 4 4M20 4 9 15l-4 1 1-4L17 1M7 17l-4 4" strokeLinecap="round" />
    </svg>
  );
}
