# iPug — imagen única: la API sirve también el frontend compilado.
#
# Tres etapas para que en la imagen final no quede ni el código fuente ni las
# dependencias de compilación: sólo `node_modules` de producción, el JavaScript
# ya transpilado y los estáticos.

# ---- Etapa 1: frontend ----
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . ./
# Sin DEPLOY_TARGET, `vite.config.ts` usa base '/', que es lo que necesita el
# dominio propio. Con 'pages' colgaría de /Nookofono/ y aquí daría 404.
RUN npm run build

# ---- Etapa 2: backend ----
FROM node:22-alpine AS backend
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# ---- Etapa 3: ejecución ----
FROM node:22-alpine AS runtime
WORKDIR /app/server
ENV NODE_ENV=production

COPY --from=backend /app/server/node_modules ./node_modules
COPY --from=backend /app/server/dist ./dist
COPY server/package.json ./
# Los .sql de las migraciones no pasan por TypeScript: hay que copiarlos aparte.
# `migrate.ts` los busca en ./drizzle relativo al directorio de trabajo.
COPY server/drizzle ./drizzle
# El frontend compilado. `STATIC_ROOT` apunta aquí desde el compose.
COPY --from=frontend /app/dist ./public

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Node corre como root por defecto; la imagen oficial ya trae el usuario `node`.
USER node

EXPOSE 8011
ENTRYPOINT ["./docker-entrypoint.sh"]
