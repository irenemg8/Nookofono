# Backend de «Compra» — carrito de Mercadona

> Frontend en `src/apps/shopping/`. Rutas propias en
> `server/src/routes/mercadona.ts` (no `crudRoutes`: el catálogo se llena por
> importación y el carrito tiene lógica propia). Catálogo compartido; carrito
> compartido.

## De dónde salen los productos

La API pública (no oficial) de Mercadona, `https://tienda.mercadona.es/api`:

- `GET /categories/` — árbol de categorías (26 raíz, ~151 hojas).
- `GET /categories/<id>/?wh=vlc1` — una categoría con **sus productos**.
- `GET /products/<id>/?wh=vlc1` — detalle de un producto (para refrescar precio).
- `PUT /postal-codes/actions/change-pc/` con `{"new_postal_code":"46117"}` fija
  el almacén: **CP 46117 → warehouse `vlc1`** (precios de Valencia). El `wh` se
  pasa como query en el resto de llamadas.

No hay endpoint de búsqueda ni listado masivo: el catálogo se construye
recorriendo las categorías hoja. El script de descarga vive fuera del server
(se corrió una vez para generar `server/src/db/mercadona-seed.json`, 4360
productos).

Campos que se guardan por producto: `id` (el id real de Mercadona, string),
`display_name`, `packaging` ("1 ud", "Garrafa", "Pack-3"…), `thumbnail` (URL de
la foto), `price_instructions.unit_price` → `priceCents` (céntimos enteros).

## Tablas

- **`mercadona_products`**: catálogo. `id` es el id real de Mercadona (PK
  texto). `priceCents` en céntimos. `favorite` marca los ~73 productos
  habituales (se muestran primero, con `position`). `refreshedAt` = última vez
  que se miró el precio.
- **`mercadona_cart`**: la lista de la compra compartida. Una fila por producto
  en el carrito, con `quantity`, `checked` (cogido) y `position`. `productId` es
  referencia suelta al catálogo (sin FK dura).

## Rutas (`/api/mercadona`)

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/products` | Favoritos (lista habitual), ordenados por `position`. |
| GET | `/products?q=texto` | Busca en TODO el catálogo por nombre (hasta 60). |
| GET | `/cart` | El carrito, con nombre/precio/foto del producto embebidos. |
| POST | `/cart` `{productId, quantity?}` | Añade; si ya está, sube la cantidad. |
| PATCH | `/cart/:id` `{quantity?, checked?, position?}` | Actualiza una línea. |
| DELETE | `/cart/:id` | Quita del carrito. |
| POST | `/cart/clear-checked` | Borra las líneas ya cogidas. `{removed: n}`. |
| POST | `/refresh/:id` | Refresca el precio de un producto desde la API. |

El total lo calcula el frontend (`Σ priceCents × quantity`). El botón
«Tramitar pedido» de la app de Mercadona **no** se replica: esto es una lista de
la compra compartida, no hace el pedido real.

## Sembrado y refresco

- **Primer arranque**: el `docker-entrypoint.sh` corre
  `db:import-mercadona --if-empty`, que vuelca el seed sólo si el catálogo está
  vacío. En reinicios no hace nada.
- **Refrescar precios**: reejecutar `npm run db:import-mercadona` (sin flag)
  reimporta todo con upsert, o `POST /api/mercadona/refresh/:id` para uno.
  Regenerar el seed con precios nuevos es volver a correr el script de descarga.
