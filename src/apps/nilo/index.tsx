import { useState } from "react";
import {
  msFrom,
  toEntity,
  useRemoteCollection,
  type Entity,
} from "../../shared/lib/use-remote-collection";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { PET, ageOf } from "./model/pet";
import { useWalk } from "./model/use-walk";
import { WeightChart } from "./ui/WeightChart";
import "./nilo.css";

interface Vaccine extends Entity {
  name: string;
  appliedAt: string;
  notes: string;
}

interface WeightEntry extends Entity {
  measuredAt: string;
  grams: number;
}

interface Walk extends Entity {
  startedAt: number;
  durationSec: number;
  steps: number;
  distanceM: number;
}

type Tab = "ficha" | "vacunas" | "peso" | "paseos";
const TABS: Tab[] = ["ficha", "vacunas", "peso", "paseos"];

/**
 * Un paseo empieza en un instante concreto, así que la tabla lo guarda como
 * marca de tiempo y lo devuelve en ISO. La pantalla lleva epoch desde que se
 * escribió (`new Date(w.startedAt)`), y cambiarla sólo por esto no compensa:
 * se traduce aquí.
 */
const WALK_MAPPER = {
  fromApi: (row: Record<string, unknown>) =>
    ({ ...toEntity(row), startedAt: msFrom(row.startedAt) }) as unknown as Walk,
  toApi: (data: Record<string, unknown>) => ({
    ...data,
    ...(data.startedAt !== undefined
      ? { startedAt: new Date(data.startedAt as number).toISOString() }
      : {}),
  }),
};

export default function NiloApp() {
  const vaccines = useRemoteCollection<Vaccine>("/api/vaccines");
  const weights = useRemoteCollection<WeightEntry>("/api/weights");
  const walks = useRemoteCollection<Walk>("/api/walks", WALK_MAPPER);
  const [tab, setTab] = useState<Tab>("ficha");

  const sortedWeights = [...weights.items].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
  const latest = sortedWeights[0];
  const age = ageOf(PET.birthday);

  return (
    <div className="pug">
      <section className="pug-card">
        <div className="pug-head">
          <div className="pug-photo">{PET.photo && <img src={PET.photo} alt={PET.name} />}</div>
          <div>
            <h2 className="pug-name">{PET.name}</h2>
            <p className="pug-sub">
              {PET.breed}
              {age && ` · ${age}`}
            </p>
          </div>
        </div>

        <dl className="pug-rows">
          <dt>Nacimiento</dt>
          <dd>{PET.birthday ? longDate(PET.birthday) : "—"}</dd>
          <dt>Microchip</dt>
          <dd className="pug-mono">{PET.chip || "—"}</dd>
         {/* <dt>Pasaporte</dt>
          <dd className="pug-mono">{PET.passport || "—"}</dd>*/}
          <dt>Veterinaria</dt>
          <dd>{PET.vet || "—"}</dd>
        </dl>

        <div className="pug-stats">
          <span className="pug-stat">{latest ? `${(latest.grams / 1000).toFixed(1)} kg` : "— kg"}</span>
          <span className="pug-stat">{vaccines.items.length} vacunas</span>
          <span className="pug-stat">{walks.items.length} paseos</span>
        </div>
      </section>

      <div className="pug-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "ficha" && <Summary walks={walks.items} />}
      {tab === "vacunas" && <Vaccines store={vaccines} />}
      {tab === "peso" && <Weights store={weights} sorted={sortedWeights} />}
      {tab === "paseos" && <Walks store={walks} />}
    </div>
  );
}

/* ------------------------------------------------------------------ resumen */

function Summary({ walks }: { walks: Walk[] }) {
  const totalKm = walks.reduce((sum, w) => sum + w.distanceM, 0) / 1000;

  return (
    <div className="pug-streak">
      <span className="pug-streak__medal">🐾</span>
      <div>
        <div className="pug-streak__n">{totalKm.toFixed(1)} km</div>
        <div className="pug-streak__label">paseados en total</div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- vacunas */

function Vaccines({ store }: { store: ReturnType<typeof useRemoteCollection<Vaccine>> }) {
  const [form, setForm] = useState({ name: "", appliedAt: today(), notes: "" });
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Vaccine | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    store.create({ ...form, name: form.name.trim() });
    setForm({ name: "", appliedAt: today(), notes: "" });
    setAdding(false);
  }

  const sorted = [...store.items].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));

  return (
    <>
      {adding ? (
        <form className="pug-form" onSubmit={submit}>
          <label>
            <span>Vacuna</span>
            <input
              autoFocus
              value={form.name}
              placeholder="Rabia, polivalente…"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>

          <label>
            <span>Puesta el</span>
            <input
              type="date"
              value={form.appliedAt}
              onChange={(e) => setForm({ ...form, appliedAt: e.target.value })}
            />
          </label>

          <label>
            <span>Notas</span>
            <input
              value={form.notes}
              placeholder="Lote, veterinario…"
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>

          <div className="pug-form__actions">
            <button type="button" className="nk-btn nk-btn--ghost" onClick={() => setAdding(false)}>
              Cancelar
            </button>
            <button type="submit" className="nk-btn">
              Guardar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="nk-btn" onClick={() => setAdding(true)}>
          + Añadir vacuna
        </button>
      )}

      {sorted.length === 0 ? (
        <p className="pug-empty">Sin vacunas registradas.</p>
      ) : (
        <ul className="pug-list">
          {sorted.map((v) => (
            <li key={v.id} className="pug-item">
              <div className="pug-item__body">
                <div className="pug-item__title">{v.name}</div>
                <div className="pug-item__meta">
                  Puesta el {shortDate(v.appliedAt)}
                  {v.notes && ` · ${v.notes}`}
                </div>
              </div>
              <button type="button" className="pug-x" onClick={() => setPending(v)} aria-label="Quitar">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <ConfirmDialog
          title="¿Borrar esta vacuna?"
          body={`Se borrará el registro de ${pending.name}.`}
          confirmLabel="Borrar"
          onConfirm={() => {
            store.remove(pending.id);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------- peso */

function Weights({
  store,
  sorted,
}: {
  store: ReturnType<typeof useRemoteCollection<WeightEntry>>;
  sorted: WeightEntry[];
}) {
  const [kg, setKg] = useState("");
  const [when, setWhen] = useState(today());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(kg.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    store.create({ measuredAt: when, grams: Math.round(value * 1000) });
    setKg("");
  }

  return (
    <>
      <WeightChart points={sorted.map((w) => ({ id: w.id, at: w.measuredAt, grams: w.grams }))} />

      <form className="pug-form pug-form--inline" onSubmit={submit}>
        <label>
          <span>Peso (kg)</span>
          <input
            inputMode="decimal"
            value={kg}
            placeholder="8,4"
            onChange={(e) => setKg(e.target.value)}
          />
        </label>
        <label>
          <span>Fecha</span>
          <input type="date" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <button type="submit" className="nk-btn">
          Añadir
        </button>
      </form>

      {sorted.length === 0 ? (
        <p className="pug-empty">Sin pesajes registrados.</p>
      ) : (
        <ul className="pug-list">
          {sorted.map((w) => (
            <li key={w.id} className="pug-item">
              <div className="pug-item__body">
                <div className="pug-item__title">{(w.grams / 1000).toFixed(1)} kg</div>
                <div className="pug-item__meta">{longDate(w.measuredAt)}</div>
              </div>
              <button type="button" className="pug-x" onClick={() => store.remove(w.id)} aria-label="Quitar">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ paseos */

function Walks({ store }: { store: ReturnType<typeof useRemoteCollection<Walk>> }) {
  const { live, start, stop } = useWalk();

  function finish() {
    const r = stop();
    if (r.durationSec >= 10) {
      store.create({
        startedAt: r.startedAt,
        durationSec: r.durationSec,
        steps: r.steps,
        distanceM: r.distanceM,
      });
    }
  }

  return (
    <>
      <div className={`pug-walk${live.running ? " pug-walk--on" : ""}`}>
        <div className="pug-walk__timer">{clock(live.seconds)}</div>
        <div className="pug-walk__stats">
          <div>
            <b>{live.steps}</b>
            <span>pasos</span>
          </div>
          <div>
            <b>{(live.distanceM / 1000).toFixed(2)}</b>
            <span>km</span>
          </div>
        </div>

        {live.running ? (
          <button type="button" className="nk-btn nk-btn--danger" onClick={finish}>
            Terminar paseo
          </button>
        ) : (
          <button type="button" className="nk-btn" onClick={start}>
            Empezar paseo
          </button>
        )}

        {live.running && (
          <p className="pug-walk__warn">
            {live.stepsProblem
              ? `${live.stepsProblem}: solo se medirá la distancia.`
              : "Mantén la pantalla encendida y el móvil encima: los pasos se estiman con el acelerómetro."}
          </p>
        )}
      </div>

      {store.items.length === 0 ? (
        <p className="pug-empty">Todavía no habéis registrado ningún paseo.</p>
      ) : (
        <ul className="pug-list">
          {store.items.map((w) => (
            <li key={w.id} className="pug-item">
              <div className="pug-item__body">
                <div className="pug-item__title">
                  {clock(w.durationSec)} · {(w.distanceM / 1000).toFixed(2)} km
                </div>
                <div className="pug-item__meta">
                  {new Date(w.startedAt).toLocaleString("es-ES", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {w.steps > 0 && ` · ~${w.steps} pasos`}
                </div>
              </div>
              <button type="button" className="pug-x" onClick={() => store.remove(w.id)} aria-label="Quitar">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ------------------------------------------------------------------- utils */

function today() {
  return new Date().toISOString().slice(0, 10);
}

function shortDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function longDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

