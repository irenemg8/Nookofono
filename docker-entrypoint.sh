#!/bin/sh
# Migrar y luego servir, en ese orden y en el mismo arranque.
#
# `set -e` es lo importante: si las migraciones fallan, el contenedor muere en
# vez de levantar una API contra un esquema viejo, que es la manera silenciosa
# de corromper datos.
set -e

echo "iPug: aplicando migraciones…"
node dist/db/migrate.js

echo "iPug: arrancando la API…"
# `exec` para que el proceso de Node herede el PID 1 y reciba el SIGTERM de
# Docker directamente; si no, el apagado limpio de index.ts nunca se dispara.
exec node dist/index.js
