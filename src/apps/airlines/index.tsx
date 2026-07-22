import { useState } from "react";
import airlinesIcon from "../../assets/airlines.webp";
import { useCollection, type Entity } from "../../shared/lib/use-collection";
import { ConfirmDialog, RemoveBadge } from "../../shared/ui/ConfirmDialog";
import "./airlines.css";

/** Valencia es siempre el origen. */
const HOME = { code: "VLC", name: "Valencia" };

interface Destination extends Entity {
  name: string;
  visited: boolean;
  visitedAt: string | null;
}

export default function AirlinesApp() {
  const trips = useCollection<Destination>("ipug.destinations");
  const [draft, setDraft] = useState("");
  const [pendingRemove, setPendingRemove] = useState<Destination | null>(null);

  function add() {
    const name = draft.trim();
    if (!name) return;
    trips.create({ name, visited: false, visitedAt: null });
    setDraft("");
  }

  function toggle(t: Destination) {
    trips.update(t.id, {
      visited: !t.visited,
      visitedAt: t.visited ? null : new Date().toISOString(),
    });
  }

  return (
    <div className="pa">
      <div className="pa-add">
        <input
          value={draft}
          placeholder="¿A dónde vamos?"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button type="button" className="nk-btn" onClick={add}>
          Añadir
        </button>
      </div>
{/*
      <div className="pa-summary">
        <div>
          <b>{visited}</b>
          <span>visitados</span>
        </div>
        <div>
          <b>{trips.items.length - visited}</b>
          <span>pendientes</span>
        </div>
        <div>
          <b>{trips.items.length}</b>
          <span>en la lista</span>
        </div>
      </div>*/}

      {trips.items.length === 0 ? (
        <p className="pa-empty">Todavía no hay ningún destino apuntado.</p>
      ) : (
        <ul className="pa-list">
          {trips.items.map((t) => (
            <li key={t.id}>
              <article className={`pa-pass${t.visited ? " pa-pass--visited" : ""}`}>
                <div className="pa-pass__main">
                  <div className="pa-pass__brand">
                    <img src={airlinesIcon} alt="" />
                    PugPug Airlines · Tarjeta de embarque
                  </div>

                  <div className="pa-route">
                    <span className="pa-route__code">{HOME.code}</span>
                    <span className="pa-route__arrow">✈</span>
                    <span className="pa-route__code">{codeOf(t.name)}</span>
                  </div>

                  <p className="pa-pass__name">{t.name}</p>

                  <div className="pa-pass__meta">
                    <div>
                      Origen
                      <b>{HOME.name}</b>
                    </div>
                    <div>
                      Estado
                      <b>{t.visited ? "Aterrizado" : "Pendiente"}</b>
                    </div>
                    <div>
                      Vuelo
                      <b>PP-{flightNumber(t.id)}</b>
                    </div>
                  </div>

                  {t.visited && <span className="pa-stamp">Visitado</span>}
                </div>

                <div className="pa-pass__stub">
                  <button
                    type="button"
                    className="pa-check"
                    aria-pressed={t.visited}
                    aria-label={t.visited ? "Marcar como pendiente" : "Marcar como visitado"}
                    onClick={() => toggle(t)}
                  >
                    ✓
                  </button>
                  <span className="pa-pass__flight">PP-{flightNumber(t.id)}</span>
                </div>

                <RemoveBadge
                  danger
                  label={`Quitar ${t.name}`}
                  onRemove={() => setPendingRemove(t)}
                />
              </article>
            </li>
          ))}
        </ul>
      )}

      {pendingRemove && (
        <ConfirmDialog
          title="¿Quitar este destino?"
          body={`Se borrará ${pendingRemove.name} de la lista de vuelos, junto con su marca de visitado.`}
          onConfirm={() => {
            trips.remove(pendingRemove.id);
            setPendingRemove(null);
          }}
          onCancel={() => setPendingRemove(null)}
        />
      )}
    </div>
  );
}

/** Código de tres letras a partir del nombre, como los de aeropuerto. */
function codeOf(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  return (clean.slice(0, 3) || "???").padEnd(3, "X");
}

/** Número de vuelo estable, derivado del id para que no cambie en cada render. */
function flightNumber(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) % 9000;
  return String(1000 + hash);
}
