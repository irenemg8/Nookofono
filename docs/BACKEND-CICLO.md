# Backend pendiente para «Ciclo»

> Para Vicente. Frontend hecho (`src/apps/cycle/`). **Dos** colecciones:
> `/api/cycle/periods` (cuándo empieza y cuánto dura cada regla) y
> `/api/cycle/logs` (el diario diario: flujo, síntomas, ánimo, nota). No he
> tocado `server/`.

## Tablas

```ts
export const cyclePeriods = pgTable("cycle_periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  start: text("start").notNull(),               // 'YYYY-MM-DD'
  bleedDays: integer("bleed_days").notNull().default(0), // 0 = aún abierta
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const cycleLogs = pgTable("cycle_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: text("date").notNull(),                 // 'YYYY-MM-DD'
  symptoms: jsonb("symptoms").notNull().default("[]"),  // string[]
  moods: jsonb("moods").notNull().default("[]"),        // string[]
  flow: text("flow").notNull().default(""),     // ''|'ligero'|'medio'|'fuerte'
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

Rutas:

```ts
app.route("/api/cycle/periods", periodRoutes);
app.route("/api/cycle/logs", logRoutes);
```

`symptoms` y `moods` son **arrays de strings**; cuida el mapper si van en jsonb.

## Privacidad

Estos datos son de Irene, pero la app **no** los oculta a Vicente a nivel de
API: es él quien ve una vista distinta (el estado de «Belinda», sin el diario).
Si quieres que el diario sea sólo de Irene también en el servidor, filtra por
`userId` de la sesión en estas dos rutas. Decisión vuestra.

## Notificaciones

- **Al empezar la regla**, el frontend avisa a Vicente por ntfy
  (`ipug-belinda-2a9c7e4f1d38`). Sin backend.
- **Recordatorios previstos** (regla o días fértiles a la vuelta de la esquina)
  serían un cron de servidor, como el de «Por hablar»: cada mañana, calcular la
  predicción y, si el día siguiente cae en fértil o regla, avisar. La predicción
  ya está en `src/apps/cycle/model/predict.ts`; se puede portar al servidor.

## La predicción

Es puro frontend (`predict.ts`): media de la duración entre reglas, ovulación a
14 días de la siguiente, fértil los 5 días previos + el de ovular. **Es
estadística, no anticonceptiva**, y la app lo dice. Si algún día se quiere en el
servidor (para los recordatorios), el algoritmo es ése.
