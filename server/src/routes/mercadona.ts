/**
 * Carrito de la compra de Mercadona.
 *
 * Dos piezas:
 *  - **Catálogo** (`mercadona_products`): productos importados de la API pública
 *    de Mercadona (`tienda.mercadona.es/api`, warehouse `vlc1` para el CP 46117
 *    de Vicente e Irene). El id es el id real de Mercadona.
 *  - **Carrito** (`mercadona_cart`): la lista de la compra compartida, con
 *    cantidad y si cada producto está cogido (`checked`).
 *
 * La API de Mercadona no es oficial y no tiene búsqueda ni listado masivo: el
 * catálogo se llena recorriendo categorías (lo hace el script de import), y aquí
 * sólo se sirve lo ya guardado más un refresco de precio por id.
 */
import { asc, desc, eq, ilike } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "../db/client.js";
import { mercadonaCart, mercadonaProducts } from "../db/schema.js";
import type { AuthVars } from "../auth/middleware.js";

type Env = { Bindings: Record<string, never>; Variables: AuthVars };

const app = new Hono<Env>();

const MERCADONA_API = "https://tienda.mercadona.es/api";
const WAREHOUSE = process.env.MERCADONA_WH ?? "vlc1";

/* ------------------------------------------------------------------ catálogo */

/**
 * Lista el catálogo. `?q=` filtra por nombre; sin `q`, devuelve los favoritos
 * (la lista habitual de la pareja) ordenados por `position`. El filtro por texto
 * abre a todo el catálogo para poder añadir cosas puntuales.
 */
app.get("/products", async (c) => {
  const q = c.req.query("q")?.trim();

  if (q) {
    const rows = await db
      .select()
      .from(mercadonaProducts)
      .where(ilike(mercadonaProducts.name, `%${q}%`))
      .orderBy(desc(mercadonaProducts.favorite), asc(mercadonaProducts.name))
      .limit(60);
    return c.json(rows);
  }

  const rows = await db
    .select()
    .from(mercadonaProducts)
    .where(eq(mercadonaProducts.favorite, true))
    .orderBy(asc(mercadonaProducts.position), asc(mercadonaProducts.name));
  return c.json(rows);
});

/* -------------------------------------------------------------------- carrito */

/**
 * El carrito con los datos del producto ya embebidos (nombre, precio, foto), de
 * un tirón, para que el frontend no tenga que cruzar dos colecciones. El
 * `productId` es una referencia suelta: si el producto ya no está en el
 * catálogo, la línea se omite (LEFT JOIN + filtro).
 */
app.get("/cart", async (c) => {
  const rows = await db
    .select({
      id: mercadonaCart.id,
      productId: mercadonaCart.productId,
      quantity: mercadonaCart.quantity,
      checked: mercadonaCart.checked,
      position: mercadonaCart.position,
      createdAt: mercadonaCart.createdAt,
      updatedAt: mercadonaCart.updatedAt,
      name: mercadonaProducts.name,
      packaging: mercadonaProducts.packaging,
      thumbnail: mercadonaProducts.thumbnail,
      priceCents: mercadonaProducts.priceCents,
    })
    .from(mercadonaCart)
    .leftJoin(mercadonaProducts, eq(mercadonaCart.productId, mercadonaProducts.id))
    .orderBy(asc(mercadonaCart.checked), asc(mercadonaCart.position));

  return c.json(rows);
});

const cartAddSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
});

/**
 * Añade un producto al carrito. Si ya está, sube la cantidad en vez de duplicar
 * la línea (upsert sobre `productId`), que es lo que espera quien pulsa «+» dos
 * veces en el mismo producto.
 */
app.post("/cart", async (c) => {
  const parsed = cartAddSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: { code: "INVALID_BODY", message: "Datos inválidos", detail: parsed.error.issues } },
      400,
    );
  }
  const { productId, quantity } = parsed.data;

  const [existing] = await db
    .select()
    .from(mercadonaCart)
    .where(eq(mercadonaCart.productId, productId))
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(mercadonaCart)
      .set({ quantity: existing.quantity + quantity, checked: false, updatedAt: new Date() })
      .where(eq(mercadonaCart.id, existing.id))
      .returning();
    return c.json(row);
  }

  const [row] = await db.insert(mercadonaCart).values({ productId, quantity }).returning();
  return c.json(row, 201);
});

const cartPatchSchema = z.object({
  quantity: z.number().int().min(1).optional(),
  checked: z.boolean().optional(),
  position: z.number().int().optional(),
});

app.patch("/cart/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = cartPatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "INVALID_BODY", message: "Datos inválidos", detail: parsed.error.issues } },
      400,
    );
  }
  // Sólo las claves enviadas (mismo criterio que la fábrica CRUD: un PATCH
  // parcial no debe pisar campos ausentes).
  const sent = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const patch = Object.fromEntries(
    Object.entries(parsed.data).filter(([k]) => k in sent),
  );
  if (Object.keys(patch).length === 0) {
    return c.json({ error: { code: "EMPTY_PATCH", message: "Nada que cambiar" } }, 400);
  }

  const [row] = await db
    .update(mercadonaCart)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(mercadonaCart.id, c.req.param("id")))
    .returning();

  if (!row) return c.json({ error: { code: "NOT_FOUND", message: "No existe" } }, 404);
  return c.json(row);
});

app.delete("/cart/:id", async (c) => {
  const deleted = await db
    .delete(mercadonaCart)
    .where(eq(mercadonaCart.id, c.req.param("id")))
    .returning({ id: mercadonaCart.id });
  if (deleted.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: "No existe" } }, 404);
  }
  return c.body(null, 204);
});

/**
 * Vacía las líneas ya marcadas (cogidas): el botón «quitar lo comprado» al
 * terminar la compra. Devuelve cuántas quitó.
 */
app.post("/cart/clear-checked", async (c) => {
  const deleted = await db
    .delete(mercadonaCart)
    .where(eq(mercadonaCart.checked, true))
    .returning({ id: mercadonaCart.id });
  return c.json({ removed: deleted.length });
});

/* ------------------------------------------------------------ refresco precio */

/**
 * Refresca el precio de un producto consultando la API de Mercadona por su id.
 * Tolera fallos: si la API no responde o cambió, deja el precio como estaba y
 * avisa, en vez de romper. El precio va en céntimos.
 */
app.post("/refresh/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const res = await fetch(`${MERCADONA_API}/products/${id}/?wh=${WAREHOUSE}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return c.json({ error: { code: "UPSTREAM", message: `Mercadona respondió ${res.status}` } }, 502);
    }
    const p = (await res.json()) as {
      display_name?: string;
      thumbnail?: string;
      packaging?: string;
      price_instructions?: { unit_price?: string };
    };
    const priceCents = Math.round(Number(p.price_instructions?.unit_price ?? 0) * 100);

    const [row] = await db
      .update(mercadonaProducts)
      .set({
        priceCents,
        name: p.display_name ?? undefined,
        thumbnail: p.thumbnail ?? undefined,
        packaging: p.packaging ?? undefined,
        refreshedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mercadonaProducts.id, id))
      .returning();

    if (!row) return c.json({ error: { code: "NOT_FOUND", message: "No está en el catálogo" } }, 404);
    return c.json(row);
  } catch {
    return c.json({ error: { code: "UPSTREAM", message: "No se pudo consultar Mercadona" } }, 502);
  }
});

export default app;
