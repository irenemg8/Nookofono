/**
 * Almacén de binarios.
 *
 * Los metadatos (nombre, carpeta, etiquetas, quién lo subió) viajan por la API
 * como cualquier otra colección. El **contenido** de los ficheros no cabe ahí,
 * así que va aparte:
 *
 * - En local (modo bypass), a **IndexedDB**, que sí aguanta archivos grandes,
 *   a diferencia de `localStorage`.
 * - Con servidor, a `POST/GET /api/files/:id/blob`, que en el VPS acaba en el
 *   almacén de ficheros. Ver `docs/BACKEND-RAGUGTIN.md`.
 *
 * La app nunca sabe cuál de los dos está detrás: pide `putBlob`/`getBlob` y ya.
 */
const LOCAL = import.meta.env.DEV && Boolean(import.meta.env.VITE_AUTH_BYPASS);

const DB_NAME = "ipug.files";
const STORE = "blobs";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbPut(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* --------------------------------------------------------------- API pública */

export async function putBlob(id: string, blob: Blob): Promise<void> {
  if (LOCAL) return idbPut(id, blob);

  const res = await fetch(`/api/files/${id}/blob`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob,
  });
  if (!res.ok) throw new Error("No se pudo subir el fichero");
}

export async function getBlob(id: string): Promise<Blob | null> {
  if (LOCAL) return idbGet(id);

  const res = await fetch(`/api/files/${id}/blob`, { credentials: "include" });
  return res.ok ? res.blob() : null;
}

export async function deleteBlob(id: string): Promise<void> {
  if (LOCAL) return idbDelete(id);

  await fetch(`/api/files/${id}/blob`, { method: "DELETE", credentials: "include" }).catch(() => {});
}

/** Descarga un blob al dispositivo con el nombre dado. */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Se libera al rato: si se revoca al instante, algún navegador cancela la
  // descarga antes de empezar.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
