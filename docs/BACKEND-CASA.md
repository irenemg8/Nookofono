# Backend pendiente para la app «Casa»

> Para Vicente. El **frontend ya está hecho** (`src/apps/home/`) y pega contra
> `/api/casa`, mismo patrón que Tareas/Incidencias. Dos piezas de backend: la
> tabla/ruta (trivial) y **un cron del domingo por la noche** que sólo puede
> vivir en el servidor. No he tocado `server/`.

## 1. Tabla `chores` en `server/src/db/schema.ts`

```ts
export const chores = pgTable(
  "chores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    everyWeeks: integer("every_weeks").notNull().default(1), // cada cuántas semanas toca; 0 = puntual (una vez)
    lastDoneAt: timestamp("last_done_at"),                    // null = nunca
    lastDoneBy: text("last_done_by").notNull().default(""),   // ''|'irene'|'vicente'
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("chores_position_idx").on(t.position)],
);
```

`npm run db:generate` + `npm run db:migrate`.

## 2. Ruta en `resources.ts` + registro en `index.ts`

```ts
const choreCreate = z.object({
  title: z.string().min(1).max(200),
  everyWeeks: z.number().int().min(0).max(52).default(1), // 0 = puntual (una vez)
  lastDoneAt: z.number().int().nullable().default(null),
  lastDoneBy: z.enum(["", "irene", "vicente"]).default(""),
  position: z.number().int().default(0),
});

export const choreRoutes = crudRoutes(chores, {
  create: choreCreate,
  update: choreCreate.partial(),
});
```

```ts
app.route("/api/casa", choreRoutes);   // después de requireAuth
```

⚠️ El frontend manda y lee `lastDoneAt` como **epoch ms** (`0` = nunca). Si en la
BD es `timestamp`, que el mapper de `crudRoutes` convierta null↔0, igual que
`talkedAt` en «Por hablar».

## 3. El recordatorio del domingo — cron de servidor

Esto **no lo puede hacer el navegador**: el domingo por la noche la app estará
cerrada. Cron semanal:

```
Cada domingo a las 21:00 (Europe/Madrid):
  now = ahora (epoch ms)
  pendientes = SELECT * FROM chores
               WHERE last_done_at IS NULL
                  OR (every_weeks > 0 AND (now - last_done_at) >= every_weeks * 7 * 86400000)
  si pendientes no está vacío:
    POST https://ntfy.sh/ipug-casa-4b8f1e6d3a29
      Title: "Tareas de casa"
      Priority: high
      Tags: house
      body: `Queda(n) ${pendientes.length} sin hacer: ${pendientes.map(c => c.title).join(", ")}`
```

La regla de "pendiente" es **la misma** que usa el frontend (`isPending` en
`src/apps/home/index.tsx`): una tarea vuelve a estar pendiente sola cuando su
cadencia vence desde la última vez que se hizo. No hay que resetear nada los
lunes; basta con calcularlo al vuelo.

El tema de ntfy es `ipug-casa-4b8f1e6d3a29`. Los dos móviles deben estar
suscritos a él en la app ntfy, igual que a Cacahuete/Incidencias.

## Contrato que espera el frontend

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | |
| `title` | string | Qué hay que hacer |
| `everyWeeks` | number | Cadencia en semanas (1 = semanal) |
| `lastDoneAt` | number (epoch ms) | 0 = nunca se ha hecho |
| `lastDoneBy` | `'' \| 'irene' \| 'vicente'` | Quién la hizo la última vez |
| `position` | number | Orden en la lista |
| `createdAt` / `updatedAt` | number (epoch ms) | |
