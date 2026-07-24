import { useCallback, useEffect, useRef, useState } from "react";
import { deleteBlob, getBlob, putBlob } from "./filestore";
import { useCurrentUser, type PersonId } from "./use-current-user";
import { useRemoteCollection, type Entity } from "./use-remote-collection";

/**
 * La biblioteca de fotos, compartida por la app Fotos y por los widgets.
 *
 * Dos orígenes:
 *
 * 1. **Predeterminadas** — cualquier imagen en `src/assets/photos/`. Vite las
 *    descubre al compilar; se pintan siempre y no se pueden borrar desde la app.
 * 2. **Subidas** — metadatos en la colección `/api/photos` y el binario en el
 *    almacén de blobs (IndexedDB en local, `/api/files/:id/blob` con servidor).
 *    A diferencia del viejo `usePhotos`, que las metía como data URL en
 *    `localStorage` (unos pocos MB en total), esto aguanta fotos de verdad.
 */

export interface PhotoMeta extends Entity {
  name: string;
  mime: string;
  uploadedBy: PersonId | "";
  /** Orden en la galería. */
  position: number;
}

/** Foto ya resuelta y lista para pintar. */
export interface PhotoRef {
  id: string;
  name: string;
  /** URL para el `<img>`: asset de la app o object URL del blob. */
  url: string;
  /** De la app (no se puede borrar) o subida por alguien. */
  bundled: boolean;
  uploadedBy: PersonId | "";
}

const BUNDLED: PhotoRef[] = Object.entries(
  import.meta.glob<{ default: string }>("../../assets/photos/*.{webp,png,jpg,jpeg,avif}", {
    eager: true,
  }),
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, mod], i) => ({
    id: `bundled:${path}`,
    name: path.split("/").pop() ?? `foto-${i + 1}`,
    url: mod.default,
    bundled: true,
    uploadedBy: "" as const,
  }));

export interface PhotoLibrary {
  /** Subidas (más nuevas primero) seguidas de las de la app. */
  refs: PhotoRef[];
  status: "loading" | "ready" | "error";
  error: string | null;
  upload: (file: File) => Promise<void>;
  remove: (id: string) => Promise<void>;
  bundledCount: number;
}

export function usePhotoLibrary(): PhotoLibrary {
  const meta = useRemoteCollection<PhotoMeta>("/api/photos");
  const me = useCurrentUser();

  const [urls, setUrls] = useState<Record<string, string>>({});
  // Se guarda aparte del estado para poder revocar los object URL viejos sin
  // depender del ciclo de render.
  const urlsRef = useRef<Record<string, string>>({});

  // Carga los blobs de las fotos subidas y los convierte en object URL. Sólo
  // pide los que aún no tiene; revoca los de fotos que ya no están.
  useEffect(() => {
    let alive = true;
    const ids = new Set(meta.items.map((m) => m.id));

    (async () => {
      const next: Record<string, string> = {};
      for (const m of meta.items) {
        const have = urlsRef.current[m.id];
        if (have) {
          next[m.id] = have;
          continue;
        }
        const blob = await getBlob(m.id);
        if (!alive) return;
        if (blob) next[m.id] = URL.createObjectURL(blob);
      }
      if (!alive) return;

      for (const [id, url] of Object.entries(urlsRef.current)) {
        if (!ids.has(id)) URL.revokeObjectURL(url);
      }
      urlsRef.current = next;
      setUrls(next);
    })();

    return () => {
      alive = false;
    };
  }, [meta.items]);

  // Al desmontar, se sueltan todos los object URL.
  useEffect(
    () => () => {
      for (const url of Object.values(urlsRef.current)) URL.revokeObjectURL(url);
    },
    [],
  );

  const uploaded: PhotoRef[] = meta.items
    .slice()
    .sort((a, b) => a.position - b.position || b.createdAt - a.createdAt)
    .map((m) => ({
      id: m.id,
      name: m.name,
      url: urls[m.id] ?? "",
      bundled: false,
      uploadedBy: m.uploadedBy,
    }))
    // Mientras no esté el blob cargado no se muestra: nada de imágenes rotas.
    .filter((r) => r.url);

  const upload = useCallback(
    async (file: File) => {
      const item = await meta.create({
        name: file.name || "foto",
        mime: file.type || "image/*",
        uploadedBy: me,
        position: meta.items.length,
      });
      if (item) await putBlob(item.id, file).catch(() => {});
    },
    [meta, me],
  );

  const remove = useCallback(
    async (id: string) => {
      if (id.startsWith("bundled:")) return; // las de la app no se borran
      await meta.remove(id);
      await deleteBlob(id).catch(() => {});
    },
    [meta],
  );

  return {
    refs: [...uploaded, ...BUNDLED],
    status: meta.status,
    error: meta.error,
    upload,
    remove,
    bundledCount: BUNDLED.length,
  };
}

/**
 * La foto que toca mostrar en un widget, según su configuración.
 *
 * - Sin config o `ids` vacío → toda la galería.
 * - `ids` con fotos → sólo esas (si alguna se borró, se ignora).
 * - Una sola foto en el conjunto, o `intervalSec` 0 → fija, no rota.
 * - Varias → rota cada `intervalSec`, empezando en `seed` para que dos widgets
 *   no enseñen lo mismo a la vez.
 */
export function useWidgetPhoto(
  refs: PhotoRef[],
  config: { ids: string[]; intervalSec: number } | undefined,
  seed: number,
): PhotoRef | null {
  const ids = config?.ids ?? [];
  const pool = ids.length ? refs.filter((r) => ids.includes(r.id)) : refs;
  // Si la selección se quedó sin fotos (todas borradas), se cae a toda la galería.
  const list = pool.length ? pool : refs;

  const intervalMs = (config?.intervalSec ?? 8) * 1000;
  const rotates = list.length > 1 && intervalMs > 0;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!rotates) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [rotates, intervalMs]);

  if (list.length === 0) return null;
  return list[(seed + tick) % list.length];
}

/** Descarga una foto al dispositivo, sea subida (blob) o de la app (asset). */
export async function downloadPhoto(ref: PhotoRef): Promise<void> {
  const blob = ref.bundled ? await fetch(ref.url).then((r) => r.blob()) : await getBlob(ref.id);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ref.name || "foto";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
