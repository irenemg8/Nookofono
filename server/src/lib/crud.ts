/**
 * Fábrica de rutas CRUD.
 *
 * Añadir una mini-app al backend es crear la tabla y una línea aquí. Es la
 * simetría del `registry.ts` del frontend: una app nueva no obliga a escribir
 * cinco endpoints a mano. Ver `docs/MIGRACION-BACKEND.md` §7.2.
 *
 * Todos los recursos son **compartidos** entre Irene y Vicente: es una app de
 * pareja, y las notas ya llevan su propio campo `owner` para separarlas cuando
 * hace falta. No hay filtrado por usuario a nivel de fila.
 */
import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import type { ZodType } from "zod";

import { db } from "../db/client.js";
import type { AuthVars } from "../auth/middleware.js";

type Env = { Bindings: Record<string, never>; Variables: AuthVars };

export interface CrudOptions<TCreate, TUpdate> {
  /** Esquema de validación al crear. */
  create: ZodType<TCreate>;
  /** Esquema al actualizar; suele ser el anterior en versión parcial. */
  update: ZodType<TUpdate>;
  /** Columna por la que se ordena al listar. */
  orderBy?: PgColumn;
  direction?: "asc" | "desc";
  /** Filtros admitidos por query string, p. ej. `?owner=irene`. */
  filters?: Record<string, PgColumn>;
  /** Rellena campos derivados del servidor (quién lo creó, etc.). */
  withContext?: (personId: string) => Record<string, unknown>;
}

/**
 * `table` lleva `any` porque Drizzle no expone un tipo genérico útil para "una
 * tabla cualquiera con columna id": cada `pgTable` produce un tipo distinto. El
 * tipado real lo aportan los esquemas zod de entrada y salida.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function crudRoutes<TCreate, TUpdate>(
  table: PgTable & { id: PgColumn },
  opts: CrudOptions<TCreate, TUpdate>,
) {
  const r = new Hono<Env>();
  const dir = opts.direction === "asc" ? asc : desc;

  r.get("/", async (c) => {
    const where: SQL[] = [];

    for (const [param, column] of Object.entries(opts.filters ?? {})) {
      const value = c.req.query(param);
      if (value !== undefined) where.push(eq(column, value));
    }

    const rows = await db
      .select()
      .from(table)
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(opts.orderBy ? dir(opts.orderBy) : dir(table.id));

    return c.json(rows);
  });

  r.get("/:id", async (c) => {
    const [row] = await db.select().from(table).where(eq(table.id, c.req.param("id"))).limit(1);
    if (!row) return c.json({ error: { code: "NOT_FOUND", message: "No existe" } }, 404);
    return c.json(row);
  });

  r.post("/", async (c) => {
    const parsed = opts.create.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_BODY", message: "Datos inválidos", detail: parsed.error.issues } },
        400,
      );
    }

    const extra = opts.withContext?.(c.get("personId")) ?? {};
    const [row] = await db
      .insert(table)
      .values({ ...parsed.data, ...extra } as never)
      .returning();

    return c.json(row, 201);
  });

  r.patch("/:id", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = opts.update.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_BODY", message: "Datos inválidos", detail: parsed.error.issues } },
        400,
      );
    }

    // Sólo se escriben las claves que venían en la petición.
    //
    // Los esquemas de update son el de creación en versión `.partial()`, y zod
    // sigue aplicando los `.default()` de los campos ausentes: sin este filtro,
    // un PATCH del título vaciaría el cuerpo de la nota, le cambiaría el dueño y
    // la desfijaría. Es decir, editar borraría datos.
    const sent = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const patch = Object.fromEntries(
      Object.entries(parsed.data as Record<string, unknown>).filter(([key]) => key in sent),
    );

    if (Object.keys(patch).length === 0) {
      return c.json({ error: { code: "EMPTY_PATCH", message: "No hay nada que cambiar" } }, 400);
    }

    const [row] = await db
      .update(table)
      .set({ ...patch, updatedAt: new Date() } as never)
      .where(eq(table.id, c.req.param("id")))
      .returning();

    if (!row) return c.json({ error: { code: "NOT_FOUND", message: "No existe" } }, 404);
    return c.json(row);
  });

  r.delete("/:id", async (c) => {
    const deleted = await db
      .delete(table)
      .where(eq(table.id, c.req.param("id")))
      .returning({ id: table.id });

    if (deleted.length === 0) {
      return c.json({ error: { code: "NOT_FOUND", message: "No existe" } }, 404);
    }
    return c.body(null, 204);
  });

  return r;
}
