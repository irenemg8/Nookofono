# Atajo de iOS — pasos reales del paseo de Nilo

> El contador del navegador solo cuenta con la pantalla encendida (Safari
> suspende el acelerómetro al bloquear el móvil). Este Atajo lee de la app Salud
> los pasos reales del iPhone —que sí se cuentan con el móvil bloqueado— y los
> asigna al último paseo por su franja horaria.

## Cómo funciona

1. Haces el paseo con Nilo y pulsas **«Terminar paseo»**. El paseo se guarda con
   una estimación (los pasos aparecen con `~` delante).
2. Ejecutas el Atajo (a mano, o con una automatización «al cerrar la app iPug»).
3. El Atajo lee de Salud los pasos entre el inicio y el fin del último paseo y
   los manda al backend, que sustituye la estimación por el número real (deja de
   salir el `~`).

## Endpoint

```
POST https://ipug.vrlabs.es/api/steps/walk
Cabecera:  X-Steps-Token: <el secreto STEPS_TOKEN del servidor>
Cuerpo (JSON):
{
  "startedAt": "2026-07-25T18:03:00Z",   // inicio del paseo, ISO
  "endedAt":   "2026-07-25T18:31:00Z",   // fin del paseo, ISO
  "steps":     3412                       // pasos leídos de Salud en esa franja
}
```

El backend busca el paseo cuyo inicio cae en esa franja (±2 min de margen) y le
pone esos pasos con origen `shortcut`. Responde `404 NO_WALK` si no hay ningún
paseo en esa ventana, y `401` si el token es incorrecto.

## Montar el Atajo (app Atajos de iOS)

La forma más simple, sin que el Atajo tenga que consultar la hora del paseo al
servidor: el propio Atajo calcula la franja «última media hora» (o le preguntas
las horas al abrirlo). Pasos:

1. **Obtener la fecha actual** → variable `Fin`.
2. **Ajustar fecha**: restar 40 minutos a `Fin` → variable `Inicio`. (El margen
   de ±2 min del backend absorbe el desajuste; 40 min cubre paseos de hasta esa
   duración. Si paseáis más, súbelo, o usa la variante «preguntar horas».)
3. **Obtener muestras de salud**: tipo **Pasos**, entre `Inicio` y `Fin`,
   operación **Suma** → variable `Pasos`.
4. **Obtener contenido de la URL**:
   - URL: `https://ipug.vrlabs.es/api/steps/walk`
   - Método: **POST**
   - Cabeceras: `X-Steps-Token` = `<STEPS_TOKEN>`
   - Cuerpo: **JSON**
     - `startedAt` = `Inicio` (formatea como ISO 8601)
     - `endedAt` = `Fin` (ISO 8601)
     - `steps` = `Pasos`

> Variante «preguntar horas»: en vez de restar 40 min fijos, añade dos acciones
> **Preguntar por entrada** (hora de inicio y fin) al principio. Más preciso si
> los paseos varían mucho de duración.

### Automatizar «al cerrar iPug»

En **Atajos → Automatización → Crear → App → iPug → Se cierra**, ejecuta este
Atajo. Así los pasos se traen solos cada vez que sales de la app tras un paseo.

## Configuración del servidor

El endpoint necesita la variable de entorno **`STEPS_TOKEN`** en el contenedor
(un secreto largo aleatorio). Es el **mismo** token que usa el Atajo de pasos
diarios (`/api/steps`), no uno nuevo. Se añade al `.env` del VPS:

```
STEPS_TOKEN=<cadena aleatoria larga>
```

Si falta, el endpoint responde `503 STEPS_DISABLED` (no rompe nada, solo no
acepta pasos).
