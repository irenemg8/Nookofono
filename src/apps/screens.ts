import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Pantallas reales de las mini-apps.
 *
 * Una app que no aparezca aquí muestra la burbuja de "todavía no está
 * construida". Añadir una pantalla es crear `src/apps/<id>/index.tsx` con un
 * `export default` y registrarla en este mapa: nada más.
 *
 * Van con `lazy` para que cada pantalla sea su propio trozo del bundle y no
 * pese en la pantalla de inicio.
 */
export const screens: Record<string, LazyExoticComponent<ComponentType>> = {
  weather: lazy(() => import("./weather")),
  notes: lazy(() => import("./notes")),
  profile: lazy(() => import("./profile")),
  nilo: lazy(() => import("./nilo")),
  airlines: lazy(() => import("./airlines")),
};
