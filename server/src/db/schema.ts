/**
 * Esquema de la base de datos de iPug.
 *
 * Traducción a Postgres del modelo de `docs/MIGRACION-BACKEND.md` §6, con una
 * diferencia deliberada: **manda el código, no el documento**. Aquel esquema se
 * escribió antes de construir las mini-apps y el modelo derivó al implementarlas
 * (el calendario guarda `date` + `startsAt` locales en vez de un epoch, las
 * vacunas no tienen caducidad, los destinos no guardan coordenadas…). Copiar el
 * documento al pie de la letra obligaría a reescribir seis apps que ya
 * funcionan, así que el esquema se adapta a ellas.
 *
 * Convenciones:
 * - `id` es UUID generado por la base de datos.
 * - `created_at` / `updated_at` son `timestamptz`, no enteros: Postgres sí tiene
 *   tipo fecha, y la razón para usar enteros en SQLite aquí no aplica.
 * - Las fechas que el usuario escribe (cumpleaños, día de un evento, fecha de
 *   una vacuna) se guardan como TEXTO tal cual las teclea, porque son fechas
 *   civiles sin huso: el 2 de febrero es el 2 de febrero se mire desde donde se
 *   mire. Convertirlas a instantes UTC provoca el clásico error de que la fecha
 *   se mueva un día al cambiar de zona horaria.
 * - El dinero va en céntimos enteros. Nunca float.
 */
import {
  boolean,
  doublePrecision,
  index,
  bigint,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/** Marcas de tiempo que llevan todas las tablas de contenido. */
const stamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/* ------------------------------------------------------------------ usuarios */

/**
 * Sólo hay dos filas: `irene` y `vicente`. El id es el texto, no un UUID, para
 * que coincida con el `PersonId` que ya usa el frontend.
 *
 * `lastTotpStep` es el anti-replay del TOTP: guarda el último intervalo de 30 s
 * consumido, de modo que un código visto por encima del hombro no sirve durante
 * el minuto siguiente. Ver `docs/MIGRACION-BACKEND.md` §9.3.
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(), // 'irene' | 'vicente'
  displayName: text("display_name").notNull(),
  totpSecret: text("totp_secret"),
  lastTotpStep: integer("last_totp_step").notNull().default(0),
  createdAt: stamps.createdAt,
});

/* ------------------------------------------------------------------ pasaporte */

/**
 * El Pugporte. Los campos no editables (nombre de la isla, fruta, cumpleaños)
 * viven aquí igualmente para poder corregirlos sin desplegar.
 */
export const profiles = pgTable("profiles", {
  personId: text("person_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  islandName: text("island_name"),
  nativeFruit: text("native_fruit"),
  /** `MM-DD`: cumpleaños sin año. */
  birthday: text("birthday"),
  registeredAt: text("registered_at"),
  photoKey: text("photo_key"),
  title: text("title"),
  /** Máximo 24 caracteres, como en el juego. Se valida en la API. */
  comment: text("comment"),
  zodiac: text("zodiac"),
  updatedAt: stamps.updatedAt,
});

/* ----------------------------------------------------------------- calendario */

/**
 * Un evento del calendario compartido.
 *
 * `date` y `startsAt` se guardan como texto local (`YYYY-MM-DD` y `HH:MM`)
 * porque es exactamente lo que maneja `src/apps/calendar`. La repetición usa el
 * formato propio de `model/repeat.ts`, no RRULE: son cinco casos contados y
 * traducirlos a RRULE sólo añadiría una capa que nadie pidió.
 */
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    /** `YYYY-MM-DD` local. Primera aparición, si el evento se repite. */
    date: text("date").notNull(),
    /** `HH:MM` local. Vacío cuando dura todo el día. */
    startsAt: text("starts_at").notNull().default(""),
    durationMin: integer("duration_min").notNull().default(60),
    allDay: boolean("all_day").notNull().default(false),
    /** 'irene' | 'vicente' | 'both' */
    who: text("who").notNull().default("both"),
    notes: text("notes").notNull().default(""),
    /** 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' */
    repeat: text("repeat").notNull().default("none"),
    /** `YYYY-MM-DD`. Vacío = se repite sin fin. */
    repeatUntil: text("repeat_until").notNull().default(""),
    ...stamps,
  },
  (t) => [index("idx_events_date").on(t.date)],
);

/* ---------------------------------------------------------------------- notas */

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    /** 'shared' | 'irene' | 'vicente' */
    owner: text("owner").notNull().default("shared"),
    /** Color del papel de carta. */
    paper: text("paper").notNull().default("#cfeae4"),
    pinned: boolean("pinned").notNull().default(false),
    /** Posición dentro de su pestaña: las notas se reordenan arrastrando. */
    position: integer("position").notNull().default(0),
    ...stamps,
  },
  (t) => [index("idx_notes_owner").on(t.owner, t.position)],
);

/* ----------------------------------------------------------------- destinos */

/**
 * Destinos de PugPug Airlines. Hoy la app sólo guarda el nombre y si está
 * visitado; `lat`/`lon` quedan preparados para cuando entre el globo terráqueo
 * (`PROYECTO.md` §9.4), y son nulos mientras tanto.
 */
export const destinations = pgTable("destinations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  country: text("country"),
  lat: doublePrecision("lat"),
  lon: doublePrecision("lon"),
  visited: boolean("visited").notNull().default(false),
  /** `YYYY-MM-DD`. Nulo mientras esté pendiente. */
  visitedAt: text("visited_at"),
  notes: text("notes").notNull().default(""),
  ...stamps,
});

/* -------------------------------------------------------------------- Nilo */

/**
 * Las vacunas no llevan caducidad porque la app tampoco la pide hoy. El aviso de
 * "toca revacunar" que menciona `PROYECTO.md` §2.7 necesitaría ese campo; se
 * añadirá cuando se construya el aviso, no antes.
 */
export const vaccines = pgTable(
  "vaccines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** `YYYY-MM-DD` tal como se teclea. */
    appliedAt: text("applied_at").notNull(),
    notes: text("notes").notNull().default(""),
    ...stamps,
  },
  (t) => [index("idx_vaccines_applied").on(t.appliedAt)],
);

export const weightEntries = pgTable(
  "weight_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** `YYYY-MM-DD`. */
    measuredAt: text("measured_at").notNull(),
    grams: integer("grams").notNull(),
    ...stamps,
  },
  (t) => [index("idx_weights_measured").on(t.measuredAt)],
);

/**
 * Un paseo con Nilo.
 *
 * `steps` es una **estimación** del acelerómetro con la app abierta, no el dato
 * del móvil: contar pasos de verdad desde una web es imposible
 * (`PROYECTO.md` §9.5). `stepsSource` distingue de dónde salió el número para
 * que la interfaz pueda decir la verdad:
 *   - `estimate`: acelerómetro del navegador, aproximado.
 *   - `shortcut`: enviado por un Atajo de iOS leyendo Salud, exacto.
 */
export const walks = pgTable(
  "walks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSec: integer("duration_sec").notNull().default(0),
    distanceM: integer("distance_m").notNull().default(0),
    steps: integer("steps").notNull().default(0),
    /** 'estimate' | 'shortcut' */
    stepsSource: text("steps_source").notNull().default("estimate"),
    /** Ruta `[[lat, lon, t], …]`, si se registró. */
    route: jsonb("route"),
    createdBy: text("created_by").references(() => users.id),
    ...stamps,
  },
  (t) => [index("idx_walks_started").on(t.startedAt)],
);

/**
 * Pasos diarios enviados por un Atajo de iOS (o Tasker en Android).
 *
 * Es la vía honesta para tener pasos reales: los lee el coprocesador del móvil y
 * el atajo los publica aquí. Un día se pisa a sí mismo (`onConflictDoUpdate`),
 * así que reenviar el mismo día corrige el valor en vez de duplicarlo.
 */
export const stepDays = pgTable(
  "step_days",
  {
    personId: text("person_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** `YYYY-MM-DD` local del móvil que envía. */
    day: text("day").notNull(),
    steps: integer("steps").notNull().default(0),
    distanceM: integer("distance_m").notNull().default(0),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.personId, t.day] })],
);

/* -------------------------------------------------------------------- avisos */

/** Historial de Cacahuete: quién pidió rescate y cuándo. */
export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    from: text("from").notNull(),
    text: text("text").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: stamps.createdAt,
  },
  (t) => [index("idx_alerts_at").on(t.at)],
);

/* --------------------------------------------------------------- pantalla */

/**
 * Cómo ha dejado cada uno su pantalla de inicio.
 *
 * Va por persona, no compartido: el móvil de Irene y el de Vicente pueden tener
 * los iconos en distinto orden. Se guarda como un par clave/valor con JSON
 * dentro (`icon_order`, `dock`, `widgets`) en lugar de una tabla por concepto,
 * porque son listas que se leen y escriben enteras y no se consultan por dentro.
 */
export const preferences = pgTable(
  "preferences",
  {
    personId: text("person_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 'icon_order' | 'dock' | 'widgets' | … */
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updatedAt: stamps.updatedAt,
  },
  (t) => [primaryKey({ columns: [t.personId, t.key] })],
);

/* ------------------------------------------------------------------ compra */

export const shoppingLists = pgTable("shopping_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  archived: boolean("archived").notNull().default(false),
  ...stamps,
});

/**
 * Un producto en una lista.
 *
 * `checked` no borra la línea: la app de Mercadona mueve lo comprado a una
 * sección "Comprados" al final, y ese detalle es justo lo que se quiere copiar
 * (`PROYECTO.md` §9.1).
 */
export const shoppingItems = pgTable(
  "shopping_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => shoppingLists.id, { onDelete: "cascade" }),
    /** Id del catálogo de Mercadona, si vino de allí. */
    productId: text("product_id"),
    name: text("name").notNull(),
    quantity: real("quantity").notNull().default(1),
    unit: text("unit"),
    priceCents: integer("price_cents"),
    checked: boolean("checked").notNull().default(false),
    position: integer("position").notNull().default(0),
    ...stamps,
  },
  (t) => [index("idx_items_list").on(t.listId, t.checked, t.position)],
);

export const favoriteProducts = pgTable("favorite_products", {
  productId: text("product_id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  lastPriceCents: integer("last_price_cents"),
  createdAt: stamps.createdAt,
});

/* ------------------------------------------------------------------- dinero */

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** 'bank' | 'cash' | 'card' */
  kind: text("kind").notNull().default("bank"),
  currency: text("currency").notNull().default("EUR"),
  balanceCents: integer("balance_cents").notNull().default(0),
  institution: text("institution"),
  ownerId: text("owner_id").references(() => users.id),
  ...stamps,
});

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    description: text("description").notNull(),
    /** Céntimos enteros: con float, 0,1 + 0,2 acaba siendo 0,30000000000000004. */
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    category: text("category"),
    paidBy: text("paid_by")
      .notNull()
      .references(() => users.id),
    /** 'even' | 'payer' | 'custom' */
    splitMode: text("split_mode").notNull().default("even"),
    splitDetail: jsonb("split_detail"),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    /** `YYYY-MM-DD`. */
    occurredAt: text("occurred_at").notNull(),
    ...stamps,
  },
  (t) => [index("idx_expenses_date").on(t.occurredAt)],
);

/* -------------------------------------------------------------------- sesión */

/**
 * Sesiones vivas, para poder cerrarlas desde el servidor.
 *
 * El JWT ya lleva su caducidad, pero sin esta tabla no habría forma de echar a
 * un móvil perdido antes de que expire. Se borra la fila y el `jti` deja de
 * valer.
 */
export const sessions = pgTable(
  "sessions",
  {
    jti: uuid("jti").primaryKey(),
    personId: text("person_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: stamps.createdAt,
  },
  (t) => [index("idx_sessions_person").on(t.personId)],
);

/* --------------------------------------------------------------------- media */

export const media = pgTable(
  "media",
  {
    key: text("key").primaryKey(),
    /** 'photo' | 'file' | 'avatar' | 'pet' */
    kind: text("kind").notNull(),
    filename: text("filename").notNull(),
    mime: text("mime"),
    sizeBytes: integer("size_bytes"),
    thumbKey: text("thumb_key"),
    uploadedBy: text("uploaded_by").references(() => users.id),
    createdAt: stamps.createdAt,
  },
  (t) => [uniqueIndex("idx_media_thumb").on(t.thumbKey)],
);

/* ------------------------------------------------------------------ Tareas */

/**
 * La lista de la compra de tareas sueltas: Notas sin título ni cuerpo, con un
 * texto y un tachado. El `owner` es la pestaña ('shared'|'irene'|'vicente').
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    text: text("text").notNull().default(""),
    done: boolean("done").notNull().default(false),
    owner: text("owner").notNull().default("shared"),
    position: integer("position").notNull().default(0),
    ...stamps,
  },
  (t) => [index("idx_tasks_owner").on(t.owner, t.position)],
);

/* ------------------------------------------------------------- Incidencias */

/**
 * Partes de incidencia de la casa. `dueDays` es el plazo visual (lo cuenta el
 * frontend desde `createdAt`); `doneAt` va en epoch ms —0 mientras no está
 * hecha— porque el frontend lo trata como número sin conversión.
 */
export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    priority: text("priority").notNull().default("media"), // 'baja'|'media'|'alta'
    assignee: text("assignee").notNull().default("both"), // 'irene'|'vicente'|'both'
    dueDays: integer("due_days").notNull().default(0), // 0 = sin plazo
    done: boolean("done").notNull().default(false),
    doneAt: bigint("done_at", { mode: "number" }), // epoch ms; null = sin hacer
    ...stamps,
  },
  (t) => [index("idx_incidents_done").on(t.done, t.createdAt)],
);

/* -------------------------------------------------------------- Por hablar */

/**
 * Temas que la pareja se apunta para hablar. `talkedAt` va en epoch ms (null =
 * sin hablar) por el mismo motivo que `doneAt` de incidencias: el frontend lo
 * consume como número.
 */
export const talks = pgTable(
  "talks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    raisedBy: text("raised_by").notNull().default("both"), // 'irene'|'vicente'|'both'
    done: boolean("done").notNull().default(false),
    talkedAt: bigint("talked_at", { mode: "number" }), // epoch ms; null = sin hablar
    ...stamps,
  },
  (t) => [index("idx_talks_done").on(t.done, t.createdAt)],
);

/* -------------------------------------------------------------------- Casa */

/**
 * Tareas del hogar recurrentes. `everyWeeks` es la cadencia (0 = puntual, una
 * vez); `lastDoneAt` va en epoch ms (null/0 = nunca) porque el frontend calcula
 * si toca comparando con `Date.now()`. El cron del domingo lee esta misma regla.
 */
export const chores = pgTable(
  "chores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    everyWeeks: integer("every_weeks").notNull().default(1),
    lastDoneAt: bigint("last_done_at", { mode: "number" }), // epoch ms; null = nunca
    lastDoneBy: text("last_done_by").notNull().default(""), // ''|'irene'|'vicente'
    position: integer("position").notNull().default(0),
    ...stamps,
  },
  (t) => [index("idx_chores_position").on(t.position)],
);

/* ------------------------------------------------------------------- Ciclo */

/**
 * Un registro por DÍA marcado como regla, estilo Salud de Apple. Marcar =
 * insertar, desmarcar = borrar. Los ciclos se deducen agrupando días
 * consecutivos en el frontend (`predict.ts`), así que aquí no hay nada que
 * calcular.
 */
export const cycleDays = pgTable("cycle_days", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: text("date").notNull(), // 'YYYY-MM-DD'
  ...stamps,
});

/**
 * El diario diario del ciclo. `symptoms` y `moods` son arrays de strings en
 * jsonb; Drizzle los devuelve ya parseados, así que el frontend los recibe como
 * `string[]` sin mapper.
 */
export const cycleLogs = pgTable("cycle_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: text("date").notNull(), // 'YYYY-MM-DD'
  symptoms: jsonb("symptoms").notNull().default([]), // string[]
  moods: jsonb("moods").notNull().default([]), // string[]
  flow: text("flow").notNull().default(""), // ''|'ligero'|'medio'|'fuerte'
  note: text("note").notNull().default(""),
  ...stamps,
});

/* ------------------------------------------------------------------- Fotos */

/**
 * Metadatos de la galería. El binario NO va aquí: se sube al almacén de blobs
 * (`/api/files/:id/blob`) usando el `id` de esta fila como clave, igual que los
 * ficheros de RAG-Pugtín.
 */
export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    mime: text("mime").notNull().default("image/*"),
    uploadedBy: text("uploaded_by").notNull().default(""), // ''|'irene'|'vicente'
    position: integer("position").notNull().default(0),
    ...stamps,
  },
  (t) => [index("idx_photos_position").on(t.position)],
);

/* --------------------------------------------------------------- RAG-Pugtín */

/**
 * Carpetas del explorador de archivos. `parentId` vacío = raíz.
 */
export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  parentId: text("parent_id").notNull().default(""), // "" = raíz
  createdBy: text("created_by").notNull().default(""), // 'irene'|'vicente'
  ...stamps,
});

/**
 * Metadatos de los ficheros. El contenido va al almacén de blobs por el `id`.
 * `tags` es un array de strings en jsonb. Al borrar un fichero caen sus trozos
 * de RAG por el `onDelete: cascade` de `fileChunks`, y hay que borrar su blob.
 */
export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  folderId: text("folder_id").notNull().default(""), // "" = raíz
  mime: text("mime").notNull().default(""),
  size: integer("size").notNull().default(0),
  tags: jsonb("tags").notNull().default([]), // string[]
  uploadedBy: text("uploaded_by").notNull().default(""),
  ...stamps,
});

/**
 * Trozos de texto de cada fichero para el RAG de Valentín. El texto se extrae y
 * trocea al subir; el `embedding` es un vector de 384 dimensiones
 * (all-MiniLM-L6-v2, embeddings locales). pgvector debe estar instalado
 * (`CREATE EXTENSION vector`). Los trozos caen con su fichero por el cascade.
 */
export const fileChunks = pgTable(
  "file_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 384 }),
    createdAt: stamps.createdAt,
  },
  (t) => [index("idx_file_chunks_file").on(t.fileId)],
);
