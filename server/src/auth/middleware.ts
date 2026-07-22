/**
 * Guardia de las rutas privadas.
 *
 * Comprueba la firma del JWT y, además, que la sesión siga viva en la tabla
 * `sessions`. Ese segundo paso es lo que permite echar a un móvil perdido antes
 * de que caduque el token: se borra la fila y el `jti` deja de valer.
 */
import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { eq } from "drizzle-orm";

import { db } from "../db/client.js";
import { sessions } from "../db/schema.js";
import { COOKIE_NAME, verifySession } from "./session.js";

export interface AuthVars {
  personId: string;
}

export const requireAuth: MiddlewareHandler<{
  Bindings: Record<string, never>;
  Variables: AuthVars;
}> = async (c, next) => {
  const claims = await verifySession(process.env.JWT_SECRET!, getCookie(c, COOKIE_NAME));
  if (!claims) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Inicia sesión" } }, 401);
  }

  const live = await db.query.sessions.findFirst({ where: eq(sessions.jti, claims.jti) });
  if (!live) {
    return c.json({ error: { code: "SESSION_REVOKED", message: "Sesión cerrada" } }, 401);
  }

  c.set("personId", claims.sub);
  await next();
};
