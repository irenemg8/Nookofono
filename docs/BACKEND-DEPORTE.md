# Backend pendiente para la app «Deporte»

> Para Vicente. Frontend hecho (`src/apps/sport/`). Tres colecciones con el
> patrón `crudRoutes` de siempre. No he tocado `server/`. Sin crons ni ntfy:
> Deporte no manda avisos.

## Tres tablas

### `sport_sports` — catálogo de deportes (compartido)

```ts
export const sportSports = pgTable("sport_sports", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🏅"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

El frontend lo **auto-siembra** con los deportes de siempre (yoga, pádel, tenis,
natación, caminar, correr, gym, bici) la primera vez que está vacío. No hace
falta seed en el servidor.

### `sport_sessions` — sesiones cronometradas (por persona)

```ts
export const sportSessions = pgTable("sport_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  user: text("user").notNull(),            // 'irene' | 'vicente'
  sport: text("sport").notNull(),          // nombre congelado
  emoji: text("emoji").notNull().default("🏅"),
  durationSec: integer("duration_sec").notNull().default(0),
  note: text("note").notNull().default(""),
  doneAt: timestamp("done_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

⚠️ `doneAt` viaja como **epoch ms**. El filtrado por persona lo hace el
frontend (`user === yo`), pero puedes filtrar también en el servidor por la
sesión autenticada si quieres.

### `sport_routines` — listados de ejercicios (por persona)

```ts
export const sportRoutines = pgTable("sport_routines", {
  id: uuid("id").primaryKey().defaultRandom(),
  user: text("user").notNull(),
  name: text("name").notNull(),
  exercises: jsonb("exercises").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

`exercises` es un array JSON de `{ name: string, kind: 'reps'|'time', amount: number }`.

## Rutas

```ts
const sportSportCreate = z.object({
  name: z.string().min(1).max(60),
  emoji: z.string().max(8).default("🏅"),
  position: z.number().int().default(0),
});

const sportSessionCreate = z.object({
  user: z.enum(["irene", "vicente"]),
  sport: z.string().min(1).max(60),
  emoji: z.string().max(8).default("🏅"),
  durationSec: z.number().int().min(0),
  note: z.string().max(2000).default(""),
  doneAt: z.number().int(),
});

const exercise = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(["reps", "time"]),
  amount: z.number().int().min(1),
});
const sportRoutineCreate = z.object({
  user: z.enum(["irene", "vicente"]),
  name: z.string().min(1).max(120),
  exercises: z.array(exercise).default([]),
});

export const sportSportRoutes = crudRoutes(sportSports, { create: sportSportCreate, update: sportSportCreate.partial() });
export const sportSessionRoutes = crudRoutes(sportSessions, { create: sportSessionCreate, update: sportSessionCreate.partial() });
export const sportRoutineRoutes = crudRoutes(sportRoutines, { create: sportRoutineCreate, update: sportRoutineCreate.partial() });
```

```ts
app.route("/api/sport/sports", sportSportRoutes);
app.route("/api/sport/sessions", sportSessionRoutes);
app.route("/api/sport/routines", sportRoutineRoutes);
```

## Descarga CSV/XLSX

La hace el frontend en el navegador (constructor de CSV a mano y `xlsx` por
`import()` dinámico). No necesita nada del servidor.
