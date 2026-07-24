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
| A | Tablas nuevas en schema.ts + migración | ✅ | 10 tablas + pgvector aplicadas en prod (migración 0001) |
| B | Rutas CRUD (tasks, incidents, talks, chores, cycle_days/logs, photos, folders, files) + registro | ✅ | Probados 200 en local con sesión; 401 en prod sin sesión |
| C | Blob store en disco (`/api/files/:id/blob` PUT/GET/DELETE) | ✅ | Roundtrip byte a byte OK; borrar foto borra blob |
| D | RAG recuperable: pgvector + extracción texto + chunks + embeddings | ✅ | .txt genera chunk con embedding; recuperación semántica OK |
| E | `/api/valentin/chat` recupera trozos (generación = 503) | ✅ | Recupera trozo relevante + 503 MODEL_UNAVAILABLE |
| F | Crons ntfy (Casa dom 21:00, Por hablar 20:00) | ✅ | Programados al arrancar (log confirma) |
| G | Deploy a producción (VPS, Docker, Caddy) | ✅ | `https://ipug.vrlabs.es` 200 + TLS válido; endpoints 401 |

## Estado final (2026-07-24)

Desplegado en producción (commit `3b3da86`, VPS IONOS 217.160.193.130).
`ipug-db` migrado a `pgvector/pgvector:pg17`, `ipug-app` reconstruido y healthy.

**Pendiente (fuera del alcance acordado):**
- **Generación del modelo de Valentín**: `/api/valentin/chat` recupera pero
  devuelve 503. Se enchufa cuando exista el modelo fine-tuneado de Irene.
- **`BACKEND-DEPORTE.md`**: 9º spec que Irene añadió mientras yo implementaba
  (app Deporte, commit `f1e9345`). NO implementado en esta tanda. Mismo patrón
  CRUD que los demás; queda para la siguiente.
- Los avisos ntfy requieren que los dos móviles estén suscritos a los temas
  `ipug-porhablar-3d7a1f9c6b2e` y `ipug-casa-4b8f1e6d3a29`.

## Notas de contrato verificadas contra el frontend

- Casa `/api/casa` (tabla `chores`), sin mapper: `lastDoneAt` epoch ms.
- Por hablar `/api/talks`, sin mapper: `talkedAt` epoch ms.
- Ciclo dos colecciones: `/api/cycle/days` y `/api/cycle/logs`; `symptoms`,
  `moods` son `string[]` (jsonb), `date` es `YYYY-MM-DD` texto.
- Fotos `/api/photos` + blob por `/api/files/:id/blob` (un solo almacén por id).
- RAG-Pugtín `/api/folders` + `/api/files` + blob store; Excel es vista de los
  `.xlsx` de `/api/files` (sin backend propio).
