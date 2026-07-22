# iPug — Plan de trabajo

> **Estado vivo del proyecto.** Cualquier sesión de Claude Code (o persona) que
> abra este repositorio debe leer este fichero antes de tocar nada: es la única
> fuente de verdad sobre qué está hecho, qué falta y por qué.
>
> Se actualiza al cerrar cada bloque. Última actualización: 22 de julio de 2026.

Documentos hermanos: [`PROYECTO.md`](./PROYECTO.md) (documento maestro) ·
[`DESIGN.md`](./DESIGN.md) (contrato de estilo, **de obligado cumplimiento**) ·
[`MIGRACION-BACKEND.md`](./MIGRACION-BACKEND.md) (parcialmente obsoleto, ver §0).

---

## 0. Lo que ha cambiado respecto a los documentos originales

Tres decisiones tomadas en esta fase invalidan partes de los documentos previos.
Están registradas en `.apex/context.db` y se resumen aquí porque afectan a
cualquiera que lea la documentación antigua y se la crea.

| Tema | Lo que dicen los docs | Lo que se hace de verdad |
|---|---|---|
| **Hosting del backend** | Cloudflare Workers + D1 + R2 + KV | **VPS propio** (`visiclaw`, 77.42.16.230) con Docker tras el Caddy que ya sirve el resto de `vrlabs.es`. Todo `MIGRACION-BACKEND.md` §5, §11 y §12 (wrangler, bindings, R2, KV) queda obsoleto. |
| **Modelo de datos** | `MIGRACION-BACKEND.md` §6, pensado para SQLite | **Manda el código, no el documento.** Aquel esquema se escribió antes de construir las apps y el modelo derivó al implementarlas. Copiarlo obligaría a reescribir seis apps que funcionan. |
| **Pasos de Nilo** | Contador automático | Imposible desde una web (`PROYECTO.md` §9.5). Se hace con un **Atajo de iOS** que publica los pasos en `POST /api/steps`. |

---

## 1. Los seis bloques

Orden deliberado: cada bloque desbloquea al siguiente. El backend va primero
porque "que se guarde en la base de datos" —que es la mayoría de lo pedido— es
imposible sin él.

### Bloque 1 — Base de datos ✅ **Hecho**

Esquema Postgres + Drizzle, migración y seed.

- 17 tablas en `server/src/db/schema.ts`, fieles a los modelos reales del código.
- Migración aplicada y verificada contra un Postgres real.
- Seed de los dos usuarios (`irene`, `vicente`). **No inventa contenido.**
- Probado con datos con la forma exacta de las apps, en transacción con
  `ROLLBACK`.

Detalles que conviene no perder:
- Las **fechas civiles se guardan como texto** (`YYYY-MM-DD`). Un cumpleaños no
  tiene huso horario; convertirlo a instante UTC lo mueve un día al viajar.
- El **dinero va en céntimos enteros**. Nunca float.
- `step_days` tiene clave primaria `(person_id, day)`: reenviar el mismo día
  **corrige** el valor en vez de duplicar la fila.

### Bloque 2 — API y autenticación ✅ **Hecho**

Hono + TOTP, verificado end-to-end con `curl`.

- Login con Google/Microsoft Authenticator, **anti-replay** (un código no sirve
  dos veces) y **rate limit** de 5 intentos por 15 minutos.
- Cookie de sesión `HttpOnly; SameSite=Lax; Secure`, firmada con Web Crypto.
  Sesiones en tabla, así que se pueden revocar: el logout las echa de verdad.
- Fábrica CRUD genérica: añadir un recurso son unas líneas.
- `PUT /api/preferences/:key` guarda el layout de la pantalla **por persona**.
- `POST /api/steps` con cabecera `X-Steps-Token` (un Atajo de iOS no maneja
  cookies) e idempotente por día.

> **Bug corregido que merece recuerdo:** los esquemas de actualización se
> derivaban con `zod.partial()`, que hace los campos opcionales **pero sigue
> aplicando sus `.default()`**. Un `PATCH` del título de una nota le borraba el
> cuerpo, le cambiaba el dueño y la desfijaba. Arreglado en la fábrica CRUD, no
> recurso a recurso. No lo habría detectado un test de "¿devuelve 200?".

### Bloque 3 — Docker y despliegue ⬜ **Pendiente**

Publicar en `ipug.vrlabs.es`.

- `Dockerfile` multi-etapa: compila el frontend y el servidor, y sirve ambos
  desde el mismo proceso (sin dos dominios no hay CORS que pelear).
- Entrada nueva en `/opt/vrlabs-web/Caddyfile` siguiendo el patrón de los otros
  ocho subdominios (`encode`, `reverse_proxy`, cabeceras de seguridad, `log`).
- Red `vrlabs-network`, que es la que comparte `vrlabs-caddy`.
- Secretos por `.env` en el VPS: `JWT_SECRET`, `STEPS_TOKEN`, credenciales de
  Postgres. **Nunca en el repositorio.**
- **Ojo:** `ipug.vrlabs.es` resuelve hoy a Cloudflare (`188.114.97.5`), no al
  VPS. O se apaga el proxy, o se comprueba que el certificado de Caddy se emite
  igualmente.

Criterio para darlo por hecho: abrir `https://ipug.vrlabs.es` en un móvil y ver
la pantalla de bloqueo, con HTTPS válido.

### Bloque 4 — Conectar las apps existentes a la base de datos ⬜ **Pendiente**

Las seis apps construidas guardan hoy en `localStorage`, es decir, **Irene y
Vicente no comparten nada**: cada uno ve sus notas y sus destinos. Es la
limitación más importante del estado actual.

Apps afectadas: **Notas**, **Calendario**, **Nilo** (vacunas, pesos, paseos),
**Pug airlines** (destinos), **Cacahuete** (historial de avisos) y **Pugporte**
(el pasaporte editable).

El trabajo es sustituir `useCollection` —que escribe en `localStorage`— por un
hook equivalente contra la API, conservando su misma forma para que las
pantallas no cambien. Es la recompensa del diseño de puertos: los componentes
nunca supieron de dónde salían los datos.

Criterio para darlo por hecho: crear una nota en un navegador y **verla aparecer
en otro**. Sin eso, el bloque no está hecho.

### Bloque 5 — Distinguir a Irene y a Vicente ⬜ **Pendiente**

Hoy `useCurrentUser()` devuelve `"irene"` por defecto y se guarda en el
dispositivo: no hay identidad real.

- Pantalla de inicio de sesión con el código de 6 dígitos, dentro de la estética
  del móvil (`DESIGN.md`), enganchada a la pantalla de bloqueo que ya existe.
- `useCurrentUser()` pasa a leer la sesión real de `GET /api/auth/me`.
- El **orden de iconos, el dock y los widgets** pasan a `/api/preferences`, así
  que cada uno tiene su pantalla y la conserva al cambiar de móvil.
- Las notas personales y los eventos por persona empiezan a significar algo.

### Bloque 6 — Compra y Mercadona ⬜ **Pendiente**

La app que pediste con más detalle y la única que no está ni empezada.

- Catálogo de `datania/mercadona-catalog` (el repositorio que indicaste),
  volcado a un JSON estático. **No se llama a Mercadona en tiempo real**: su API
  no emite cabeceras CORS y tiene Akamai delante (`PROYECTO.md` §9.1).
- Buscador local con Fuse.js sobre ese catálogo.
- Listas, favoritos, cantidades con `− 1 +`, precio total del carro.
- Al marcar algo como comprado **no desaparece**: baja a una sección
  "Comprados", que es el detalle que hace buena la app de Mercadona.
- Confirmación al quitar un producto (`ConfirmDialog`, nunca borrar al toque).

---

## 2. Fuera del alcance de estos seis bloques

Lo pedido que **no** entra aquí, para que no se dé por olvidado:

| Tema | Situación |
|---|---|
| **Valentín** | La interfaz está lista y el puerto del modelo también. **Falta el modelo**, que entrena Irene con Unsloth (rango ≤ 8, o Cloudflare no lo acepta). Es dato, no código: ningún agente puede generarlo. |
| **Spotify sonando de fondo** | Requiere revisar el reproductor ya existente. Es trabajo aparte, no depende del backend. |
| **Apps nuevas** | Casa, Tareas, Incidencias, Calculadora, Excel, Fotos, RAG, Deporte, Por hablar. Ninguna empezada. La Calculadora es la única que no necesita nada del servidor. |
| **Fotos y archivos** | Necesitan almacenamiento de ficheros. La tabla `media` ya existe; falta decidir dónde se guardan los binarios en el VPS. |
| **Cacahuete al móvil** | Hoy sale por `ntfy.sh`. Para que llegue de verdad como notificación hace falta Web Push con VAPID y la app instalada en la pantalla de inicio (en iOS no funciona desde Safari). |

---

## 3. Cómo levantar el proyecto en local

```bash
npm ci                      # dependencias del frontend
npm run dev                 # → http://localhost:5173/Nookofono/

cd server && npm install    # dependencias del backend
docker-compose up -d ipug-db          # Postgres en el puerto 5439
npm run db:migrate                    # crear las tablas
npm run db:seed                       # crear irene y vicente
npm run totp -- vicente               # QR para el autenticador
npm run dev                           # API en el puerto 8011
```

El backend necesita `DATABASE_URL`, `JWT_SECRET` (mínimo 32 caracteres) y
`STEPS_TOKEN`.

**Puertos reservados** (anotados también en `~/.claude/PORTS.md`): `5439` la base
de datos, `8011` la API, `5173` el frontend en desarrollo.
