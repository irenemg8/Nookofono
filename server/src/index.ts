/**
 * Punto de entrada de la API de iPug.
 *
 * El mismo proceso sirve la API y el frontend compilado, igual que hacía el
 * Worker en el diseño original: sin dos dominios no hay CORS que configurar ni
 * cookies entre orígenes, que es la fuente habitual de problemas.
 */
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";

import { requireAuth, type AuthVars } from "./auth/middleware.js";
import { pool } from "./db/client.js";
import authRoutes from "./routes/auth.js";
import preferencesRoutes from "./routes/preferences.js";
import profileRoutes from "./routes/profile.js";
import stepsRoutes from "./routes/steps.js";
import {
  accountsRoutes,
  alertsRoutes,
  calendarRoutes,
  destinationsRoutes,
  expensesRoutes,
  notesRoutes,
  shoppingItemRoutes,
  shoppingListRoutes,
  vaccinesRoutes,
  walksRoutes,
  weightsRoutes,
} from "./routes/resources.js";

// Sin secreto de firma cualquiera podría fabricarse una sesión. Se comprueba al
// arrancar y no en la primera petición, para que el fallo salga en el despliegue
// y no cuando alguien intente entrar.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET debe existir y tener al menos 32 caracteres");
}

const app = new Hono<{ Bindings: Record<string, never>; Variables: AuthVars }>();

app.use("*", secureHeaders());

/** Sonda para el healthcheck del contenedor. No toca la base de datos. */
app.get("/api/health", (c) => c.json({ ok: true }));

// Pública: es la puerta de entrada.
app.route("/api/auth", authRoutes);

// El POST de pasos trae su propio token (el Atajo de iOS no maneja cookies), así
// que se monta ANTES del guardia. El GET de dentro sí exige sesión.
app.route("/api/steps", stepsRoutes);

// A partir de aquí, todo exige sesión.
app.use("/api/*", requireAuth);

app.route("/api/calendar", calendarRoutes);
app.route("/api/notes", notesRoutes);
app.route("/api/destinations", destinationsRoutes);
app.route("/api/vaccines", vaccinesRoutes);
app.route("/api/weights", weightsRoutes);
app.route("/api/walks", walksRoutes);
app.route("/api/alerts", alertsRoutes);
app.route("/api/shopping/lists", shoppingListRoutes);
app.route("/api/shopping/items", shoppingItemRoutes);
app.route("/api/accounts", accountsRoutes);
app.route("/api/expenses", expensesRoutes);
app.route("/api/preferences", preferencesRoutes);
app.route("/api/profile", profileRoutes);

// Cualquier ruta de API que no exista devuelve JSON, no el index.html: si no,
// un fallo de escritura en una URL se manifestaría como "la app no carga".
app.all("/api/*", (c) =>
  c.json({ error: { code: "NOT_FOUND", message: "Ruta no encontrada" } }, 404),
);

/* ------------------------------------------------------------- frontend */

const STATIC_ROOT = process.env.STATIC_ROOT ?? "./public";

app.use("/*", serveStatic({ root: STATIC_ROOT }));

// La app es de una sola página: cualquier ruta desconocida devuelve el index
// para que recargar en `/calendario` no dé 404.
app.get("*", serveStatic({ path: "index.html", root: STATIC_ROOT }));

const port = Number(process.env.PORT ?? 8011);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`iPug API escuchando en el puerto ${info.port}`);
});

/**
 * Apagado limpio: sin esto, Docker manda SIGTERM, el proceso muere de golpe y
 * las peticiones en vuelo se cortan a mitad.
 */
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
}

export default app;
