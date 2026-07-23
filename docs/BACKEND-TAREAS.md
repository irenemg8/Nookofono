# Backend pendiente para la app «Tareas»

> Para Vicente. El **frontend de Tareas ya está hecho** (`src/apps/tasks/`) y
> pega contra `/api/tasks`, exactamente igual que Notas contra `/api/notes`. Sólo
> falta el backend, que son tres añadidos pequeños y calcados de lo que ya
> existe. No he tocado `server/` para no chocar con tu trabajo.

## 1. Tabla `tasks` en `server/src/db/schema.ts`

Es Notas sin `title`/`body`/`paper`, con `text` y `done`. Copia el bloque de
`notes` y ajústalo:

```ts
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    text: text("text").notNull().default(""),
    done: boolean("done").notNull().default(false),
    owner: text("owner").notNull().default("shared"), // 'shared' | 'irene' | 'vicente'
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("tasks_owner_idx").on(t.owner, t.position)],
);
```

Luego `npm run db:generate` y `npm run db:migrate`, como con las demás.

## 2. Ruta en `server/src/routes/resources.ts`

Mismo patrón que `notesRoutes`:

```ts
const taskCreate = z.object({
  text: z.string().max(500).default(""),
  done: z.boolean().default(false),
  owner: owner.default("shared"),          // el enum `owner` ya existe en el fichero
  position: z.number().int().default(0),
});

export const taskRoutes = crudRoutes(tasks, {
  create: taskCreate,
  update: taskCreate.partial(),
});
```

(Recuerda importar `tasks` del schema arriba, junto a `notes`.)

## 3. Registrar en `server/src/index.ts`

```ts
import { /* … */ taskRoutes } from "./routes/resources.js";

app.route("/api/tasks", taskRoutes);        // debe ir DESPUÉS de requireAuth
```

## Contrato que espera el frontend

Cada tarea que devuelve la API:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | — |
| `text` | string | El texto de la tarea |
| `done` | boolean | Marcada o no |
| `owner` | `'shared' \| 'irene' \| 'vicente'` | La pestaña |
| `position` | number | Orden en la lista |
| `createdAt` / `updatedAt` | number (epoch ms) | Como el resto; el mapper del hook ya convierte desde ISO si hiciera falta |

El frontend hace `GET /api/tasks`, `POST` para crear, `PATCH /:id` para marcar
hecho o editar el texto, y `DELETE /:id`. Nada más.

Mientras la ruta no exista, la app enseña «No se pudo cargar la lista» en vez de
romperse, así que puedes desplegar el frontend antes que el backend sin problema.
