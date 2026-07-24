# Backend pendiente para «Recetario» y «Menú semanal»

> Para Vicente. Frontend hecho (`src/apps/recipes/` y `src/apps/menu/`). Dos
> colecciones con el patrón `crudRoutes` de siempre. Sin crons ni ntfy. No he
> tocado `server/`.

Las dos apps están **enlazadas**: el Recetario es dueño de las recetas; el Menú
semanal sólo guarda referencias (id + copia del título). Por eso quitar una
comida del menú no borra la receta, y borrar la receta no vacía el menú (queda
el título congelado).

## Tabla `recipes`

```ts
export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  ingredients: jsonb("ingredients").notNull().default(sql`'[]'::jsonb`), // string[]
  timeMin: integer("time_min").notNull().default(0),
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),               // string[]
  steps: text("steps").notNull().default(""),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

```ts
const recipeCreate = z.object({
  title: z.string().min(1).max(200),
  ingredients: z.array(z.string().max(200)).default([]),
  timeMin: z.number().int().min(0).max(6000).default(0),
  tags: z.array(z.string().max(40)).default([]),
  steps: z.string().max(10000).default(""),
  position: z.number().int().default(0),
});
export const recipeRoutes = crudRoutes(recipes, { create: recipeCreate, update: recipeCreate.partial() });
```

```ts
app.route("/api/recipes", recipeRoutes);
```

## Tabla `meal_plan`

```ts
export const mealPlan = pgTable("meal_plan", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: text("date").notNull(),         // 'YYYY-MM-DD' (día concreto)
  meal: text("meal").notNull(),         // 'desayuno' | 'comida' | 'cena'
  recipeId: text("recipe_id").notNull(),
  title: text("title").notNull(),       // copia del título de la receta
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

```ts
const mealCreate = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal: z.enum(["desayuno", "comida", "cena"]),
  recipeId: z.string().min(1),
  title: z.string().min(1).max(200),
});
export const mealRoutes = crudRoutes(mealPlan, { create: mealCreate, update: mealCreate.partial() });
```

```ts
app.route("/api/mealplan", mealRoutes);
```

`recipeId` es una referencia **suelta** (no FK): si la receta se borra, la
entrada del menú sigue mostrando `title`. La «Compra de la semana» la calcula el
frontend cruzando `recipeId` con las recetas vivas; las borradas no aportan
ingredientes, y ya está.

Las dos colecciones son **compartidas** (Irene y Vicente ven lo mismo).
