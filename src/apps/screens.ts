import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RELOADED = "ipug.chunk-reload";

/**
 * Carga diferida que sobrevive a un despliegue.
 *
 * Cada compilación pone un hash nuevo en el nombre de cada trozo del bundle.
 * Si tienes la web abierta (o cacheada) cuando se despliega otra versión, tu
 * `index.js` viejo sigue pidiendo `profile-ABC123.js`, que en el servidor ya no
 * existe: **404 y la app se cae al abrir esa pantalla**.
 *
 * La única salida es recargar para traerse el `index.js` nuevo. Se hace una
 * sola vez por sesión: si tras recargar sigue fallando, el problema es otro y
 * conviene que se vea el error de verdad en lugar de recargar en bucle.
 */
function app(loader: () => Promise<{ default: ComponentType }>) {
  return lazy(async () => {
    try {
      const mod = await loader();
      sessionStorage.removeItem(RELOADED);
      return mod;
    } catch (error) {
      if (!sessionStorage.getItem(RELOADED)) {
        sessionStorage.setItem(RELOADED, "1");
        window.location.reload();
        // Algo que devolver mientras el navegador recarga.
        return { default: () => null };
      }
      throw error;
    }
  });
}

/**
 * Pantallas reales de las mini-apps.
 *
 * Una app que no aparezca aquí muestra la burbuja de "todavía no está
 * construida". Añadir una pantalla es crear `src/apps/<id>/index.tsx` con un
 * `export default` y registrarla en este mapa: nada más.
 */
export const screens: Record<string, LazyExoticComponent<ComponentType>> = {
  weather: app(() => import("./weather")),
  notes: app(() => import("./notes")),
  profile: app(() => import("./profile")),
  nilo: app(() => import("./nilo")),
  airlines: app(() => import("./airlines")),
  music: app(() => import("./music")),
  sos: app(() => import("./sos")),
  advice: app(() => import("./advice")),
  calendar: app(() => import("./calendar")),
  tasks: app(() => import("./tasks")),
};
