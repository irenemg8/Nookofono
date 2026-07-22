# iPug — Manual de migración a backend

> De **GitHub Pages con datos de ejemplo** a **Cloudflare Workers con datos reales**.
>
> Escrito para que la migración sea mecánica: cada variable, cada binding, cada
> endpoint y cada fichero está nombrado y explicado. Si en el futuro cambias
> Cloudflare por otra cosa, la sección §14 te dice qué piezas se tocan.

**Fecha:** 22 de julio de 2026 · **Documento hermano:** [`PROYECTO.md`](./PROYECTO.md)

---

## Índice

1. [Punto de partida y punto de llegada](#1-punto-de-partida-y-punto-de-llegada)
2. [Requisitos previos](#2-requisitos-previos)
3. [Mapa de piezas: qué conecta con qué](#3-mapa-de-piezas-qué-conecta-con-qué)
4. [Variables y secretos: catálogo completo](#4-variables-y-secretos-catálogo-completo)
5. [Bindings y `wrangler.jsonc`](#5-bindings-y-wranglerjsonc)
6. [Esquema de base de datos](#6-esquema-de-base-de-datos)
7. [Estructura del Worker](#7-estructura-del-worker)
8. [Contrato de la API](#8-contrato-de-la-api)
9. [Autenticación TOTP paso a paso](#9-autenticación-totp-paso-a-paso)
10. [El cambio en el frontend](#10-el-cambio-en-el-frontend)
11. [Fotos y archivos en R2](#11-fotos-y-archivos-en-r2)
12. [Proxies de terceros](#12-proxies-de-terceros)
13. [Despliegue y CI/CD](#13-despliegue-y-cicd)
14. [Migración de los datos existentes](#14-migración-de-los-datos-existentes)
15. [Cambiar a otra tecnología](#15-cambiar-a-otra-tecnología)
16. [Checklist final](#16-checklist-final)

---

## 1. Punto de partida y punto de llegada

### Antes (fase 1)

```
Navegador
  └─ https://<usuario>.github.io/ipug   (estático, público)
       └─ localStorage / IndexedDB      (datos de ejemplo, solo en tu móvil)
```

Sin servidor. Sin login real. Sin datos compartidos entre Irene y Vicente: cada
uno ve los suyos, porque `localStorage` es local al dispositivo.

### Después (fase 2)

```
Navegador
  └─ https://ipug.<subdominio>.workers.dev
       │
       ├─ Assets estáticos  ── servidos por el Worker (GRATIS E ILIMITADOS)
       │
       └─ /api/*  ────────── Worker (Hono)
                              ├─ Cookie de sesión JWT (HttpOnly)
                              ├─ D1      → datos
                              ├─ R2      → fotos y archivos
                              ├─ KV      → rate limits y revocación
                              └─ fetch() → Mercadona, Anthropic
```

**Lo que cambia en el frontend: una línea.** Ver §10. Ese es el objetivo entero
de la arquitectura de puertos y adaptadores.

---

## 2. Requisitos previos

| Requisito | Coste | Notas |
|---|---|---|
| Cuenta de Cloudflare | Gratis | No pide tarjeta para el plan free |
| Node.js ≥ 20 | Gratis | Ya lo tienes (v22.13.1) |
| `wrangler` CLI | Gratis | `npm i -D wrangler` |
| Google/Microsoft Authenticator | Gratis | En el móvil de cada uno |
| Gestor de contraseñas | — | **Imprescindible** para guardar los secretos TOTP |

Instalación y login:

```bash
npm i -D wrangler
npx wrangler login
```

---

## 3. Mapa de piezas: qué conecta con qué

| Pieza | Nombre | Qué guarda / hace | Quién la usa |
|---|---|---|---|
| **Worker** | `ipug` | Sirve la web y la API | El navegador |
| **D1** | `ipug-db` | Todos los datos estructurados | `worker/db/client.ts` |
| **R2** | `ipug-media` | Fotos, archivos, fotos de pasaporte | `worker/lib/storage.ts` |
| **KV** | `ipug-kv` | Rate limits, JWT revocados, caché | `worker/auth/`, `worker/lib/cache.ts` |
| **Secrets** | ver §4 | Claves de firma y API keys | Todo el Worker |

**Flujo de una petición típica** (abrir la lista de la compra):

```
1. Navegador  GET /api/shopping/items?listId=abc
              Cookie: ipug_session=<jwt>
2. Worker     middleware requireAuth()
                └─ verifica el JWT con JWT_SECRET
                └─ comprueba en KV que el jti no está revocado
                └─ inyecta { userId: 'irene' } en el contexto
3. Worker     routes/shopping.ts → db.select().from(shoppingItems)…
4. D1         devuelve las filas
5. Worker     responde 200 con JSON
6. Navegador  TanStack Query cachea y persiste en IndexedDB
```

---

## 4. Variables y secretos: catálogo completo

Hay **tres sitios distintos** donde vive la configuración, y confundirlos es el
error más común:

| Sitio | Para qué | Visible en el navegador |
|---|---|---|
| `.env` del frontend (`VITE_*`) | Config pública de build | ✅ **SÍ — nunca metas secretos** |
| `vars` en `wrangler.jsonc` | Config no sensible del Worker | ❌ No, pero está en el repo |
| **Worker Secrets** | Claves y tokens | ❌ No, y no está en el repo |

> ⚠️ **Regla de oro:** todo lo que empiece por `VITE_` **acaba dentro del
> JavaScript que se descarga el navegador**. Cualquiera puede leerlo. Si es un
> secreto, va en Worker Secrets, punto.

### 4.1 Frontend — `.env` (van al bundle, son públicas)

| Variable | Función | Ejemplo | Fase |
|---|---|---|---|
| `VITE_API_BASE_URL` | Base de la API. Vacío = mismo origen | `""` o `https://ipug.x.workers.dev` | 2 |
| `VITE_DATA_ADAPTER` | Qué adaptador usa la capa de datos | `local` \| `http` | 1-2 |
| `VITE_SPOTIFY_CLIENT_ID` | Client ID de Spotify. **Es público por diseño en PKCE** | `a1b2c3…` | 1 |
| `VITE_SPOTIFY_REDIRECT_URI` | Debe coincidir **exactamente** con el panel de Spotify | `https://…/callback` | 1 |
| `VITE_HOME_LAT` / `VITE_HOME_LON` | Origen de los arcos del globo (Valencia) | `39.4699` / `-0.3763` | 1 |

`VITE_DATA_ADAPTER` es el interruptor de la migración: cambiarlo de `local` a
`http` es lo que conecta la app al backend.

### 4.2 Worker — `vars` en `wrangler.jsonc` (no sensibles)

| Variable | Función | Valor |
|---|---|---|
| `ENVIRONMENT` | Distingue entornos | `production` \| `preview` |
| `SESSION_TTL_DAYS` | Duración de la cookie de sesión | `30` |
| `TOTP_WINDOW` | Tolerancia en intervalos de 30 s | `1` (**no subir**, ver §9) |
| `RATE_LIMIT_AUTH_MAX` | Intentos de login permitidos | `5` |
| `RATE_LIMIT_AUTH_WINDOW_S` | Ventana del rate limit, en segundos | `900` (15 min) |
| `MERCADONA_WAREHOUSE` | Código de almacén | `vlc1` (Valencia) |
| `MERCADONA_CACHE_TTL_S` | Caché del catálogo en KV | `86400` (24 h) |
| `LLM_DAILY_LIMIT` | Consultas al LLM por usuario y día | `50` |

### 4.3 Worker Secrets (nunca en el repo)

Se crean uno a uno con `npx wrangler secret put <NOMBRE>`, que pide el valor por
teclado y no lo escribe en ningún fichero.

| Secreto | Función | Cómo se genera | Fase |
|---|---|---|---|
| `JWT_SECRET` | Firma las cookies de sesión (HS256). **Si se filtra, cualquiera entra** | `openssl rand -base64 48` | 2 |
| `TOTP_SECRET_IRENE` | Secreto TOTP de Irene, en Base32 | Lo genera el script de §9.2 | 2 |
| `TOTP_SECRET_VICENTE` | Secreto TOTP de Vicente | Íd. | 2 |
| `ENCRYPTION_KEY` | Clave AES-GCM si guardas los TOTP en D1 en vez de como secretos | `openssl rand -base64 32` | 2 (opcional) |
| `ANTHROPIC_API_KEY` | API de Claude | Consola de Anthropic | 3 |
| `ENABLE_BANKING_PRIVATE_KEY` | Clave RSA para open banking | Panel de Enable Banking | 4 (opcional) |
| `ENABLE_BANKING_APP_ID` | ID de aplicación | Íd. | 4 (opcional) |

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put TOTP_SECRET_IRENE
npx wrangler secret put TOTP_SECRET_VICENTE
npx wrangler secret list          # comprobar (muestra nombres, nunca valores)
```

> 🔐 **Guarda los dos secretos TOTP en tu gestor de contraseñas antes de nada.**
> Si pierdes el móvil y no tienes el secreto, **te quedas fuera de tu propia app
> sin forma de recuperarla**. No hay "he olvidado mi contraseña" aquí.

### 4.4 Tipado en TypeScript

```ts
// worker/types.ts — el contrato entre wrangler.jsonc y el código
export interface Env {
  // Bindings
  DB: D1Database;
  MEDIA: R2Bucket;
  KV: KVNamespace;
  ASSETS: Fetcher;

  // vars
  ENVIRONMENT: 'production' | 'preview';
  SESSION_TTL_DAYS: string;
  TOTP_WINDOW: string;
  RATE_LIMIT_AUTH_MAX: string;
  RATE_LIMIT_AUTH_WINDOW_S: string;
  MERCADONA_WAREHOUSE: string;
  MERCADONA_CACHE_TTL_S: string;
  LLM_DAILY_LIMIT: string;

  // secrets
  JWT_SECRET: string;
  TOTP_SECRET_IRENE: string;
  TOTP_SECRET_VICENTE: string;
  ANTHROPIC_API_KEY?: string;
}
```

⚠️ Todas las `vars` llegan **como string**, incluso las numéricas. Hay que hacer
`Number(env.SESSION_TTL_DAYS)`. Es una fuente clásica de bugs silenciosos.

---

## 5. Bindings y `wrangler.jsonc`

Crear los recursos:

```bash
npx wrangler d1 create ipug-db
npx wrangler r2 bucket create ipug-media
npx wrangler kv namespace create ipug-kv
```

Cada comando devuelve un `id` que hay que pegar en la configuración:

```jsonc
// wrangler.jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "ipug",
  "main": "worker/index.ts",
  "compatibility_date": "2026-07-22",
  "compatibility_flags": ["nodejs_compat"],

  // Sirve el frontend compilado. Estas peticiones son GRATIS e ILIMITADAS:
  // no consumen las 100.000/día, que son solo para /api/*.
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },

  "d1_databases": [{
    "binding": "DB",
    "database_name": "ipug-db",
    "database_id": "<PEGAR-AQUI-EL-ID>",
    "migrations_dir": "worker/db/migrations"
  }],

  "r2_buckets": [{
    "binding": "MEDIA",
    "bucket_name": "ipug-media"
  }],

  "kv_namespaces": [{
    "binding": "KV",
    "id": "<PEGAR-AQUI-EL-ID>"
  }],

  "vars": {
    "ENVIRONMENT": "production",
    "SESSION_TTL_DAYS": "30",
    "TOTP_WINDOW": "1",
    "RATE_LIMIT_AUTH_MAX": "5",
    "RATE_LIMIT_AUTH_WINDOW_S": "900",
    "MERCADONA_WAREHOUSE": "vlc1",
    "MERCADONA_CACHE_TTL_S": "86400",
    "LLM_DAILY_LIMIT": "50"
  },

  "observability": { "enabled": true }
}
```

`not_found_handling: "single-page-application"` es **imprescindible**: sin él,
recargar la página en `/calendario` daría 404 en vez de servir el `index.html`.

---

## 6. Esquema de base de datos

`worker/db/migrations/0001_init.sql`. Traducción directa del modelo de §6 de
`PROYECTO.md`.

```sql
-- Convenciones:
--   id           TEXT, UUID v4 generado en el Worker con crypto.randomUUID()
--   *_at         INTEGER, epoch en milisegundos UTC
--   person_id    TEXT, 'irene' | 'vicente'
--   assignee     TEXT, 'irene' | 'vicente' | 'both'
--   Importes en CÉNTIMOS enteros. Nunca float para dinero.

CREATE TABLE users (
  id                TEXT PRIMARY KEY,            -- 'irene' | 'vicente'
  display_name      TEXT NOT NULL,
  totp_secret_enc   TEXT,                        -- NULL si va en Worker Secrets
  last_totp_step    INTEGER NOT NULL DEFAULT 0,  -- ⭐ anti-replay, ver §9
  created_at        INTEGER NOT NULL
);

CREATE TABLE profiles (
  person_id      TEXT PRIMARY KEY REFERENCES users(id),
  island_name    TEXT,
  native_fruit   TEXT,
  birthday       TEXT,          -- 'MM-DD'
  registered_at  INTEGER,
  photo_key      TEXT,          -- clave en R2
  title          TEXT,
  comment        TEXT,          -- máx. 24 caracteres (se valida en el Worker)
  zodiac         TEXT,
  updated_at     INTEGER NOT NULL
);

CREATE TABLE calendar_events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  starts_at   INTEGER NOT NULL,
  ends_at     INTEGER,
  all_day     INTEGER NOT NULL DEFAULT 0,   -- SQLite no tiene BOOLEAN
  assignee    TEXT NOT NULL,
  color       TEXT,
  recurrence  TEXT,                          -- RRULE, o NULL
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_events_starts ON calendar_events(starts_at);

CREATE TABLE notes (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  owner_id   TEXT NOT NULL,        -- 'irene' | 'vicente' | 'shared'
  pinned     INTEGER NOT NULL DEFAULT 0,
  tags       TEXT,                 -- JSON array serializado
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_notes_owner ON notes(owner_id, pinned DESC, updated_at DESC);

CREATE TABLE destinations (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  country    TEXT,
  lat        REAL NOT NULL,
  lon        REAL NOT NULL,
  visited    INTEGER NOT NULL DEFAULT 0,
  visited_at INTEGER,
  notes      TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE accounts (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,            -- 'bank' | 'cash' | 'card'
  currency    TEXT NOT NULL DEFAULT 'EUR',
  balance_cents INTEGER NOT NULL DEFAULT 0,
  institution TEXT,
  owner_id    TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE expenses (
  id           TEXT PRIMARY KEY,
  description  TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,        -- ⚠️ enteros, nunca float
  currency     TEXT NOT NULL DEFAULT 'EUR',
  category     TEXT,
  paid_by      TEXT NOT NULL REFERENCES users(id),
  split_mode   TEXT NOT NULL DEFAULT 'even',  -- 'even'|'payer'|'custom'
  split_detail TEXT,                    -- JSON si es 'custom'
  account_id   TEXT REFERENCES accounts(id),
  occurred_at  INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX idx_expenses_date ON expenses(occurred_at DESC);

CREATE TABLE shopping_lists (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  archived   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE shopping_items (
  id          TEXT PRIMARY KEY,
  list_id     TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  product_id  TEXT,                     -- id de Mercadona, si viene del catálogo
  name        TEXT NOT NULL,
  quantity    REAL NOT NULL DEFAULT 1,
  unit        TEXT,
  price_cents INTEGER,
  checked     INTEGER NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_items_list ON shopping_items(list_id, checked, position);

CREATE TABLE favorite_products (
  product_id       TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  image_url        TEXT,
  last_price_cents INTEGER,
  created_at       INTEGER NOT NULL
);

CREATE TABLE pets (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  breed           TEXT,
  birthday        TEXT,
  chip_number     TEXT,
  passport_number TEXT,
  vet_name        TEXT,
  vet_phone       TEXT,
  photo_key       TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE vaccinations (
  id         TEXT PRIMARY KEY,
  pet_id     TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  applied_at INTEGER NOT NULL,
  expires_at INTEGER,                   -- para el aviso de "toca revacunar"
  notes      TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_vacc_expiry ON vaccinations(pet_id, expires_at);

CREATE TABLE weight_entries (
  id          TEXT PRIMARY KEY,
  pet_id      TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  measured_at INTEGER NOT NULL,
  grams       INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE health_entries (
  id          TEXT PRIMARY KEY,
  pet_id      TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  occurred_at INTEGER NOT NULL,
  symptoms    TEXT,
  medication  TEXT,
  vet_visit   INTEGER NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE walks (
  id           TEXT PRIMARY KEY,
  pet_id       TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  started_at   INTEGER NOT NULL,
  ended_at     INTEGER,
  duration_sec INTEGER,
  distance_m   INTEGER,
  steps        INTEGER,          -- ⚠️ estimación, ver §9.5 de PROYECTO.md
  route        TEXT,             -- JSON [[lat,lon,t],…]
  created_by   TEXT NOT NULL REFERENCES users(id),
  created_at   INTEGER NOT NULL
);

CREATE TABLE app_preferences (
  person_id  TEXT NOT NULL REFERENCES users(id),
  key        TEXT NOT NULL,      -- 'icon_order', 'theme', …
  value      TEXT NOT NULL,      -- JSON
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (person_id, key)
);

CREATE TABLE media (
  key         TEXT PRIMARY KEY,  -- clave en R2
  kind        TEXT NOT NULL,     -- 'photo' | 'file' | 'avatar'
  filename    TEXT NOT NULL,
  mime        TEXT,
  size_bytes  INTEGER,
  thumb_key   TEXT,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL
);
```

Aplicar:

```bash
npx wrangler d1 migrations apply ipug-db --local    # probar en local
npx wrangler d1 migrations apply ipug-db --remote   # producción
```

**Notas de SQLite que ahorran disgustos:**
- No hay tipo `BOOLEAN` → `INTEGER` con 0/1.
- No hay tipo array → JSON en `TEXT`.
- `ON DELETE CASCADE` **necesita** `PRAGMA foreign_keys = ON`; D1 lo activa por
  defecto, pero conviene saberlo.
- **Dinero siempre en céntimos enteros.** Con float acabarías con 0,1 + 0,2 =
  0,30000000000000004 en el balance de la pareja.

---

## 7. Estructura del Worker

```
worker/
├─ index.ts                 ← router raíz (Hono), monta todas las rutas
├─ types.ts                 ← interface Env (§4.4)
│
├─ auth/
│  ├─ totp.ts               ← verifyTotp(): otplib + anti-replay
│  ├─ session.ts            ← signSession() / verifySession(): JWT HS256
│  ├─ middleware.ts         ← requireAuth(): guardia de todas las rutas
│  └─ rate-limit.ts         ← checkRateLimit() sobre KV
│
├─ routes/                  ← ⭐ un fichero por mini-app, espejo de src/apps/
│  ├─ auth.ts               ← POST /api/auth/verify, /logout, GET /me
│  ├─ profile.ts
│  ├─ calendar.ts
│  ├─ notes.ts
│  ├─ travel.ts
│  ├─ money.ts
│  ├─ shopping.ts
│  ├─ pets.ts
│  ├─ media.ts              ← subida y descarga desde R2
│  ├─ preferences.ts        ← orden de iconos, tema
│  ├─ mercadona.ts          ← proxy + caché
│  └─ llm.ts                ← proxy de Claude (fase 3)
│
├─ db/
│  ├─ schema.ts             ← esquema Drizzle (tipado)
│  ├─ client.ts             ← getDb(env) → drizzle(env.DB)
│  └─ migrations/
│     └─ 0001_init.sql
│
└─ lib/
   ├─ crud.ts               ← ⭐ fábrica genérica de rutas CRUD
   ├─ storage.ts            ← helpers de R2
   ├─ cache.ts              ← helpers de KV
   └─ errors.ts             ← respuestas de error homogéneas
```

### 7.1 El router raíz

```ts
// worker/index.ts
import { Hono } from 'hono';
import type { Env } from './types';
import { requireAuth } from './auth/middleware';
import auth from './routes/auth';
import notes from './routes/notes';
// … el resto

const app = new Hono<{ Bindings: Env }>();

app.route('/api/auth', auth);                 // pública

app.use('/api/*', requireAuth);               // ⬅ todo lo demás protegido

app.route('/api/notes', notes);
app.route('/api/calendar', calendar);
// … el resto

// Cualquier cosa que no sea /api/* la sirve el binding de assets
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
```

El orden importa: `app.use('/api/*', requireAuth)` va **después** de montar
`/api/auth` (que debe ser pública) y **antes** del resto.

### 7.2 La fábrica CRUD: por qué añadir una app es casi gratis

```ts
// worker/lib/crud.ts
export function crudRoutes<T>(table: SQLiteTable, opts?: {
  scope?: 'user' | 'shared';
  validate?: (body: unknown) => T;
}) {
  const r = new Hono<{ Bindings: Env }>();
  r.get('/',      async (c) => c.json(await getDb(c.env).select().from(table)));
  r.get('/:id',   async (c) => { /* … */ });
  r.post('/',     async (c) => { /* valida, genera UUID, inserta */ });
  r.patch('/:id', async (c) => { /* … */ });
  r.delete('/:id',async (c) => { /* … */ });
  return r;
}
```

```ts
// worker/routes/notes.ts — la mini-app entera en el backend
import { crudRoutes } from '../lib/crud';
import { notes } from '../db/schema';
export default crudRoutes(notes, { scope: 'shared' });
```

**Añadir una mini-app en el backend = crear la tabla + un fichero de tres líneas.**
Simétrico al `manifest.ts` del frontend.

---

## 8. Contrato de la API

Todas las rutas devuelven JSON. Todas menos `/api/auth/*` exigen la cookie de
sesión.

### 8.1 Convenciones

| Código | Significado |
|---|---|
| 200 | OK |
| 201 | Creado |
| 400 | Body inválido (falla el esquema zod) |
| 401 | Sin sesión o sesión expirada → el frontend redirige al login |
| 403 | Con sesión, pero sin permiso sobre ese recurso |
| 404 | No existe |
| 429 | Rate limit — incluye cabecera `Retry-After` |
| 500 | Error del servidor |

Errores homogéneos:

```json
{ "error": { "code": "INVALID_TOTP", "message": "El código no es válido" } }
```

### 8.2 Endpoints

**Autenticación**

| Método | Ruta | Body | Devuelve |
|---|---|---|---|
| `POST` | `/api/auth/verify` | `{ userId, code }` | 200 + `Set-Cookie` |
| `POST` | `/api/auth/logout` | — | 204, borra la cookie |
| `GET` | `/api/auth/me` | — | `{ userId, displayName }` o 401 |

**CRUD genérico** — el mismo patrón para `notes`, `calendar`, `travel`,
`money/accounts`, `money/expenses`, `shopping/lists`, `shopping/items`,
`pets/vaccinations`, `pets/weights`, `pets/health`, `pets/walks`:

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/<recurso>` | Lista, admite filtros por query string |
| `GET` | `/api/<recurso>/:id` | Uno |
| `POST` | `/api/<recurso>` | Crear |
| `PATCH` | `/api/<recurso>/:id` | Actualizar parcialmente |
| `DELETE` | `/api/<recurso>/:id` | Borrar |

**Específicos**

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/profile/:personId` | Pasaporte |
| `PUT` | `/api/profile/:personId` | Actualizar (valida `comment` ≤ 24 chars) |
| `POST` | `/api/media/upload` | `multipart/form-data` → R2, devuelve `{ key }` |
| `GET` | `/api/media/:key` | Descarga autenticada desde R2 |
| `DELETE` | `/api/media/:key` | Borra de R2 y de la tabla `media` |
| `GET` | `/api/preferences` | Preferencias del usuario |
| `PUT` | `/api/preferences/:key` | Guardar (ej. `icon_order`) |
| `GET` | `/api/mercadona/catalog` | Catálogo cacheado en KV |
| `GET` | `/api/mercadona/product/:id` | Producto puntual |
| `POST` | `/api/llm/chat` | Proxy de Claude con streaming SSE |

---

## 9. Autenticación TOTP paso a paso

### 9.1 Por qué así y no con un servicio

Se investigaron las alternativas:

- **Supabase Auth no puede hacer login solo con TOTP.** Su MFA va de AAL1 a AAL2:
  exige haber iniciado sesión antes con email+contraseña o magic link. Para
  saltárselo habría que inventar una contraseña fija compartida, que es **peor
  seguridad** que hacerlo bien a mano.
- **Clerk no incluye TOTP ni passkeys en su plan gratuito** (verificado en su
  página de precios, en contra de lo que dicen varios blogs), y el branding de
  Clerk no se puede quitar en free.
- **Supabase Passkeys** sí funciona como factor primario desde mayo de 2026, pero
  está **en beta explícita** ("la API puede cambiar sin aviso"). No es donde
  quieres poner la única puerta de tu app.

Hacerlo tú son ~50 líneas, no depende de que nadie cambie de precios, y cumple
exactamente lo que pediste: Google o Microsoft Authenticator.

### 9.2 Generar los secretos y los QR

```js
// scripts/gen-totp.mjs  →  node scripts/gen-totp.mjs Irene
import { authenticator } from 'otplib';
import qrcode from 'qrcode-terminal';

const user = process.argv[2] ?? 'Usuario';
const secret = authenticator.generateSecret();   // Base32
const uri = authenticator.keyuri(user, 'iPug', secret);

console.log('SECRETO (guárdalo en el gestor de contraseñas):', secret);
qrcode.generate(uri, { small: true });
```

Ejecutar una vez por persona, escanear el QR con el Authenticator, y guardar el
secreto **en el gestor de contraseñas** antes de subirlo:

```bash
npx wrangler secret put TOTP_SECRET_IRENE
npx wrangler secret put TOTP_SECRET_VICENTE
```

### 9.3 Verificación con anti-replay

```ts
// worker/auth/totp.ts
import { authenticator } from 'otplib';

export async function verifyTotp(env: Env, userId: string, code: string) {
  const secret = userId === 'irene'
    ? env.TOTP_SECRET_IRENE
    : env.TOTP_SECRET_VICENTE;

  authenticator.options = { window: Number(env.TOTP_WINDOW) };
  if (!authenticator.verify({ token: code, secret })) return false;

  // ⭐ ANTI-REPLAY: sin esto, un código visto por encima del hombro
  // sirve durante 30-60 segundos.
  const step = Math.floor(Date.now() / 30000);
  const row = await env.DB
    .prepare('SELECT last_totp_step FROM users WHERE id = ?')
    .bind(userId).first<{ last_totp_step: number }>();

  if (row && step <= row.last_totp_step) return false;   // ya usado

  await env.DB
    .prepare('UPDATE users SET last_totp_step = ? WHERE id = ?')
    .bind(step, userId).run();

  return true;
}
```

### 9.4 Sesión JWT

```ts
// worker/auth/session.ts — HS256 con Web Crypto, sin dependencias
export async function signSession(env: Env, userId: string) {
  const ttl = Number(env.SESSION_TTL_DAYS) * 86400;
  const payload = {
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttl,
    jti: crypto.randomUUID(),        // permite revocar sesiones vía KV
  };
  // … firmar con crypto.subtle.sign('HMAC', key, data)
}
```

Cookie:

```
Set-Cookie: ipug_session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
```

`HttpOnly` es lo que impide que un XSS robe la sesión. Es la diferencia principal
frente a guardar el token en `localStorage`.

### 9.5 Rate limiting

```ts
// worker/auth/rate-limit.ts — contador en KV con TTL
const key = `rl:auth:${userId}`;
const count = Number(await env.KV.get(key) ?? 0);
if (count >= Number(env.RATE_LIMIT_AUTH_MAX)) {
  return new Response(null, { status: 429, headers: { 'Retry-After': '900' } });
}
await env.KV.put(key, String(count + 1), {
  expirationTtl: Number(env.RATE_LIMIT_AUTH_WINDOW_S),
});
```

**Es obligatorio.** Un código de 6 dígitos son un millón de combinaciones, pero
con ventana de 60 segundos y sin límite de intentos, un atacante persistente
tiene probabilidad no despreciable a largo plazo. Cinco intentos cada 15 minutos
lo elimina por completo.

⚠️ **KV solo permite 1.000 escrituras al día en el plan gratuito** — es la cuota
más ajustada de todo el stack. Úsalo solo para rate limits y revocación de JWT.
Todo lo demás va a D1.

### 9.6 Parámetros de seguridad, resumidos

| Parámetro | Valor | Por qué |
|---|---|---|
| Ventana TOTP | `1` (±30 s) | Subirla a 2-3 "por comodidad" multiplica la superficie de ataque |
| Anti-replay | Obligatorio | Sin él, un código robado sirve 60 s |
| Rate limit | 5 / 15 min | Elimina la fuerza bruta |
| Sesión | 30 días | Sesiones cortas son fricción pura; el riesgo real es perder el móvil, y eso lo cubre la biometría del propio dispositivo |
| Cookie | `HttpOnly` + `Secure` + `SameSite=Lax` | Inmune a robo por XSS |
| Firma JWT | HS256, secreto ≥ 32 bytes | — |

**Capa extra opcional y gratuita:** poner **Cloudflare Access (Zero Trust)**
delante de todo el dominio, hasta 50 usuarios. Así ni siquiera se llega a la app
sin pasar antes por un login de Google. Defensa en profundidad por 0 €.

---

## 10. El cambio en el frontend

Esta es la recompensa de toda la arquitectura. **Migrar el frontend entero es
esto:**

```diff
  // src/shared/data/index.ts
- import { makeLocalRepo } from './adapters/local.adapter';
+ import { makeHttpRepo } from './adapters/http.adapter';

  export const repos = {
-   notes:  makeLocalRepo<Note>('notes'),
-   events: makeLocalRepo<CalendarEvent>('events'),
+   notes:  makeHttpRepo<Note>('notes'),
+   events: makeHttpRepo<CalendarEvent>('events'),
    // …
  };
```

Ningún componente cambia. Ningún hook cambia. Ninguna de las 12 mini-apps cambia.

El adaptador HTTP:

```ts
// src/shared/data/adapters/http.adapter.ts
const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    credentials: 'include',            // ⬅ manda la cookie de sesión
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('401'); }
  if (!res.ok) throw new ApiError(await res.json());
  return res.status === 204 ? (undefined as T) : res.json();
}

export const makeHttpRepo = <T>(resource: string): Repository<T> => ({
  list:   (f) => req<T[]>(`/${resource}${f ? '?' + new URLSearchParams(f as any) : ''}`),
  get:    (id) => req<T>(`/${resource}/${id}`),
  create: (d)  => req<T>(`/${resource}`, { method: 'POST',  body: JSON.stringify(d) }),
  update: (id, p) => req<T>(`/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify(p) }),
  remove: (id) => req<void>(`/${resource}/${id}`, { method: 'DELETE' }),
});
```

⚠️ `credentials: 'include'` es imprescindible o la cookie no viaja. Si además
sirves la API desde otro dominio, el Worker debe responder
`Access-Control-Allow-Credentials: true` y un `Access-Control-Allow-Origin`
**concreto** (con `*` el navegador rechaza las credenciales). Sirviendo todo desde
el mismo Worker, este problema no existe — otra razón para hacerlo así.

---

## 11. Fotos y archivos en R2

**Por qué R2 y no otro:** 10 GB gratis y, sobre todo, **coste de salida cero**.
Supabase Storage da 1 GB (insuficiente) y Firebase limita la descarga a 1 GB/día.
Con R2 podéis ver la galería entera cincuenta veces al mes sin agotar ninguna
cuota.

**Convención de claves:**

```
avatars/{personId}.webp
photos/{yyyy}/{mm}/{uuid}.webp
photos/{yyyy}/{mm}/{uuid}_thumb.webp
files/{uuid}/{filename}
pets/{petId}/{uuid}.webp
```

**Optimización importante:** genera el thumbnail **en el navegador** con canvas
(WebP, ~50 KB) antes de subir, y sube ambos. La galería carga solo thumbnails, y
el consumo de operaciones de lectura se desploma.

**Sirve siempre a través del Worker, nunca con el bucket público:**

```ts
// worker/routes/media.ts
r.get('/:key{.+}', requireAuth, async (c) => {
  const obj = await c.env.MEDIA.get(c.req.param('key'));
  if (!obj) return c.notFound();
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'ETag': obj.httpEtag,
    },
  });
});
```

Así las fotos vuestras **solo son accesibles con sesión iniciada**. Un bucket
público con URLs adivinables no sirve para fotos personales.

---

## 12. Proxies de terceros

### 12.1 Mercadona

Recordatorio de §9.1 de `PROYECTO.md`: la API de Mercadona **no emite cabeceras
CORS**, así que el navegador no puede llamarla. Y tiene Akamai Bot Manager, así
que conviene no llamarla mucho.

**Estrategia de dos capas:**

1. **Job nocturno** (GitHub Action, 1×/día) que vuelca el catálogo a un JSON
   estático. La app busca en local con Fuse.js. **Esto cubre el 95 % del uso.**
2. **Proxy en el Worker** con caché de 24 h en KV, solo para consultar el precio
   actualizado de un producto concreto.

```ts
// worker/routes/mercadona.ts
r.get('/product/:id', async (c) => {
  const id = c.req.param('id');
  const cacheKey = `merca:p:${id}`;
  const hit = await c.env.KV.get(cacheKey, 'json');
  if (hit) return c.json(hit);

  const wh = c.env.MERCADONA_WAREHOUSE;                 // 'vlc1'
  const r2 = await fetch(
    `https://tienda.mercadona.es/api/products/${id}/?lang=es&wh=${wh}`,
    { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } },
  );
  if (!r2.ok) return c.json({ error: 'upstream' }, 502);
  const data = await r2.json();
  await c.env.KV.put(cacheKey, JSON.stringify(data), {
    expirationTtl: Number(c.env.MERCADONA_CACHE_TTL_S),
  });
  return c.json(data);
});
```

⚠️ Cuidado con la cuota de KV (1.000 escrituras/día): con caché de 24 h y un
catálogo que se consulta poco, no hay problema, pero **no cachees cada búsqueda**.

### 12.2 Claude (fase 3)

```
worker/routes/llm.ts
  ├─ requireAuth                                 ← el proxy NO es público
  ├─ rate limit LLM_DAILY_LIMIT por usuario/día  ← evita facturas sorpresa
  ├─ lee ANTHROPIC_API_KEY de Worker Secret
  ├─ streaming SSE hacia el cliente
  └─ registra tokens consumidos en D1            ← observabilidad de coste
```

El plan gratuito da **10 ms de CPU por invocación**, pero no limita la duración de
la petición. Como el Worker solo reenvía el stream (es I/O, no CPU), cabe de
sobra. Lo que **no** cabe es postprocesar el texto en el Worker — eso va en el
cliente.

**Tool calling sobre vuestros datos:** cada `manifest.ts` declara sus `tools` y el
Worker las recopila del registry. Añadir una mini-app le da automáticamente esa
capacidad al asistente, sin tocar nada más.

---

## 13. Despliegue y CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push: { branches: [main] }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Dos secretos en **GitHub** (distintos de los Worker Secrets):

| Secreto de GitHub | Dónde se obtiene |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Panel de Cloudflare → My Profile → API Tokens → plantilla "Edit Cloudflare Workers" |
| `CLOUDFLARE_ACCOUNT_ID` | Panel de Cloudflare, en la barra lateral |

Desarrollo local con los bindings reales simulados:

```bash
npx wrangler dev            # Worker + D1 local + R2 local + KV local
npm run dev                 # solo frontend, adaptador local
```

---

## 14. Migración de los datos existentes

Si durante la fase 1 habéis metido datos de verdad en `localStorage` (no
deberíais, ver la regla de oro de `PROYECTO.md` §1.1, pero por si acaso):

1. **Exportar** — añadir un botón de "Exportar datos" en Ajustes que descargue un
   JSON con todos los repositorios locales.
2. **Importar** — endpoint temporal `POST /api/admin/import` protegido con sesión,
   que inserta en D1 respetando los ids.
3. **Verificar** contando filas: `npx wrangler d1 execute ipug-db --remote
   --command "SELECT COUNT(*) FROM notes"`.
4. **Borrar el endpoint de importación** después. No lo dejes ahí.

Conviene hacerlo **antes** de cambiar `VITE_DATA_ADAPTER`, o la app dejará de ver
los datos locales y parecerá que se han perdido.

---

## 15. Cambiar a otra tecnología

La razón de que exista `shared/data/ports.ts`. Para cambiar de backend hay que
tocar **exactamente estos ficheros**:

| Cambio | Ficheros a tocar | Esfuerzo |
|---|---|---|
| Cloudflare → **Supabase** | `adapters/supabase.adapter.ts` (nuevo) + 1 línea en `data/index.ts` | Bajo |
| Cloudflare → **Firebase** | `adapters/firebase.adapter.ts` + 1 línea | Bajo |
| D1 → **Postgres (Neon)** | Solo `worker/db/client.ts` y el dialecto de Drizzle | Bajo |
| R2 → **Backblaze B2** | Solo `worker/lib/storage.ts` | Bajo |
| Workers → **Vercel Functions** | `worker/index.ts` → `api/[[...path]].ts`. Hono corre en ambos | Medio |
| TOTP → **Passkeys** | `auth/totp.ts` → `auth/webauthn.ts`. La capa de sesión no cambia | Medio |

**Nada de esto toca las mini-apps.** Es el objetivo entero del diseño.

### Si un día quieres irte a Supabase

Ventaja: auth, Postgres, realtime y RLS ya montados.
Coste: **pausa el proyecto tras 7 días de baja actividad**, con 90 días para
restaurarlo antes de perder los datos definitivamente. Mitigable con un cron de
GitHub Actions que haga `SELECT 1` cada dos días, pero es deuda operativa
permanente. Y su Storage de 1 GB obliga igualmente a usar R2 para las fotos.

### Si quieres edición colaborativa en vivo

Yjs + un **Durable Object** de Cloudflare como proveedor WebSocket. Está en el
plan gratuito (100k req/día) y la API de hibernación evita consumir mientras no
hay mensajes. No lo hagas antes de necesitarlo: para listas y gastos, "gana la
última escritura" es correcto y mucho más simple.

---

## 16. Checklist final

**Preparación**
- [ ] Cuenta de Cloudflare creada y `npx wrangler login` hecho
- [ ] `npx wrangler d1 create ipug-db` → id pegado en `wrangler.jsonc`
- [ ] `npx wrangler r2 bucket create ipug-media`
- [ ] `npx wrangler kv namespace create ipug-kv` → id pegado
- [ ] Migración `0001_init.sql` aplicada en local y en remoto
- [ ] Filas de `users` insertadas para `irene` y `vicente`

**Seguridad**
- [ ] `JWT_SECRET` generado (≥32 bytes) y subido
- [ ] `TOTP_SECRET_IRENE` y `TOTP_SECRET_VICENTE` generados y subidos
- [ ] 🔐 **Los dos secretos TOTP guardados en el gestor de contraseñas**
- [ ] QR escaneados en ambos móviles y login probado
- [ ] Anti-replay verificado: el mismo código **no** funciona dos veces
- [ ] Rate limit verificado: al sexto intento devuelve 429
- [ ] Cookie con `HttpOnly`, `Secure` y `SameSite=Lax`

**Frontend**
- [ ] `VITE_DATA_ADAPTER=http` y `VITE_API_BASE_URL` configurados
- [ ] La línea de `data/index.ts` cambiada a `makeHttpRepo`
- [ ] Datos de ejemplo purgados de D1
- [ ] PWA instalada y probada en ambos móviles

**Despliegue**
- [ ] `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en secretos de GitHub
- [ ] Workflow de deploy verde
- [ ] Recargar en una ruta profunda (`/calendario`) **no** da 404

**Higiene**
- [ ] Repo de GitHub Pages despublicado o marcado como demo
- [ ] Endpoint de importación borrado
- [ ] `observability` activada para ver logs
