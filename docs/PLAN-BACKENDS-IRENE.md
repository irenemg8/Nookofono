# Plan — Backends de la tanda de Irene (y lo demás que quedó muerto)

> Continuación de `PLAN-BACKENDS.md`. El `git pull` del 2026-07-24 trajo el
> commit `a9bf1ec` de Irene (Recetario, Menú semanal, Wishlist): **solo
> frontend**. Un barrido de endpoints consumidos por el front vs rutas montadas
> en `server/src/index.ts` reveló **6 apps** con frontend colgando de endpoints
> inexistentes. Este plan las cierra todas para que no quede nada muerto.

## Diagnóstico (verificado en vivo)

Endpoints que el frontend consume y el backend NO tiene:

| App | Endpoint(s) | Spec | Patrón |
|---|---|---|---|
| Recetario | `/api/recipes` | `BACKEND-RECETARIO-MENU.md` | CRUD |
| Menú semanal | `/api/mealplan` | `BACKEND-RECETARIO-MENU.md` | CRUD (ref. suelta a recipes) |
| Wishlist | `/api/wishlist` | `BACKEND-WISHLIST.md` | CRUD (`seenAt` epoch-ms) |
| Deporte | `/api/sport/sports` · `/api/sport/sessions` · `/api/sport/routines` | `BACKEND-DEPORTE.md` | 3× CRUD (`doneAt` epoch-ms) |
| Imbécil | `/api/imbecil` | — (sin spec) | CRUD-log (`Ping`: from/text/emoji) |
| Tractive | `/api/tractive` | — (sin spec) | CRUD-log (`Ping`: solo text) |

Imbécil y Tractive: el aviso real va por **ntfy.sh desde el cliente**; el backend
es SOLO historial (GET/POST). No manda notificaciones desde el servidor.

## Correcciones de convención (el código manda sobre el doc)

- `wishlist.seenAt` y `sport_sessions.doneAt` → **`bigint(mode:"number")`**, no
  `timestamp`. Los specs decían `timestamp` + un "mapper null↔0" que no existe.
  El front los consume como número puro. Es la misma decisión ya tomada para
  `talkedAt`/`doneAt`/`lastDoneAt` en la tanda de los 8.

## Bloques

| # | Bloque | Verificación | Estado |
|---|---|---|---|
| 1 | **Schema** — 8 tablas nuevas en `server/src/db/schema.ts` (recipes, meal_plan, wishlist, sport_sports, sport_sessions, sport_routines, imbecil_pings, tractive_pings) | `npm run db:generate` produce la migración sin error | ⬜ |
| 2 | **Rutas** — esquemas zod + `crudRoutes` en `resources.ts` (o `sport.ts` aparte); exports e `app.route(...)` en `index.ts` | `tsc -p server/tsconfig.json` compila | ⬜ |
| 3 | **Migración local** — aplicar en la BD de dev y comprobar tablas | `\dt` muestra las 8 tablas nuevas | ⬜ |
| 4 | **Verificación E2E local** — con sesión de test, CRUD real por cada endpoint (crear→leer→editar→borrar), comprobando el efecto observable campo a campo (no solo 200). Especial: PATCH parcial no pisa campos; `seenAt`/`doneAt` viajan como número | Cada endpoint responde el objeto correcto; el front carga las 6 apps sin "No se pudo cargar" | ⬜ |
| 5 | **Commit + push** | rama `main`, conventional commit | ⬜ |
| 6 | **Deploy VPS** — pull en el VPS IONOS + `docker compose -f docker-compose.prod.yml up -d --build`. Las migraciones corren solas en el entrypoint | `docker ps` healthy; `curl https://ipug.vrlabs.es/api/health` = 200; las 6 apps cargan en prod | ⬜ |
| 7 | **Docs** — specs para Imbécil y Tractive (no existían); actualizar `PLAN-BACKENDS.md` | Ficheros escritos | ⬜ |

## Criterio de aceptación global

Abrir cada una de las 6 apps en el móvil contra `https://ipug.vrlabs.es` y que
funcionen de verdad (crear una receta, planificar una comida, apuntar una peli,
cronometrar deporte, avisar por Imbécil/Tractive) con datos que Irene y Vicente
comparten. Ningún frontend llama ya a un endpoint que no existe.

## Entorno de despliegue

- VPS **IONOS `217.160.193.130`**, usuario `visiclaude` (SSH por clave). El
  Hetzner viejo (`77.42.16.230`) está dado de baja.
- Reverse proxy `vrlabs-caddy`, red `vrlabs-network`, dominio `ipug.vrlabs.es`.
- Prod hoy: `ipug-app` + `ipug-db` (pgvector/pg17) healthy.
