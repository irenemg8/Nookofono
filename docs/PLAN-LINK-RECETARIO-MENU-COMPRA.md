# Plan — enlazar Recetario · Menú · Compra (ingredientes con producto real)

> Petición de Vicente (2026-07-25): que las tres apps estén enlazadas. Un
> ingrediente de receta puede ser un producto real de Mercadona; «Compra de la
> semana» del Menú añade esos productos al carrito de la app Compra con un botón.

## Decisiones tomadas

1. **Recetario**: al añadir un ingrediente se puede elegir el producto real de
   Mercadona (buscador sobre el catálogo, como en Compra). El ingrediente
   guarda `text` + `productId?`.
2. **Menú → «Compra de la semana»**: el panel muestra los ingredientes de las
   recetas planificadas; cada uno con botón «añadir al carrito» y un «Añadir
   todo». Se revisa luego en la app Compra.
3. **Recetas existentes**: se migran (reenlazar por nombre con el catálogo).
   Riesgo bajo: en prod hay 1 receta con 2 ingredientes. Lo que no empareje se
   queda como texto (no rompe nada).

## Cambio de modelo (retrocompatible)

Un ingrediente pasa de `string` a objeto:

```ts
interface Ingredient { text: string; productId?: string | null }
```

- El backend acepta **ambas formas** en `ingredients` (string suelto → se trata
  como `{ text }`), y las normaliza a objeto al guardar. Recetas viejas con
  `string[]` siguen validando.
- El frontend normaliza al leer (`typeof ing === "string" ? {text:ing} : ing`),
  así ninguna pantalla se rompe durante la transición.

Sin columna nueva: sigue siendo el mismo `jsonb ingredients`, solo cambia la
forma de cada elemento. No hace falta migración de esquema.

## Bloques

| # | Bloque | Verificación |
|---|---|---|
| 1 | **Backend**: el zod de `recipes.ingredients` acepta string U objeto `{text, productId?}` y normaliza a objeto. | `tsc` compila; POST con ambas formas funciona. |
| 2 | **Tipos front**: `Ingredient` objeto; helpers de normalización. Recetario, Menú y su ShoppingSheet leen la forma nueva sin romper la vieja. | build compila. |
| 3 | **Recetario UI**: el editor de ingredientes permite buscar y elegir producto de Mercadona (o dejar texto libre). Muestra si está enlazado. | Crear receta eligiendo producto; se guarda el `productId`. |
| 4 | **Menú «Compra de la semana»**: cada ingrediente con botón «+ carrito»; botón «Añadir todo». Los que tienen `productId` van al carrito real; los de solo texto se avisan (no enlazados). | Añadir todo mete los productos en `/api/mercadona/cart`. |
| 5 | **Migración recetas existentes**: script que reenlaza ingredientes de texto con el catálogo por nombre (match >=0.6); lo dudoso se queda texto. | La receta de prod queda con sus ingredientes enlazados donde haya match. |
| 6 | **Verificación E2E** (local + navegador) y **despliegue**. | Las 3 apps enlazadas en prod. |

## Criterio de aceptación

Crear/editar una receta eligiendo productos de Mercadona; planificarla en el
Menú; pulsar «Compra de la semana» → «Añadir todo» mete esos productos en el
carrito de Compra; revisarlos ahí. Recetas viejas siguen funcionando.
