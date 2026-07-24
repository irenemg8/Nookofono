import { useMemo, useState } from "react";
import { useRemoteCollection } from "../../shared/lib/use-remote-collection";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import {
  EQUIPMENT_TAGS,
  OTHER_TAGS,
  TIME_STEPS,
  timeLabel,
  type Recipe,
} from "./model/types";
import "./recipes.css";

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
          const hay = (r.title + " " + r.ingredients.join(" ")).toLowerCase();
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
              <li key={i}>{ing}</li>
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
  ingredients: string[];
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
  const [ingredients, setIngredients] = useState(initial?.ingredients.join("\n") ?? "");
  const [timeMin, setTimeMin] = useState(initial?.timeMin ?? 0);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [steps, setSteps] = useState(initial?.steps ?? "");
  const [customTag, setCustomTag] = useState("");

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
      ingredients: ingredients
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
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

      <label>
        <span className="rc-legend">Ingredientes (uno por línea)</span>
        <textarea
          rows={5}
          value={ingredients}
          placeholder={"200 g de lentejas\n1 cebolla\n2 zanahorias\n…"}
          onChange={(e) => setIngredients(e.target.value)}
        />
      </label>

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
    </div>
  );
}
