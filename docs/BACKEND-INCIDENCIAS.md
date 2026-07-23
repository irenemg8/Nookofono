# Backend pendiente para «Incidencias»

> Para Vicente. Frontend hecho (`src/apps/incidents/`), pega contra
> `/api/incidents`. Tabla + ruta como las demás; el aviso al abrir un parte ya
> lo manda el frontend por ntfy. No he tocado `server/`.

## Tabla `incidents`

```ts
export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    priority: text("priority").notNull().default("media"),   // 'baja'|'media'|'alta'
    assignee: text("assignee").notNull().default("both"),    // 'irene'|'vicente'|'both'
    dueDays: integer("due_days").notNull().default(0),        // 0 = sin plazo
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("incidents_done_idx").on(t.done, t.createdAt)],
);
```

Ruta:

```ts
const incidentCreate = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  priority: z.enum(["baja", "media", "alta"]).default("media"),
  assignee: who.default("both"),
  dueDays: z.number().int().min(0).max(365).default(0),
  done: z.boolean().default(false),
  doneAt: z.number().int().nullable().default(null),
});

export const incidentRoutes = crudRoutes(incidents, {
  create: incidentCreate,
  update: incidentCreate.partial(),
});
```

```ts
app.route("/api/incidents", incidentRoutes);   // tras requireAuth
```

## Notificaciones

- **Al abrir un parte** el frontend hace POST directo a
  `https://ntfy.sh/ipug-incidencias-7c4e9a2f81b6`. No necesita backend.
- El **plazo** (`dueDays`) es visual, lo cuenta el frontend desde `createdAt`.
- Si más adelante quieres un **recordatorio** cuando algo se pasa de plazo, es un
  cron de servidor igual que el de «Por hablar» (ver `BACKEND-POR-HABLAR.md`):
  cada mañana, si hay incidencias `done = false` con
  `created_at + due_days*86400 < now`, avisar al mismo tema de ntfy.

## Contrato

`{ id, title, description, priority, assignee, dueDays, done, doneAt, createdAt, updatedAt }`
— tiempos en epoch ms; `doneAt` es 0 mientras no está hecho.
