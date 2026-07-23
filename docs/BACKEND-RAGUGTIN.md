# Backend pendiente para «RAG-Pugtín» (Archivos)

> Para Vicente. El **frontend está hecho** (`src/apps/files/`): carpetas,
> ficheros, subir, renombrar, borrar, mover arrastrando, etiquetas, descargar y
> **editar los `.xlsx` con la app Excel guardando los cambios**. En local (modo
> bypass) todo funciona: los metadatos van a `localStorage` y los binarios a
> **IndexedDB**. Falta el backend para que sea compartido y persistente. No he
> tocado `server/`.

## 1. Dos tablas de metadatos

```ts
export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  parentId: text("parent_id").notNull().default(""),   // "" = raíz
  createdBy: text("created_by").notNull().default(""),  // 'irene' | 'vicente'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  folderId: text("folder_id").notNull().default(""),
  mime: text("mime").notNull().default(""),
  size: integer("size").notNull().default(0),
  tags: jsonb("tags").notNull().default("[]"),          // string[]
  uploadedBy: text("uploaded_by").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

Rutas CRUD normales en `resources.ts` + registro:

```ts
app.route("/api/folders", folderRoutes);
app.route("/api/files", fileRoutes);
```

⚠️ `tags` es un **array de strings**. El frontend lo manda y lo espera como
array; si en la BD es `jsonb`, cuida que el mapper no lo devuelva como texto.

## 2. El almacén de binarios — lo que de verdad falta

El contenido de los ficheros **no** va en la tabla. El frontend lo sube y lo
baja por estas rutas (ver `src/shared/lib/filestore.ts`):

| Método | Ruta | Qué hace |
|---|---|---|
| `PUT` | `/api/files/:id/blob` | Guarda el binario. Body = el fichero crudo, `Content-Type` real |
| `GET` | `/api/files/:id/blob` | Devuelve el binario para verlo o descargarlo |
| `DELETE` | `/api/files/:id/blob` | Lo borra |

Dónde se guardan los bytes en el VPS es tu decisión (un directorio montado en
Docker es lo más simple; la tabla `media` del esquema original iba por aquí).
Sólo hace falta que esas tres rutas respondan.

**Editar Excel y guardar:** cuando se edita un `.xlsx` en la app Excel desde
aquí, el frontend hace `GET .../blob`, lo edita, y al guardar hace `PUT .../blob`
con el nuevo contenido y un `PATCH /api/files/:id` con el nuevo `size`. No hay
nada especial que hacer en el servidor: es subir y bajar el mismo blob.

## 3. RAG de Valentín — la parte que da sentido a todo esto

RAG-Pugtín es **la fuente de conocimiento de Valentín**. El modelo fine-tuneado
responde con lo que hay aquí, así que al subir un fichero el backend debería:

1. **Extraer su texto** (de `.pdf`, `.docx`, `.xlsx`, `.txt`, `.md`…). Para los
   Excel, el texto son las celdas; ya se leen con SheetJS en el frontend, pero
   en el servidor conviene una librería equivalente.
2. **Trocearlo y generar *embeddings***, y guardarlos (pgvector en el mismo
   Postgres es lo natural; hay extensión).
3. En `/api/valentin/chat`, **recuperar los trozos relevantes** por similitud y
   pasárselos al modelo como contexto (el RAG propiamente dicho).

Nada de esto lo toca el frontend: RAG-Pugtín sólo tiene que **guardar los
ficheros de forma que su texto sea recuperable**. La cadena de embeddings +
recuperación vive junto al endpoint de Valentín (`src/apps/advice/model/brain.ts`
apunta a `/api/valentin` cuando exista).

Sugerencia de tabla para los trozos:

```ts
export const chunks = pgTable("file_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),   // pgvector
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

Al borrar un fichero (`DELETE /api/files/:id`) caen sus trozos por el
`onDelete: cascade`, y hay que borrar también su blob.

## Contrato que espera el frontend

**Carpeta:** `{ id, name, parentId, createdBy, createdAt, updatedAt }`
**Fichero:** `{ id, name, folderId, mime, size, tags: string[], uploadedBy, createdAt, updatedAt }`

`parentId`/`folderId` vacío = raíz. `uploadedBy`/`createdBy` es `"irene"` o
`"vicente"`, para que se vea quién subió cada cosa.
