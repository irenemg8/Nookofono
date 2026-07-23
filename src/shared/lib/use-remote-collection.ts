import { useCallback, useEffect, useState } from "react";

/**
 * Modo local de desarrollo.
 *
 * Cuando el bypass del login está puesto (`VITE_AUTH_BYPASS`, ver
 * `use-session.ts`), esta colección guarda en el propio navegador en vez de
 * hablar con el servidor. Así se prueba todo en `localhost` sin backend ni
 * Postgres. Como `import.meta.env.DEV` es falso en el build, este ramal
 * desaparece del bundle de producción.
 */
const LOCAL = import.meta.env.DEV && Boolean(import.meta.env.VITE_AUTH_BYPASS);

const localStore = {
  read<T>(path: string): T[] {
    try {
      const raw = JSON.parse(localStorage.getItem(`ipug.local${path}`) ?? "null");
      return Array.isArray(raw) ? (raw as T[]) : [];
    } catch {
      return [];
    }
  },
  write<T>(path: string, items: T[]) {
    try {
      localStorage.setItem(`ipug.local${path}`, JSON.stringify(items));
    } catch {
      // Cuota llena.
    }
  },
};

/**
 * Colección guardada en el servidor.
 *
 * Es el reemplazo de `useCollection` —que escribía en `localStorage`— y expone
 * exactamente la misma forma (`items`, `create`, `update`, `remove`), así que
 * las pantallas no se enteran del cambio. Es la recompensa del diseño de
 * puertos de `docs/PROYECTO.md` §4.4: los componentes nunca supieron de dónde
 * salían los datos.
 *
 * La diferencia que sí se nota: `localStorage` era de este móvil y esto es
 * compartido. Lo que escribe Irene lo ve Vicente, que es justamente el problema
 * que resuelve el bloque 4 del plan.
 */
export interface Entity {
  id: string;
  createdAt: number;
  updatedAt: number;
}

/** Lo que se sabe de la colección mientras se habla con el servidor. */
export type Status = "loading" | "ready" | "error";

export interface RemoteCollection<T extends Entity> {
  items: T[];
  status: Status;
  /** Motivo del fallo, en español y listo para enseñar. */
  error: string | null;
  create: (data: Omit<T, keyof Entity>) => Promise<T | null>;
  update: (id: string, patch: Partial<T>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reload: () => Promise<void>;
  /**
   * Guarda el orden de la lista entera.
   *
   * Sustituye al `persist()` del hook de `localStorage`, que reescribía el
   * array completo. Aquí el orden es la columna `position`, así que se manda
   * un `PATCH` por cada elemento que de verdad se ha movido.
   */
  reorder: (ordered: T[]) => Promise<void>;
}

/**
 * Traductores entre la forma del servidor y la de la app.
 *
 * Hacen falta porque los dos modelos no coinciden campo a campo: la API guarda
 * fechas civiles como `YYYY-MM-DD` y marcas de tiempo como ISO, mientras que
 * varias apps llevaban números epoch. Convertir aquí evita tocar las pantallas.
 */
export interface Mapper<T> {
  /** Fila del servidor → objeto que espera la app. */
  fromApi?: (row: Record<string, unknown>) => T;
  /** Objeto de la app → cuerpo que acepta la API. */
  toApi?: (data: Record<string, unknown>) => Record<string, unknown>;
}

export function useRemoteCollection<T extends Entity>(
  path: string,
  mapper: Mapper<T> = {},
): RemoteCollection<T> {
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  const { fromApi, toApi } = mapper;

  const decode = useCallback(
    (row: Record<string, unknown>): T => (fromApi ? fromApi(row) : (toEntity(row) as T)),
    [fromApi],
  );

  const reload = useCallback(async () => {
    if (LOCAL) {
      setItems(localStore.read<T>(path));
      setStatus("ready");
      setError(null);
      return;
    }
    try {
      const res = await fetch(path, { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));

      const rows = (await res.json()) as Record<string, unknown>[];
      setItems(rows.map(decode));
      setStatus("ready");
      setError(null);
    } catch {
      setStatus("error");
      setError("No se pudo cargar. Comprueba la conexión.");
    }
  }, [path, decode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(
    async (data: Omit<T, keyof Entity>) => {
      if (LOCAL) {
        const now = Date.now();
        const item = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now } as T;
        setItems((prev) => {
          const next = [item, ...prev];
          localStore.write(path, next);
          return next;
        });
        return item;
      }

      const body = toApi ? toApi(data as Record<string, unknown>) : data;

      try {
        const res = await fetch(path, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(String(res.status));

        const item = decode((await res.json()) as Record<string, unknown>);
        setItems((prev) => [item, ...prev]);
        setError(null);
        return item;
      } catch {
        setError("No se pudo guardar. Comprueba la conexión.");
        return null;
      }
    },
    [path, decode, toApi],
  );

  const update = useCallback(
    async (id: string, patch: Partial<T>) => {
      if (LOCAL) {
        setItems((prev) => {
          const next = prev.map((item) =>
            item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item,
          );
          localStore.write(path, next);
          return next;
        });
        return;
      }

      const body = toApi ? toApi(patch as Record<string, unknown>) : patch;

      // Se pinta el cambio antes de que conteste el servidor: escribir en un
      // campo de texto y ver la letra medio segundo después se siente roto.
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item)),
      );

      try {
        const res = await fetch(`${path}/${id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(String(res.status));

        // La respuesta trae la fila entera, pero sólo se aceptan los campos que
        // se acaban de mandar: mientras volaba la petición el usuario ha podido
        // seguir escribiendo, y pisar el objeto completo le borraría las letras
        // tecleadas desde entonces.
        const fresh = decode((await res.json()) as Record<string, unknown>) as Record<
          string,
          unknown
        >;
        const confirmed = Object.fromEntries(
          Object.keys(patch).map((key) => [key, fresh[key]]),
        ) as Partial<T>;

        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, ...confirmed, updatedAt: msFrom(fresh.updatedAt) } : item,
          ),
        );
        setError(null);
      } catch {
        setError("No se pudo guardar el cambio.");
        // Se recarga en vez de restaurar una copia previa: con varias
        // escrituras en vuelo, esa copia ya no es lo que hay guardado.
        void reload();
      }
    },
    [path, decode, toApi, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      if (LOCAL) {
        setItems((prev) => {
          const next = prev.filter((item) => item.id !== id);
          localStore.write(path, next);
          return next;
        });
        return;
      }

      setItems((prev) => prev.filter((item) => item.id !== id));

      try {
        const res = await fetch(`${path}/${id}`, { method: "DELETE", credentials: "include" });
        if (!res.ok) throw new Error(String(res.status));
        setError(null);
      } catch {
        setError("No se pudo borrar.");
        void reload();
      }
    },
    [path, reload],
  );

  const reorder = useCallback(
    async (ordered: T[]) => {
      if (LOCAL) {
        const next = ordered.map((item, i) => ({ ...item, position: i }) as unknown as T);
        setItems(next);
        localStore.write(path, next);
        return;
      }

      setItems(ordered);

      // Sólo viajan los que cambian de sitio. Arrastrar una nota al principio
      // de una lista de veinte movería una, no veinte.
      const moved = ordered
        .map((item, position) => ({ item, position }))
        .filter(({ item, position }) => (item as { position?: number }).position !== position);

      try {
        await Promise.all(
          moved.map(({ item, position }) =>
            fetch(`${path}/${item.id}`, {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ position }),
            }).then((res) => {
              if (!res.ok) throw new Error(String(res.status));
            }),
          ),
        );
        setItems((prev) =>
          prev.map((item, i) => ({ ...item, position: i }) as unknown as T),
        );
        setError(null);
      } catch {
        setError("No se pudo guardar el orden.");
        void reload();
      }
    },
    [path, reload],
  );

  return { items, status, error, create, update, remove, reorder, reload };
}

/**
 * Fila del servidor con las marcas de tiempo en el formato que usa la app.
 *
 * Postgres las devuelve como texto ISO y los componentes las tratan como
 * números epoch (`createdAt`, `updatedAt` de `Entity`).
 */
export function toEntity(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    createdAt: msFrom(row.createdAt),
    updatedAt: msFrom(row.updatedAt),
  };
}

/** ISO, epoch o nada → epoch en milisegundos. */
export function msFrom(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
}

/** Instante → `YYYY-MM-DD` en hora local, que es la fecha civil que se teclea. */
export function toIsoDate(value: Date | number | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
