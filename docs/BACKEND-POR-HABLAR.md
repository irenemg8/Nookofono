# Backend pendiente para la app «Por hablar»

> Para Vicente. El **frontend ya está hecho** (`src/apps/talks/`) y pega contra
> `/api/talks`, mismo patrón que las demás. Dos piezas de backend faltan: la
> tabla/ruta (como Tareas) y **un cron de las 20:00** que sólo puede vivir en el
> servidor. No he tocado `server/`.

## 1. Tabla `talks` en `server/src/db/schema.ts`

```ts
export const talks = pgTable(
  "talks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    raisedBy: text("raised_by").notNull().default("both"), // 'irene' | 'vicente' | 'both'
    done: boolean("done").notNull().default(false),
    talkedAt: timestamp("talked_at"),                       // null mientras no se habla
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("talks_done_idx").on(t.done, t.createdAt)],
);
```

`npm run db:generate` + `npm run db:migrate`.

## 2. Ruta en `resources.ts` + registro en `index.ts`

```ts
const talkCreate = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  raisedBy: who.default("both"),        // el enum `who` ya existe
  done: z.boolean().default(false),
  talkedAt: z.number().int().nullable().default(null),
});

export const talkRoutes = crudRoutes(talks, {
  create: talkCreate,
  update: talkCreate.partial(),
});
```

```ts
app.route("/api/talks", talkRoutes);    // después de requireAuth
```

⚠️ El frontend manda y lee `talkedAt` como **epoch ms** (0 = sin hablar). Si en
la BD es `timestamp`, el mapper del `crudRoutes` ya convierte; sólo asegúrate de
que un `talkedAt: 0` entrante se guarde como `null` y salga como `0`, para no
enredar con "1970".

## 3. El recordatorio de las 20:00 — cron de servidor

Esto **no lo puede hacer el navegador**: a las 20:00 la app estará cerrada. Es
un trabajo del servidor, un cron diario:

```
Cada día a las 20:00 (Europe/Madrid):
  count = SELECT count(*) FROM talks WHERE done = false;
  si count > 0:
    POST https://ntfy.sh/ipug-porhablar-3d7a1f9c6b2e
      Title: "Temas por hablar"
      Priority: high
      body: `Tenéis ${count} tema(s) sin hablar. ¿Un ratito esta noche?`
```

El **aviso al publicar** un tema ya lo hace el frontend (POST directo a ntfy en
cuanto se crea), así que ese no necesita backend. Sólo el recordatorio diario.

El tema de ntfy es `ipug-porhablar-3d7a1f9c6b2e` (constante `TOPIC` en
`src/apps/talks/index.tsx`). Los dos móviles deben estar suscritos a él en la
app ntfy, igual que al de Cacahuete.

## Contrato que espera el frontend

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | |
| `title` | string | Tema |
| `description` | string | Puede ir vacío |
| `raisedBy` | `'irene' \| 'vicente' \| 'both'` | Quién lo saca |
| `done` | boolean | Hablado o no |
| `talkedAt` | number (epoch ms) | 0 mientras no se habla |
| `createdAt` / `updatedAt` | number (epoch ms) | El plazo de 48 h se cuenta desde `createdAt` |

El plazo de 48 h es **sólo visual** (lo calcula el frontend desde `createdAt`);
no hace falta nada en el servidor para eso.
