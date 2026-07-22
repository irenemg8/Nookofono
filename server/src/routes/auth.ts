/**
 * Inicio y cierre de sesión.
 *
 * Es la única parte pública de la API. Todo lo demás cuelga de `requireAuth`.
 */
import { eq, lt } from "drizzle-orm";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { z } from "zod";

import { hit, reset } from "../auth/rate-limit.js";
import {
  COOKIE_NAME,
  clearCookieHeader,
  cookieHeader,
  signSession,
  verifySession,
} from "../auth/session.js";
import { verifyTotp } from "../auth/totp.js";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import type { AuthVars } from "../auth/middleware.js";

const app = new Hono<{ Bindings: Record<string, never>; Variables: AuthVars }>();

const verifySchema = z.object({
  userId: z.enum(["irene", "vicente"]),
  code: z.string().regex(/^\d{6}$/, "El código son 6 dígitos"),
});

const secure = () => process.env.NODE_ENV === "production";
const ttlDays = () => Number(process.env.SESSION_TTL_DAYS ?? 30);

app.post("/verify", async (c) => {
  const parsed = verifySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: "INVALID_BODY", message: "Faltan datos" } }, 400);
  }

  const { userId, code } = parsed.data;

  const limit = hit(
    `auth:${userId}`,
    Number(process.env.RATE_LIMIT_AUTH_MAX ?? 5),
    Number(process.env.RATE_LIMIT_AUTH_WINDOW_S ?? 900),
  );
  if (!limit.allowed) {
    return c.json(
      { error: { code: "RATE_LIMITED", message: "Demasiados intentos. Prueba más tarde." } },
      429,
      { "Retry-After": String(limit.retryAfter) },
    );
  }

  const result = await verifyTotp(userId, code, Number(process.env.TOTP_WINDOW ?? 1));

  if (result === "unconfigured") {
    return c.json(
      { error: { code: "TOTP_UNCONFIGURED", message: "Este usuario no tiene autenticador" } },
      403,
    );
  }
  if (result !== "ok") {
    // Se responde igual para código inválido y para código repetido: decir
    // "ese código ya se usó" le confirmaría al atacante que lo había acertado.
    return c.json({ error: { code: "INVALID_TOTP", message: "El código no es válido" } }, 401);
  }

  reset(`auth:${userId}`);

  const { token, claims } = await signSession(process.env.JWT_SECRET!, userId, ttlDays());

  await db.insert(sessions).values({
    jti: claims.jti,
    personId: userId,
    userAgent: c.req.header("user-agent")?.slice(0, 300) ?? null,
    expiresAt: new Date(claims.exp * 1000),
  });

  // Aprovecha el login para limpiar sesiones caducadas.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

  const person = await db.query.users.findFirst({ where: eq(users.id, userId) });

  c.header("Set-Cookie", cookieHeader(token, ttlDays(), secure()));
  return c.json({ userId, displayName: person?.displayName ?? userId });
});

app.post("/logout", async (c) => {
  const claims = await verifySession(process.env.JWT_SECRET!, getCookie(c, COOKIE_NAME));
  if (claims) await db.delete(sessions).where(eq(sessions.jti, claims.jti));

  c.header("Set-Cookie", clearCookieHeader(secure()));
  return c.body(null, 204);
});

app.get("/me", async (c) => {
  const claims = await verifySession(process.env.JWT_SECRET!, getCookie(c, COOKIE_NAME));
  if (!claims) return c.json({ error: { code: "UNAUTHORIZED", message: "Sin sesión" } }, 401);

  const live = await db.query.sessions.findFirst({ where: eq(sessions.jti, claims.jti) });
  if (!live) return c.json({ error: { code: "SESSION_REVOKED", message: "Sesión cerrada" } }, 401);

  const person = await db.query.users.findFirst({ where: eq(users.id, claims.sub) });
  return c.json({ userId: claims.sub, displayName: person?.displayName ?? claims.sub });
});

export default app;
