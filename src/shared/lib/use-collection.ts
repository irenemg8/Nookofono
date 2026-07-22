import { useCallback, useState } from "react";

/**
 * Colección persistida en el dispositivo.
 *
 * Es el sustituto provisional del repositorio real mientras la app vive en
 * GitHub Pages sin backend. La forma de los métodos es la misma que la del
 * puerto `Repository` de `docs/PROYECTO.md` §4.4, así que al migrar a
 * Cloudflare basta con cambiar el adaptador: los componentes no se enteran.
 */
export interface Entity {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export function useCollection<T extends Entity>(key: string, seed: T[] = []) {
  const [items, setItems] = useState<T[]>(() => read<T>(key, seed));

  const persist = useCallback(
    (next: T[]) => {
      write(key, next);
      setItems(next);
      return next;
    },
    [key],
  );

  const create = useCallback(
    (data: Omit<T, keyof Entity>) => {
      const now = Date.now();
      const item = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now } as T;
      setItems((prev) => {
        const next = [item, ...prev];
        write(key, next);
        return next;
      });
      return item;
    },
    [key],
  );

  const update = useCallback(
    (id: string, patch: Partial<T>) => {
      setItems((prev) => {
        const next = prev.map((item) =>
          item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item,
        );
        write(key, next);
        return next;
      });
    },
    [key],
  );

  const remove = useCallback(
    (id: string) => {
      setItems((prev) => {
        const next = prev.filter((item) => item.id !== id);
        write(key, next);
        return next;
      });
    },
    [key],
  );

  return { items, create, update, remove, persist };
}

function read<T>(key: string, seed: T[]): T[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "null");
    return Array.isArray(raw) ? (raw as T[]) : seed;
  } catch {
    return seed;
  }
}

function write<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Modo privado o cuota llena.
  }
}
