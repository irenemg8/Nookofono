import { useMemo, useState } from "react";
import { useRemoteCollection, type Entity } from "../../shared/lib/use-remote-collection";
import type { Recipe } from "../recipes/model/types";
import "./menu.css";

/**
 * Menú semanal.
 *
 * Cada casilla (día + comida) guarda **referencias** a recetas del Recetario:
 * su id y una copia del título. Así, quitar una comida del menú no borra la
 * receta, y borrar la receta del recetario no vacía el menú (queda el título).
 */

type MealSlot = "desayuno" | "comida" | "cena";

interface MealEntry extends Entity {
  /** Día concreto, `YYYY-MM-DD`. */
  date: string;
  meal: MealSlot;
  recipeId: string;
  /** Copia del título por si la receta cambia o se borra. */
  title: string;
}

const MEALS: { id: MealSlot; label: string }[] = [
  { id: "desayuno", label: "Desayuno" },
  { id: "comida", label: "Comida" },
  { id: "cena", label: "Cena" },
];

const DAY_MS = 86_400_000;
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function toKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Lunes de la semana que contiene `d`. */
function mondayOf(d: Date): Date {
  const offset = (d.getDay() + 6) % 7; // 0 = lunes
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
}

export default function MenuApp() {
  const plan = useRemoteCollection<MealEntry>("/api/mealplan");
  const recipes = useRemoteCollection<Recipe>("/api/recipes");

  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [picking, setPicking] = useState<{ date: string; meal: MealSlot } | null>(null);
  const [shopping, setShopping] = useState(false);

  const todayKey = toKey(new Date());
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS)),
    [weekStart],
  );

  const monthLabel = weekStart.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  function entriesFor(dateKey: string, meal: MealSlot) {
    return plan.items.filter((e) => e.date === dateKey && e.meal === meal);
  }

  async function addRecipe(recipe: Recipe) {
    if (!picking) return;
    await plan.create({
      date: picking.date,
      meal: picking.meal,
      recipeId: recipe.id,
      title: recipe.title,
    });
    setPicking(null);
  }

  if (plan.status === "loading") return <p className="mn-empty">Cargando…</p>;
  if (plan.status === "error") return <p className="mn-empty">{plan.error}</p>;

  return (
    <div className="mn">
      <div className="mn-weeknav">
        <button
          type="button"
          className="mn-nav"
          aria-label="Semana anterior"
          onClick={() => setWeekStart((w) => new Date(w.getTime() - 7 * DAY_MS))}
        >
          ‹
        </button>
        <div className="mn-weeknav__label">
          <strong>{toKey(days[0]).slice(8)}–{toKey(days[6]).slice(8)}</strong>
          <span>{monthLabel}</span>
        </div>
        <button
          type="button"
          className="mn-nav"
          aria-label="Semana siguiente"
          onClick={() => setWeekStart((w) => new Date(w.getTime() + 7 * DAY_MS))}
        >
          ›
        </button>
      </div>

      <button type="button" className="nk-btn nk-btn--ghost mn-shopbtn" onClick={() => setShopping(true)}>
        🛒 Compra de la semana
      </button>

      <div className="mn-days">
        {days.map((d, i) => {
          const key = toKey(d);
          return (
            <section key={key} className={`mn-day${key === todayKey ? " mn-day--today" : ""}`}>
              <h2 className="mn-day__head">
                {DAY_NAMES[i]} {d.getDate()}
              </h2>
              <div className="mn-meals">
                {MEALS.map((m) => {
                  const entries = entriesFor(key, m.id);
                  return (
                    <div key={m.id} className="mn-slot">
                      <span className="mn-slot__label">{m.label}</span>
                      <div className="mn-slot__items">
                        {entries.map((e) => (
                          <span key={e.id} className="mn-pill">
                            {e.title}
                            <button
                              type="button"
                              className="mn-pill__x"
                              aria-label={`Quitar ${e.title}`}
                              onClick={() => plan.remove(e.id)}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <button
                          type="button"
                          className="mn-add"
                          onClick={() => setPicking({ date: key, meal: m.id })}
                          aria-label={`Añadir a ${m.label}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {picking && (
        <RecipePicker
          recipes={recipes.items}
          onPick={addRecipe}
          onClose={() => setPicking(null)}
        />
      )}

      {shopping && (
        <ShoppingSheet
          entries={plan.items.filter((e) => {
            const k = e.date;
            return k >= toKey(days[0]) && k <= toKey(days[6]);
          })}
          recipes={recipes.items}
          onClose={() => setShopping(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- selector */

function RecipePicker({
  recipes,
  onPick,
  onClose,
}: {
  recipes: Recipe[];
  onPick: (r: Recipe) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const list = recipes
    .filter((r) => r.title.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="nk-sheet" onPointerDown={onClose}>
      <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
        <header className="nk-sheet__head">
          <h2>Elegir receta</h2>
          <button type="button" className="nk-sheet__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        {recipes.length === 0 ? (
          <p className="mn-empty">No hay recetas todavía. Créalas en el Recetario.</p>
        ) : (
          <>
            <input
              className="mn-search"
              autoFocus
              value={q}
              placeholder="Buscar receta…"
              onChange={(e) => setQ(e.target.value)}
            />
            <ul className="mn-picklist">
              {list.map((r) => (
                <li key={r.id}>
                  <button type="button" className="mn-pick" onClick={() => onPick(r)}>
                    {r.title}
                  </button>
                </li>
              ))}
              {list.length === 0 && <p className="mn-empty">Nada coincide.</p>}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ lista de la compra */

function ShoppingSheet({
  entries,
  recipes,
  onClose,
}: {
  entries: MealEntry[];
  recipes: Recipe[];
  onClose: () => void;
}) {
  // Junta los ingredientes de todas las recetas planificadas esta semana.
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const e of entries) {
    const recipe = byId.get(e.recipeId);
    if (!recipe) continue;
    for (const ing of recipe.ingredients) {
      const key = ing.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        lines.push(ing.trim());
      }
    }
  }
  lines.sort((a, b) => a.localeCompare(b));

  return (
    <div className="nk-sheet" onPointerDown={onClose}>
      <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
        <header className="nk-sheet__head">
          <h2>Compra de la semana</h2>
          <button type="button" className="nk-sheet__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        {lines.length === 0 ? (
          <p className="mn-empty">
            No hay ingredientes: añade recetas al menú (y que tengan ingredientes) para verlos aquí.
          </p>
        ) : (
          <>
            <p className="mn-shop__note">
              Ingredientes de las recetas planificadas, sin repetir. Repasa cantidades a ojo.
            </p>
            <ul className="mn-shop">
              {lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
