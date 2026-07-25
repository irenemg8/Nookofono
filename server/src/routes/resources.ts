/**
 * Las mini-apps en el backend.
 *
 * Cada recurso son sus dos esquemas de validación y una llamada a `crudRoutes`.
 * Los campos y sus valores por defecto se corresponden uno a uno con los tipos
 * que ya usan las mini-apps en `src/apps/*`, porque el modelo que manda es el
 * del código (ver la decisión registrada en `.apex/`).
 */
import { z } from "zod";

import { crudRoutes } from "../lib/crud.js";
import { deleteBlob } from "../lib/blobs.js";
import {
  accounts,
  alerts,
  calendarEvents,
  chores,
  cycleDays,
  cycleLogs,
  destinations,
  expenses,
  files,
  folders,
  imbecilPings,
  incidents,
  mealPlan,
  notes,
  photos,
  recipes,
  shoppingItems,
  shoppingLists,
  sportRoutines,
  sportSessions,
  sportSports,
  talks,
  tasks,
  tractivePings,
  vaccines,
  walks,
  weightEntries,
  wishlist,
} from "../db/schema.js";

const who = z.enum(["irene", "vicente", "both"]);
const owner = z.enum(["shared", "irene", "vicente"]);
const repeat = z.enum(["none", "daily", "weekly", "monthly", "yearly"]);
/** `YYYY-MM-DD`, la fecha civil que teclea el usuario. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha con formato YYYY-MM-DD");
/** `HH:MM`, o vacío si dura todo el día. */
const clock = z.string().regex(/^(\d{2}:\d{2})?$/, "Hora con formato HH:MM");

/* -------------------------------------------------------------- calendario */

const eventCreate = z.object({
  title: z.string().min(1, "El evento necesita un título").max(200),
  date: isoDate,
  startsAt: clock.default(""),
  durationMin: z.number().int().min(0).max(1440).default(60),
  allDay: z.boolean().default(false),
  who: who.default("both"),
  notes: z.string().max(2000).default(""),
  repeat: repeat.default("none"),
  repeatUntil: z.union([isoDate, z.literal("")]).default(""),
});

export const calendarRoutes = crudRoutes(calendarEvents, {
  create: eventCreate,
  update: eventCreate.partial(),
  orderBy: calendarEvents.date,
  direction: "asc",
});

/* -------------------------------------------------------------------- notas */

const noteCreate = z.object({
  title: z.string().max(200).default(""),
  body: z.string().max(20_000).default(""),
  owner: owner.default("shared"),
  paper: z.string().max(32).default("#cfeae4"),
  pinned: z.boolean().default(false),
  position: z.number().int().default(0),
});

export const notesRoutes = crudRoutes(notes, {
  create: noteCreate,
  update: noteCreate.partial(),
  orderBy: notes.position,
  direction: "asc",
  filters: { owner: notes.owner },
});

/* ---------------------------------------------------------------- destinos */

const destinationCreate = z.object({
  name: z.string().min(1, "El destino necesita un nombre").max(200),
  country: z.string().max(120).nullish(),
  lat: z.number().min(-90).max(90).nullish(),
  lon: z.number().min(-180).max(180).nullish(),
  visited: z.boolean().default(false),
  visitedAt: z.union([isoDate, z.null()]).default(null),
  notes: z.string().max(2000).default(""),
});

export const destinationsRoutes = crudRoutes(destinations, {
  create: destinationCreate,
  update: destinationCreate.partial(),
  orderBy: destinations.createdAt,
});

/* -------------------------------------------------------------------- Nilo */

const vaccineCreate = z.object({
  name: z.string().min(1, "La vacuna necesita un nombre").max(200),
  appliedAt: isoDate,
  notes: z.string().max(2000).default(""),
});

export const vaccinesRoutes = crudRoutes(vaccines, {
  create: vaccineCreate,
  update: vaccineCreate.partial(),
  orderBy: vaccines.appliedAt,
});

const weightCreate = z.object({
  measuredAt: isoDate,
  // Un carlino adulto ronda los 8 kg; el rango es amplio a propósito pero
  // descarta el cero y los errores de tecleo de tres cifras de más.
  grams: z.number().int().min(100).max(100_000),
});

export const weightsRoutes = crudRoutes(weightEntries, {
  create: weightCreate,
  update: weightCreate.partial(),
  orderBy: weightEntries.measuredAt,
});

const walkCreate = z.object({
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().nullish(),
  durationSec: z.number().int().min(0).default(0),
  distanceM: z.number().int().min(0).default(0),
  steps: z.number().int().min(0).default(0),
  stepsSource: z.enum(["estimate", "shortcut"]).default("estimate"),
  route: z.array(z.array(z.number())).nullish(),
});

export const walksRoutes = crudRoutes(walks, {
  create: walkCreate,
  update: walkCreate.partial(),
  orderBy: walks.startedAt,
  withContext: (personId) => ({ createdBy: personId }),
});

/* ------------------------------------------------------------------ avisos */

const alertCreate = z.object({
  text: z.string().min(1).max(500),
  at: z.coerce.date().default(() => new Date()),
});

export const alertsRoutes = crudRoutes(alerts, {
  create: alertCreate,
  update: alertCreate.partial(),
  orderBy: alerts.at,
  withContext: (personId) => ({ from: personId }),
});

/* ------------------------------------------------------------------ compra */

const listCreate = z.object({
  name: z.string().min(1).max(120),
  archived: z.boolean().default(false),
});

export const shoppingListRoutes = crudRoutes(shoppingLists, {
  create: listCreate,
  update: listCreate.partial(),
  orderBy: shoppingLists.createdAt,
});

const itemCreate = z.object({
  listId: z.string().uuid(),
  productId: z.string().max(64).nullish(),
  name: z.string().min(1).max(200),
  quantity: z.number().min(0).default(1),
  unit: z.string().max(32).nullish(),
  priceCents: z.number().int().min(0).nullish(),
  checked: z.boolean().default(false),
  position: z.number().int().default(0),
});

export const shoppingItemRoutes = crudRoutes(shoppingItems, {
  create: itemCreate,
  update: itemCreate.partial(),
  orderBy: shoppingItems.position,
  direction: "asc",
  filters: { listId: shoppingItems.listId },
});

/* ------------------------------------------------------------------ dinero */

const accountCreate = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(["bank", "cash", "card"]).default("bank"),
  currency: z.string().length(3).default("EUR"),
  balanceCents: z.number().int().default(0),
  institution: z.string().max(120).nullish(),
});

export const accountsRoutes = crudRoutes(accounts, {
  create: accountCreate,
  update: accountCreate.partial(),
  orderBy: accounts.createdAt,
  withContext: (personId) => ({ ownerId: personId }),
});

const expenseCreate = z.object({
  description: z.string().min(1).max(300),
  /** Céntimos enteros. Nunca float para dinero. */
  amountCents: z.number().int(),
  currency: z.string().length(3).default("EUR"),
  category: z.string().max(80).nullish(),
  splitMode: z.enum(["even", "payer", "custom"]).default("even"),
  splitDetail: z.record(z.string(), z.number()).nullish(),
  accountId: z.string().uuid().nullish(),
  occurredAt: isoDate,
});

export const expensesRoutes = crudRoutes(expenses, {
  create: expenseCreate,
  update: expenseCreate.partial(),
  orderBy: expenses.occurredAt,
  withContext: (personId) => ({ paidBy: personId }),
});

/* ------------------------------------------------------------------ Tareas */

const taskCreate = z.object({
  text: z.string().max(500).default(""),
  done: z.boolean().default(false),
  owner: owner.default("shared"),
  position: z.number().int().default(0),
});

export const taskRoutes = crudRoutes(tasks, {
  create: taskCreate,
  update: taskCreate.partial(),
  orderBy: tasks.position,
  direction: "asc",
  filters: { owner: tasks.owner },
});

/* ------------------------------------------------------------- Incidencias */

const incidentCreate = z.object({
  title: z.string().min(1, "La incidencia necesita un título").max(200),
  description: z.string().max(2000).default(""),
  priority: z.enum(["baja", "media", "alta"]).default("media"),
  assignee: who.default("both"),
  dueDays: z.number().int().min(0).max(365).default(0),
  done: z.boolean().default(false),
  // Epoch ms; 0 llega como 0 y se guarda como 0 (el frontend nunca manda null).
  doneAt: z.number().int().nullable().default(null),
});

export const incidentRoutes = crudRoutes(incidents, {
  create: incidentCreate,
  update: incidentCreate.partial(),
  orderBy: incidents.createdAt,
});

/* -------------------------------------------------------------- Por hablar */

const talkCreate = z.object({
  title: z.string().min(1, "El tema necesita un título").max(200),
  description: z.string().max(2000).default(""),
  raisedBy: who.default("both"),
  done: z.boolean().default(false),
  talkedAt: z.number().int().nullable().default(null),
});

export const talkRoutes = crudRoutes(talks, {
  create: talkCreate,
  update: talkCreate.partial(),
  orderBy: talks.createdAt,
});

/* -------------------------------------------------------------------- Casa */

const choreCreate = z.object({
  title: z.string().min(1, "La tarea necesita un título").max(200),
  everyWeeks: z.number().int().min(0).max(52).default(1), // 0 = puntual
  lastDoneAt: z.number().int().nullable().default(null),
  lastDoneBy: z.enum(["", "irene", "vicente"]).default(""),
  position: z.number().int().default(0),
});

export const choreRoutes = crudRoutes(chores, {
  create: choreCreate,
  update: choreCreate.partial(),
  orderBy: chores.position,
  direction: "asc",
});

/* ------------------------------------------------------------------- Ciclo */

const cycleDayCreate = z.object({
  date: isoDate,
});

export const cycleDayRoutes = crudRoutes(cycleDays, {
  create: cycleDayCreate,
  update: cycleDayCreate.partial(),
  orderBy: cycleDays.date,
  direction: "asc",
});

const cycleLogCreate = z.object({
  date: isoDate,
  symptoms: z.array(z.string().max(60)).max(40).default([]),
  moods: z.array(z.string().max(60)).max(40).default([]),
  flow: z.enum(["", "ligero", "medio", "fuerte"]).default(""),
  note: z.string().max(2000).default(""),
});

export const cycleLogRoutes = crudRoutes(cycleLogs, {
  create: cycleLogCreate,
  update: cycleLogCreate.partial(),
  orderBy: cycleLogs.date,
  direction: "asc",
});

/* ------------------------------------------------------------------- Fotos */

const photoCreate = z.object({
  name: z.string().min(1).max(300),
  mime: z.string().max(100).default("image/*"),
  uploadedBy: z.enum(["", "irene", "vicente"]).default(""),
  position: z.number().int().default(0),
});

export const photoRoutes = crudRoutes(photos, {
  create: photoCreate,
  update: photoCreate.partial(),
  orderBy: photos.position,
  direction: "asc",
  // Borrar la foto borra su binario; si no, el blob quedaría huérfano en disco.
  onDelete: (id) => deleteBlob(id),
});

/* --------------------------------------------------------------- RAG-Pugtín */

const folderCreate = z.object({
  name: z.string().min(1).max(200),
  parentId: z.string().max(64).default(""),
  createdBy: z.enum(["", "irene", "vicente"]).default(""),
});

export const folderRoutes = crudRoutes(folders, {
  create: folderCreate,
  update: folderCreate.partial(),
  orderBy: folders.createdAt,
});

const fileCreate = z.object({
  name: z.string().min(1).max(300),
  folderId: z.string().max(64).default(""),
  mime: z.string().max(200).default(""),
  size: z.number().int().min(0).default(0),
  tags: z.array(z.string().max(60)).max(40).default([]),
  uploadedBy: z.enum(["", "irene", "vicente"]).default(""),
});

export const fileRoutes = crudRoutes(files, {
  create: fileCreate,
  update: fileCreate.partial(),
  orderBy: files.createdAt,
  filters: { folderId: files.folderId },
  // Borrar el fichero borra su binario; sus trozos de RAG caen solos por el
  // `onDelete: cascade` de `file_chunks`.
  onDelete: (id) => deleteBlob(id),
});

/* -------------------------------------------------------------- Recetario */

/**
 * Un ingrediente es texto (`text`) y, opcionalmente, el producto de Mercadona al
 * que apunta (`productId`), para poder añadirlo al carrito desde el Menú. Se
 * acepta también un string suelto —la forma vieja— y se normaliza a objeto, así
 * las recetas anteriores siguen validando y el frontend recibe siempre objetos.
 */
const ingredient = z
  .union([
    z.string().max(200),
    z.object({
      text: z.string().min(1).max(200),
      productId: z.string().max(64).nullish(),
    }),
  ])
  .transform((v) => (typeof v === "string" ? { text: v, productId: null } : v));

const recipeCreate = z.object({
  title: z.string().min(1, "La receta necesita un título").max(200),
  ingredients: z.array(ingredient).default([]),
  timeMin: z.number().int().min(0).max(6000).default(0),
  tags: z.array(z.string().max(40)).default([]),
  steps: z.string().max(10_000).default(""),
  position: z.number().int().default(0),
});

export const recipeRoutes = crudRoutes(recipes, {
  create: recipeCreate,
  update: recipeCreate.partial(),
  orderBy: recipes.position,
  direction: "asc",
});

/* ----------------------------------------------------------- Menú semanal */

const mealCreate = z.object({
  date: isoDate,
  meal: z.enum(["desayuno", "comida", "cena"]),
  // Referencia suelta a la receta (no es UUID validado: si la receta se borra,
  // la entrada del menú sigue viva con su `title` congelado).
  recipeId: z.string().min(1),
  title: z.string().min(1).max(200),
});

export const mealRoutes = crudRoutes(mealPlan, {
  create: mealCreate,
  update: mealCreate.partial(),
  orderBy: mealPlan.date,
  direction: "asc",
});

/* ---------------------------------------------------------------- Wishlist */

const wishCreate = z.object({
  title: z.string().min(1, "Necesita un título").max(200),
  kind: z.enum(["peli", "serie"]).default("peli"),
  who: who.default("both"),
  note: z.string().max(2000).default(""),
  seen: z.boolean().default(false),
  // Epoch ms; 0 llega como 0 (el frontend manda 0, no null, mientras está por
  // ver). Igual que `talkedAt` de «Por hablar».
  seenAt: z.number().int().nullable().default(null),
  position: z.number().int().default(0),
});

export const wishRoutes = crudRoutes(wishlist, {
  create: wishCreate,
  update: wishCreate.partial(),
  orderBy: wishlist.createdAt,
});

/* ----------------------------------------------------------------- Deporte */

const sportSportCreate = z.object({
  name: z.string().min(1).max(60),
  emoji: z.string().max(8).default("🏅"),
  position: z.number().int().default(0),
});

export const sportSportRoutes = crudRoutes(sportSports, {
  create: sportSportCreate,
  update: sportSportCreate.partial(),
  orderBy: sportSports.position,
  direction: "asc",
});

const sportSessionCreate = z.object({
  user: z.enum(["irene", "vicente"]),
  sport: z.string().min(1).max(60),
  emoji: z.string().max(8).default("🏅"),
  durationSec: z.number().int().min(0),
  note: z.string().max(2000).default(""),
  doneAt: z.number().int(), // epoch ms; el frontend siempre lo manda
});

export const sportSessionRoutes = crudRoutes(sportSessions, {
  create: sportSessionCreate,
  update: sportSessionCreate.partial(),
  orderBy: sportSessions.doneAt,
  filters: { user: sportSessions.user },
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

export const sportRoutineRoutes = crudRoutes(sportRoutines, {
  create: sportRoutineCreate,
  update: sportRoutineCreate.partial(),
  orderBy: sportRoutines.updatedAt,
  filters: { user: sportRoutines.user },
});

/* ------------------------------------------------------- Imbécil / Tractive */

// El aviso push lo manda el frontend por ntfy; estas dos colecciones son sólo
// el historial. Sin filtros ni contexto: se listan enteras, más recientes
// primero (el `crudRoutes` ordena por id desc por defecto, pero fijamos
// `createdAt` para que el orden sea el temporal real).

const imbecilCreate = z.object({
  from: who,
  text: z.string().min(1).max(500),
  emoji: z.string().max(8).default(""),
});

export const imbecilRoutes = crudRoutes(imbecilPings, {
  create: imbecilCreate,
  update: imbecilCreate.partial(),
  orderBy: imbecilPings.createdAt,
});

const tractiveCreate = z.object({
  text: z.string().min(1).max(500),
});

export const tractiveRoutes = crudRoutes(tractivePings, {
  create: tractiveCreate,
  update: tractiveCreate.partial(),
  orderBy: tractivePings.createdAt,
});
