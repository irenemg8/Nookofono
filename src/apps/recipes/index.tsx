import { useEffect, useMemo, useRef, useState } from "react";
import { useRemoteCollection } from "../../shared/lib/use-remote-collection";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import {
  EQUIPMENT_TAGS,
  OTHER_TAGS,
  TIME_STEPS,
  timeLabel,
  toIngredient,
  type Ingredient,
  type Recipe,
} from "./model/types";
import "./recipes.css";

/** Producto del catálogo de Mercadona, tal como lo devuelve el backend. */
interface Product {
  id: string;
  name: string;
  packaging: string;
  thumbnail: string;
  priceCents: number;
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) throw new Error("request failed");
  if (res.status === 204) return undefined as T;
  return res.json();
}

export default function RecipesApp() {
  const recipes = useRemoteCollection<Recipe>("/api/recipes");
  const [editing, setEditing] = useState<Recipe | "new" | null>(null);
  const [viewing, setViewing] = useState<Recipe | null>(null);
  const [pending, setPending] = useState<Recipe | null>(null);

  // Filtros
  const [query, setQuery] = useState("");
  const [maxTime, setMaxTime] = useState(0); // 0 = cualquiera
  const [tags, setTags] = useState<string[]>([]);

  // Todas las etiquetas que existen de verdad en las recetas, para el filtro.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    recipes.items.forEach((r) => r.tags.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [recipes.items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.items
      .filter((r) => {
        if (maxTime > 0 && (r.timeMin === 0 || r.timeMin > maxTime)) return false;
        if (tags.length && !tags.every((t) => r.tags.includes(t))) return false;
        if (q) {
          const ingredientsText = r.ingredients.map((ing) => toIngredient(ing).text).join(" ");
          const hay = (r.title + " " + ingredientsText).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
  }, [recipes.items, query, maxTime, tags]);

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function save(data: RecipeDraft, existing: Recipe | "new") {
    setEditing(null);
    if (existing === "new") {
      await recipes.create({ ...data, position: recipes.items.length });
    } else {
      await recipes.update(existing.id, data);
    }
  }

  if (recipes.status === "loading") return <p className="rc-empty">Cargando…</p>;
  if (recipes.status === "error") return <p className="rc-empty">{recipes.error}</p>;

  if (editing) {
    return (
      <RecipeForm
        initial={editing === "new" ? null : editing}
        onCancel={() => setEditing(null)}
        onSave={(d) => save(d, editing)}
      />
    );
  }

  if (viewing) {
    return (
      <RecipeView
        recipe={viewing}
        onBack={() => setViewing(null)}
        onEdit={() => {
          setEditing(viewing);
          setViewing(null);
        }}
        onDelete={() => setPending(viewing)}
      />
    );
  }

  return (
    <div className="rc">
      <button type="button" className="rc-new" onClick={() => setEditing("new")}>
        + Nueva receta
      </button>

      <input
        className="rc-search"
        value={query}
        placeholder="Buscar por título o ingrediente…"
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="rc-filters">
        <div className="rc-chips">
          {TIME_STEPS.map((t) => (
            <button
              key={t}
              type="button"
              className="rc-chip"
              aria-pressed={maxTime === t}
              onClick={() => setMaxTime((prev) => (prev === t ? 0 : t))}
            >
              ≤ {t} min
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="rc-chips">
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                className="rc-chip rc-chip--tag"
                aria-pressed={tags.includes(t)}
                onClick={() => toggleTag(t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {recipes.items.length === 0 ? (
        <p className="rc-empty">Aún no hay recetas. Añade la primera.</p>
      ) : filtered.length === 0 ? (
        <p className="rc-empty">Ninguna receta con esos filtros.</p>
      ) : (
        <ul className="rc-list">
          {filtered.map((r) => (
            <li key={r.id}>
              <button type="button" className="rc-card" onClick={() => setViewing(r)}>
                <div className="rc-card__body">
                  <strong className="rc-card__title">{r.title}</strong>
                  <div className="rc-card__meta">
                    {r.timeMin > 0 && <span className="rc-time">⏱ {timeLabel(r.timeMin)}</span>}
                    <span>{r.ingredients.length} ingr.</span>
                  </div>
                  {r.tags.length > 0 && (
                    <div className="rc-card__tags">
                      {r.tags.map((t) => (
                        <span key={t} className="rc-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <ConfirmDialog
          title="¿Borrar esta receta?"
          body={`Se borra «${pending.title}» del recetario. Si está en algún menú, se queda ahí como título.`}
          confirmLabel="Borrar"
          onConfirm={() => {
            recipes.remove(pending.id);
            setPending(null);
            setViewing(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- vista */

function RecipeView({
  recipe,
  onBack,
  onEdit,
  onDelete,
}: {
  recipe: Recipe;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rc-view">
      <div className="rc-view__bar">
        <button type="button" className="nk-btn nk-btn--ghost" onClick={onBack}>
          ← Volver
        </button>
        <div className="rc-view__acts">
          <button type="button" className="nk-btn nk-btn--ghost" onClick={onEdit}>
            Editar
          </button>
          <button type="button" className="nk-btn nk-btn--danger" onClick={onDelete}>
            Borrar
          </button>
        </div>
      </div>

      <h2 className="rc-view__title">{recipe.title}</h2>
      <div className="rc-view__meta">
        {recipe.timeMin > 0 && <span className="rc-time">⏱ {timeLabel(recipe.timeMin)}</span>}
        {recipe.tags.map((t) => (
          <span key={t} className="rc-tag">
            {t}
          </span>
        ))}
      </div>

      {recipe.ingredients.length > 0 && (
        <section className="rc-view__sec">
          <h3>Ingredientes</h3>
          <ul className="rc-ingr">
            {recipe.ingredients.map((ing, i) => (
              <li key={i}>{toIngredient(ing).text}</li>
            ))}
          </ul>
        </section>
      )}

      {recipe.steps.trim() && (
        <section className="rc-view__sec">
          <h3>Preparación</h3>
          <p className="rc-steps">{recipe.steps}</p>
        </section>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- editor */

interface RecipeDraft {
  title: string;
  ingredients: Ingredient[];
  timeMin: number;
  tags: string[];
  steps: string;
}

function RecipeForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: Recipe | null;
  onCancel: () => void;
  onSave: (data: RecipeDraft) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    (initial?.ingredients ?? []).map(toIngredient)
  );
  const [newIngredient, setNewIngredient] = useState("");
  const [linkingIndex, setLinkingIndex] = useState<number | null>(null);
  const [timeMin, setTimeMin] = useState(initial?.timeMin ?? 0);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [steps, setSteps] = useState(initial?.steps ?? "");
  const [customTag, setCustomTag] = useState("");

  function addIngredient() {
    const text = newIngredient.trim();
    if (!text) return;
    setIngredients((prev) => [...prev, { text, productId: null }]);
    setNewIngredient("");
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function linkIngredient(index: number, product: Product) {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { text: product.name, productId: product.id } : ing))
    );
    setLinkingIndex(null);
  }

  function unlinkIngredient(index: number) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, productId: null } : ing)));
  }

  function toggleTag(t: string) {
    const tag = t.trim().toLowerCase();
    if (!tag) return;
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  }

  function addCustom() {
    const t = customTag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setCustomTag("");
  }

  function submit() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      ingredients,
      timeMin: Math.max(0, timeMin),
      tags,
      steps: steps.trim(),
    });
  }

  // Sugerencias = utensilios + generales + las que ya tenga puestas y no estén.
  const suggestions = [...new Set([...EQUIPMENT_TAGS, ...OTHER_TAGS, ...tags])];

  return (
    <div className="rc-form">
      <label>
        <span className="rc-legend">Título</span>
        <input
          autoFocus
          value={title}
          placeholder="Lentejas de la abuela"
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <div>
        <span className="rc-legend">Ingredientes</span>

        {ingredients.length > 0 && (
          <ul className="rc-ingr-edit">
            {ingredients.map((ing, i) => (
              <li key={i} className="rc-ingr-edit__row">
                <span className="rc-ingr-edit__text">{ing.text}</span>
                {ing.productId ? (
                  <button
                    type="button"
                    className="rc-ingr-edit__link rc-ingr-edit__link--on"
                    onClick={() => unlinkIngredient(i)}
                    title="Producto de Mercadona enlazado. Pulsa para desenlazar."
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                    Mercadona
                  </button>
                ) : (
                  <button
                    type="button"
                    className="rc-ingr-edit__link"
                    onClick={() => setLinkingIndex(i)}
                  >
                    Enlazar producto
                  </button>
                )}
                <button
                  type="button"
                  className="nk-remove"
                  aria-label={`Quitar ${ing.text}`}
                  onClick={() => removeIngredient(i)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="rc-addtag">
          <input
            value={newIngredient}
            placeholder="200 g de lentejas…"
            onChange={(e) => setNewIngredient(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addIngredient())}
          />
          <button type="button" className="nk-btn nk-btn--ghost" onClick={addIngredient}>
            Añadir
          </button>
        </div>
      </div>

      <label>
        <span className="rc-legend">Tiempo (minutos)</span>
        <input
          type="number"
          min={0}
          value={timeMin || ""}
          placeholder="0"
          onChange={(e) => setTimeMin(Math.max(0, Number(e.target.value) || 0))}
        />
      </label>

      <div>
        <span className="rc-legend">Etiquetas (utensilio, tipo…)</span>
        <div className="rc-chips" style={{ marginTop: 4 }}>
          {suggestions.map((t) => (
            <button
              key={t}
              type="button"
              className="rc-chip rc-chip--tag"
              aria-pressed={tags.includes(t)}
              onClick={() => toggleTag(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="rc-addtag">
          <input
            value={customTag}
            placeholder="Otra etiqueta…"
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
          />
          <button type="button" className="nk-btn nk-btn--ghost" onClick={addCustom}>
            Añadir
          </button>
        </div>
      </div>

      <label>
        <span className="rc-legend">Preparación</span>
        <textarea
          rows={5}
          value={steps}
          placeholder="Paso a paso…"
          onChange={(e) => setSteps(e.target.value)}
        />
      </label>

      <div className="rc-form__actions">
        <button type="button" className="nk-btn nk-btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="nk-btn" onClick={submit}>
          Guardar receta
        </button>
      </div>

      {linkingIndex !== null && (
        <ProductPicker
          onClose={() => setLinkingIndex(null)}
          onPick={(product) => linkIngredient(linkingIndex, product)}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------- buscador de productos */

function ProductPicker({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (product: Product) => void;
}) {
  const [favorites, setFavorites] = useState<Product[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[] | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchJSON<Product[]>("/api/mercadona/products")
      .then(setFavorites)
      .catch(() => setFavorites([]));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      fetchJSON<Product[]>(`/api/mercadona/products?q=${encodeURIComponent(q)}`)
        .then((data) => {
          setResults(data);
          setSearching(false);
        })
        .catch(() => {
          setResults([]);
          setSearching(false);
        });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const list = query.trim() ? results : favorites;

  return (
    <div className="nk-sheet" onPointerDown={onClose}>
      <div className="nk-sheet__panel" onPointerDown={(e) => e.stopPropagation()}>
        <header className="nk-sheet__head">
          <h2>Enlazar producto</h2>
          <button type="button" className="nk-sheet__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <input
          className="sh-search"
          value={query}
          placeholder="Buscar en el catálogo…"
          onChange={(e) => setQuery(e.target.value)}
        />

        {list === null ? (
          <p className="sh-empty">Cargando…</p>
        ) : searching ? (
          <p className="sh-empty">Buscando…</p>
        ) : list.length === 0 ? (
          <p className="sh-empty">
            {query.trim() ? "Sin resultados para esa búsqueda." : "Aún no hay favoritos guardados."}
          </p>
        ) : (
          <ul className="nk-sheet__list sh-panel-list">
            {list.map((product) => (
              <li key={product.id} className="sh-panel-item">
                <img className="sh-thumb sh-thumb--sm" src={product.thumbnail} alt="" loading="lazy" />
                <div className="sh-body">
                  <strong className="sh-title">{product.name}</strong>
                  <div className="sh-meta">
                    <span>{product.packaging}</span>
                  </div>
                </div>
                <button type="button" className="nk-btn nk-btn--sm" onClick={() => onPick(product)}>
                  Elegir
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
