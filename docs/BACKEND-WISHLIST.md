# Backend pendiente para «Wishlist» (pelis y series)

> Para Vicente. Frontend hecho (`src/apps/wishlist/`). Una colección con el
> patrón `crudRoutes` de siempre. Sin crons ni ntfy. No he tocado `server/`.
> Lista **compartida**: Irene y Vicente ven y editan lo mismo.

## Tabla `wishlist`

```ts
export const wishlist = pgTable("wishlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("peli"),   // 'peli' | 'serie'
  who: text("who").notNull().default("both"),     // 'irene' | 'vicente' | 'both'
  note: text("note").notNull().default(""),
  seen: boolean("seen").notNull().default(false),
  seenAt: timestamp("seen_at"),                    // null mientras no se ve
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

⚠️ `seenAt` viaja como **epoch ms** (0 mientras no se ha visto). Si en la BD es
`timestamp`, que el mapper convierta null↔0, igual que `talkedAt` en «Por hablar».

```ts
const wishCreate = z.object({
  title: z.string().min(1).max(200),
  kind: z.enum(["peli", "serie"]).default("peli"),
  who: who.default("both"),                 // el enum `who` ya existe
  note: z.string().max(2000).default(""),
  seen: z.boolean().default(false),
  seenAt: z.number().int().nullable().default(null),
  position: z.number().int().default(0),
});
export const wishRoutes = crudRoutes(wishlist, { create: wishCreate, update: wishCreate.partial() });
```

```ts
app.route("/api/wishlist", wishRoutes);
```

## Contrato

`{ id, title, kind, who, note, seen, seenAt, position, createdAt, updatedAt }`
— tiempos en epoch ms; `seenAt` es 0 mientras está por ver.
