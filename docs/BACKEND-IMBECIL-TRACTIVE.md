# Backend de «Imbécil» y «Tractive»

> Frontend en `src/apps/imbecil/` y `src/apps/tractive/`. No tenían spec cuando
> se implementó su backend (2026-07-25); este documento lo recoge a posteriori.

Las dos apps son **botones de aviso** entre Irene y Vicente. El aviso real (el
push que suena en el móvil) lo manda el **frontend por ntfy.sh** (canales
públicos `ipug-imbecil-…` y `ipug-tractive-…`, ver `src/shared/lib/ntfy.ts`).
El backend **no notifica nada**: sólo guarda el **historial** de avisos, como un
log. Por eso son CRUD normales, sin crons ni ntfy en el servidor.

## `/api/imbecil` → tabla `imbecil_pings`

Botón «ven aquí» en los dos sentidos. Cada aviso:

```
{ id, from, text, emoji, createdAt, updatedAt }
```

- `from`: 'irene' | 'vicente' | 'both' (el enum `who`; en la práctica el front
  manda 'irene' o 'vicente').
- `text`, `emoji`: el contenido del aviso (predefinido en el cliente).

El front sólo usa `GET` (historial, ordenado por `createdAt` desc) y `POST`
(registrar el aviso, después de que ntfy haya aceptado el push).

## `/api/tractive` → tabla `tractive_pings`

Unidireccional: Irene avisa, Vicente recibe. Más simple que Imbécil, sólo texto:

```
{ id, text, createdAt, updatedAt }
```

Sin `from` ni `emoji`. El front bifurca por usuario (Irene ve el emisor,
Vicente el receptor) pero ambos leen el mismo historial. `GET` (ambos) y `POST`
(sólo Irene).

Los dos son colecciones **compartidas** y usan la fábrica `crudRoutes` estándar
(ver `server/src/routes/resources.ts`).
