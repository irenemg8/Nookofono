# Plan — Backends de las apps pendientes (tanda BACKEND-*.md)

> Acordado con Vicente 2026-07-24. Alcance: **implementar TODO lo de los 8
> specs `BACKEND-*.md` MENOS la generación del modelo de Valentín** (que no
> existe: `brain.ts` usa un stub y el plan original de Workers AI quedó
> invalidado por la decisión de VPS). Desplegar en producción (VPS visiclaw /
> IONOS, tras Caddy, en `ipug.vrlabs.es`).

## Decisiones de arquitectura (fijadas al implementar)

1. **Campos epoch-ms del dominio** (`lastDoneAt`, `talkedAt`, `doneAt`) →
   columna `bigint` en la BD, NO `timestamp`. El frontend los consume como
   número sin mapper (`0` = nunca/sin hacer) y los specs los declaran
   `z.number().int().nullable()`. Así no se tocan los 6 frontends ya hechos.
2. **`createdAt`/`updatedAt`** → `timestamp` como el resto (el frontend ya los
   convierte con `msFrom` en `use-remote-collection.ts`).
3. **Blobs** → `/data/blobs/<id>` en volumen Docker + fichero `.meta` con el
   Content-Type. Rutas `PUT/GET/DELETE /api/files/:id/blob`.
4. **Embeddings** → locales (`@xenova/transformers`, `all-MiniLM-L6-v2`, 384
   dims). Sin API keys de pago, privado, todo en el VPS. Se ajusta
   `dimensions` a 384 (el spec ponía 1536 pensando en OpenAI).
5. **`/api/valentin/chat`** → recupera trozos por pgvector y los devuelve, pero
   la **generación** responde 503 honesto hasta que exista el modelo de Irene.
6. **Crons** → `node-cron` dentro del proceso (un solo contenedor). Casa
   domingo 21:00, Por hablar 20:00 (Europe/Madrid) → ntfy.

## Bloques

| # | Bloque | Estado | Criterio de aceptación |
|---|---|---|---|
| A | Tablas nuevas en schema.ts + migración | ⬜ | `db:generate` limpio, `db:migrate` aplica |
| B | Rutas CRUD (tasks, incidents, talks, chores, cycle_days/logs, photos, folders, files) + registro | ⬜ | `GET /api/tasks` etc. responden 200 con sesión |
| C | Blob store en disco (`/api/files/:id/blob` PUT/GET/DELETE) | ⬜ | Subir una foto y volver a bajarla byte a byte |
| D | RAG recuperable: pgvector + extracción texto + chunks + embeddings | ⬜ | Subir un .txt genera chunks con embedding |
| E | `/api/valentin/chat` recupera trozos (generación = 503) | ⬜ | Devuelve trozos relevantes; 503 en generación |
| F | Crons ntfy (Casa dom 21:00, Por hablar 20:00) | ⬜ | Cron programado, dispara ntfy con pendientes |
| G | Deploy a producción (VPS, Docker, Caddy) | ⬜ | `https://ipug.vrlabs.es` sirve las apps con backend |

## Notas de contrato verificadas contra el frontend

- Casa `/api/casa` (tabla `chores`), sin mapper: `lastDoneAt` epoch ms.
- Por hablar `/api/talks`, sin mapper: `talkedAt` epoch ms.
- Ciclo dos colecciones: `/api/cycle/days` y `/api/cycle/logs`; `symptoms`,
  `moods` son `string[]` (jsonb), `date` es `YYYY-MM-DD` texto.
- Fotos `/api/photos` + blob por `/api/files/:id/blob` (un solo almacén por id).
- RAG-Pugtín `/api/folders` + `/api/files` + blob store; Excel es vista de los
  `.xlsx` de `/api/files` (sin backend propio).
