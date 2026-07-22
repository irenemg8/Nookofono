import { useEffect, useState } from "react";

/**
 * Fotos disponibles para los widgets y para la app Fotos.
 *
 * Dos orígenes, en este orden:
 *
 * 1. **Predeterminadas** — cualquier imagen que Irene deje en
 *    `src/assets/photos/`. Vite las descubre en tiempo de compilación con
 *    `import.meta.glob`, así que basta con soltar el fichero: no hay que
 *    registrarlas en ningún sitio.
 * 2. **Subidas** — las que se añadan desde la app, guardadas en `localStorage`
 *    como data URL. En fase 2 esto pasa a R2 y aquí sólo cambiará el adaptador.
 *    Ver docs/MIGRACION-BACKEND.md §11.
 */
const STORAGE_KEY = "ipug.photos";

const bundled = Object.entries(
  import.meta.glob<{ default: string }>("../../assets/photos/*.{webp,png,jpg,jpeg,avif}", {
    eager: true,
  }),
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, mod]) => mod.default);

export function usePhotos(): string[] {
  const [uploaded, setUploaded] = useState<string[]>(readUploaded);

  // Si el otro móvil añade una foto en la misma sesión de navegador, el evento
  // `storage` la propaga sin recargar.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setUploaded(readUploaded());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return [...bundled, ...uploaded];
}

function readUploaded(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Rota entre las fotos disponibles cada `intervalMs`, empezando en un punto
 * distinto según `seed` para que dos widgets no enseñen la misma foto a la vez.
 */
export function useRotatingPhoto(photos: string[], seed = 0, intervalMs = 8000): string | null {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (photos.length < 2) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [photos.length, intervalMs]);

  if (photos.length === 0) return null;
  return photos[(seed + tick) % photos.length];
}
