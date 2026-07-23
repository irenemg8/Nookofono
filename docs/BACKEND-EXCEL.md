# Backend pendiente para la app «Excel»

> Para Vicente. El **frontend ya está hecho** (`src/apps/sheets/`) y pega contra
> `/api/sheets`, mismo patrón que las demás. Cada hoja es un documento con su
> rejilla serializada; sólo falta la tabla y la ruta. No he tocado `server/`.

## 1. Tabla `sheets` en `server/src/db/schema.ts`

```ts
export const sheets = pgTable(
  "sheets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().default("Hoja"),
    // El grid entero va en JSON: { name, rows, cols, cells: { A1: "10", ... } }.
    data: text("data").notNull().default("{}"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("sheets_updated_idx").on(t.updatedAt)],
);
```

`data` puede crecer: una hoja con muchas celdas son varios KB. `text` vale;
si prefieres `jsonb`, el frontend lo manda y lo recibe como **string JSON**, así
que tendrías que `JSON.parse`/`stringify` en el mapper.

## 2. Ruta + registro

```ts
const sheetCreate = z.object({
  name: z.string().max(120).default("Hoja"),
  data: z.string().default("{}"),   // JSON serializado; el server no lo mira
});

export const sheetRoutes = crudRoutes(sheets, {
  create: sheetCreate,
  update: sheetCreate.partial(),
});
```

```ts
app.route("/api/sheets", sheetRoutes);   // tras requireAuth
```

## Contrato

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | |
| `name` | string | Nombre de la hoja |
| `data` | string | JSON del grid. El servidor lo trata como texto opaco |
| `createdAt` / `updatedAt` | number (epoch ms) | |

## Lo que NO es esto: RAGugtín

La app dice "los ficheros que subas a RAGugtín aparecerán aquí". Eso es una
**integración futura**, no parte de esta tabla:

- Requiere que **Archivos/RAGugtín** tenga un almacén de ficheros de verdad
  (la tabla `media` existe, falta dónde van los binarios en el VPS —
  `docs/PLAN.md`).
- Cuando exista, la app Excel podrá listar los `.xlsx` de ese almacén y abrirlos
  con el mismo importador que ya usa (`src/apps/sheets/model/xlsx.ts`).

De momento la app funciona sola: se crean hojas o se cargan ficheros `.xlsx`/
`.csv` desde el propio botón «Cargar archivo», y se editan y descargan. La
integración con RAGugtín se añade encima sin rehacer nada.
