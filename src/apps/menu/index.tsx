import { useMemo, useState } from "react";
import { useRemoteCollection, type Entity } from "../../shared/lib/use-remote-collection";
import { toIngredient, type Recipe } from "../recipes/model/types";
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
        <svg
          className="mn-shopbtn__icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="8" cy="21" r="1" />
          <circle cx="19" cy="21" r="1" />
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
        Compra de la semana
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

interface ShopLine {
  text: string;
  productId: string | null;
}

function ShoppingSheet({
  entries,
  recipes,
  onClose,
}: {
  entries: MealEntry[];
  recipes: Recipe[];
  onClose: () => void;
}) {
  // Junta los ingredientes de todas las recetas planificadas esta semana, sin
  // repetir. Cada uno conserva su enlace a producto de Mercadona (si lo tiene),
  // que es lo que permite meterlo en el carrito de la app Compra.
  const lines = useMemo<ShopLine[]>(() => {
    const byId = new Map(recipes.map((r) => [r.id, r]));
    const seen = new Set<string>();
    const out: ShopLine[] = [];
    for (const e of entries) {
      const recipe = byId.get(e.recipeId);
      if (!recipe) continue;
      for (const raw of recipe.ingredients) {
        const ing = toIngredient(raw);
        const text = ing.text.trim();
        const key = text.toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          out.push({ text, productId: ing.productId ?? null });
        }
      }
    }
    return out.sort((a, b) => a.text.localeCompare(b.text));
  }, [entries, recipes]);

  // Ids ya añadidos en esta sesión del panel, para no añadir dos veces y dar
  // feedback ("Añadido"). El carrito real es la fuente de verdad; esto es sólo
  // el estado de los botones mientras el panel está abierto.
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkable = lines.filter((l) => l.productId);
  const pending = linkable.filter((l) => !added.has(l.productId!));

  async function addToCart(productId: string) {
    try {
      const res = await fetch("/api/mercadona/cart", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setAdded((prev) => new Set(prev).add(productId));
      setError(null);
    } catch {
      setError("No se pudo añadir al carrito. Comprueba la conexión.");
    }
  }

  async function addAll() {
    setBusy(true);
    for (const l of pending) await addToCart(l.productId!);
    setBusy(false);
  }

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
              Ingredientes de las recetas de esta semana. Los que están enlazados a un producto de
              Mercadona se pueden añadir al carrito de la app Compra.
            </p>

            {linkable.length > 0 && (
              <button
                type="button"
                className="nk-btn mn-shop__all"
                onClick={addAll}
                disabled={busy || pending.length === 0}
              >
                {pending.length === 0
                  ? "Todo en el carrito"
                  : `Añadir todo al carrito (${pending.length})`}
              </button>
            )}
            {error && <p className="mn-shop__err">{error}</p>}

            <ul className="mn-shop">
              {lines.map((l, i) => {
                const inCart = l.productId ? added.has(l.productId) : false;
                return (
                  <li key={i} className="mn-shop__row">
                    <span className={l.productId ? "" : "mn-shop__free"}>{l.text}</span>
                    {l.productId ? (
                      <button
                        type="button"
                        className="nk-btn nk-btn--ghost mn-shop__add"
                        onClick={() => addToCart(l.productId!)}
                        disabled={inCart}
                      >
                        {inCart ? "Añadido" : "+ Carrito"}
                      </button>
                    ) : (
                      <span className="mn-shop__note-tag">solo texto</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
