# Backend pendiente para la app «Fotos»

> Para Vicente. El **frontend ya está hecho** (`src/apps/photos/` +
> `src/shared/lib/use-photo-library.ts`) y pega contra `/api/photos` para los
> metadatos y contra el **almacén de blobs** para el binario, igual que
> RAG-Pugtín/Excel/Docs. No he tocado `server/`.

## Cómo guarda las fotos el frontend

Dos piezas, como en RAG-Pugtín:

1. **Metadatos** en la colección `/api/photos` (nombre, mime, quién la subió,
   orden). Mismo patrón `crudRoutes` que las demás.
2. **Binario** por el almacén de blobs (`putBlob`/`getBlob`/`deleteBlob` de
   `src/shared/lib/filestore.ts`). En local va a IndexedDB; con servidor hace
   `PUT/GET/DELETE /api/files/:id/blob`.

⚠️ **Importante:** el `id` del blob es el `id` de la fila de `/api/photos`. El
frontend sube la foto a `/api/files/:id/blob` reutilizando ese mecanismo. Tienes
dos opciones en el servidor:

- **Reutilizar** la ruta de blobs de RAG-Pugtín (`/api/files/:id/blob`) para
  cualquier id, venga de `files` o de `photos`. Es lo más simple y es lo que
  asume `filestore.ts` hoy.
- O añadir `/api/photos/:id/blob` propia y cambiar `filestore.ts` para enrutar
  por colección. Más trabajo, sin ganancia real.

Recomiendo la primera: un único almacén de blobs indexado por id.

## Tabla `photos` en `server/src/db/schema.ts`

```ts
export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    mime: text("mime").notNull().default("image/*"),
    uploadedBy: text("uploaded_by").notNull().default(""), // ''|'irene'|'vicente'
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("photos_position_idx").on(t.position)],
);
```

`npm run db:generate` + `npm run db:migrate`.

## Ruta en `resources.ts` + registro en `index.ts`

```ts
const photoCreate = z.object({
  name: z.string().min(1).max(300),
  mime: z.string().max(100).default("image/*"),
  uploadedBy: z.enum(["", "irene", "vicente"]).default(""),
  position: z.number().int().default(0),
});

export const photoRoutes = crudRoutes(photos, {
  create: photoCreate,
  update: photoCreate.partial(),
});
```

```ts
app.route("/api/photos", photoRoutes);   // después de requireAuth
```

Y que la ruta de blobs (`/api/files/:id/blob`) acepte cualquier id, o duplícala
para photos. Al **borrar** una foto conviene borrar también su blob.

## Contrato que espera el frontend

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | Es también la clave del blob |
| `name` | string | Nombre del fichero |
| `mime` | string | `image/jpeg`, `image/webp`… |
| `uploadedBy` | `'' \| 'irene' \| 'vicente'` | Quién la subió |
| `position` | number | Orden en la galería |
| `createdAt` / `updatedAt` | number (epoch ms) | |

## Widgets de fotos

No necesitan backend: la configuración de cada widget (foto fija / al azar /
selección + cada cuánto rota) vive en el dispositivo con el resto de widgets
(`ipug.widgets` en `localStorage`, luego `app_preferences`). El widget lee las
fotos de la misma biblioteca `/api/photos`.
