/**
 * Almacén de binarios en disco.
 *
 * Los metadatos de fotos y ficheros viajan por la API como cualquier colección;
 * el contenido no cabe ahí, así que va a un directorio montado como volumen en
 * Docker (`BLOB_ROOT`, por defecto `/data/blobs`). La clave es el `id` de la
 * fila —de `photos` o de `files`—, así que un único almacén sirve a las dos.
 *
 * Junto a cada blob se guarda un `<id>.meta` con su Content-Type, para poder
 * devolverlo tal cual al bajarlo (una foto sin `image/jpeg` se descargaría en
 * vez de verse).
 */
import { createReadStream, type ReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = process.env.BLOB_ROOT ?? "/data/blobs";

/** El id es un UUID; se valida antes de tocar el disco para evitar traversal. */
const ID_RE = /^[0-9a-f-]{36}$/i;

function pathFor(id: string): string {
  if (!ID_RE.test(id)) throw new Error("id inválido");
  // Un subdirectorio por los dos primeros caracteres: evita meter decenas de
  // miles de ficheros en una sola carpeta.
  return join(ROOT, id.slice(0, 2), id);
}

export interface BlobInfo {
  path: string;
  mime: string;
  size: number;
}

/** Guarda el binario y su Content-Type. Sobrescribe si ya existía. */
export async function saveBlob(id: string, bytes: Buffer, mime: string): Promise<void> {
  const file = pathFor(id);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
  await writeFile(`${file}.meta`, mime || "application/octet-stream");
}

/** Devuelve la info del blob para servirlo por streaming, o null si no está. */
export async function statBlob(id: string): Promise<BlobInfo | null> {
  const file = pathFor(id);
  try {
    const s = await stat(file);
    const mime = await readFile(`${file}.meta`, "utf8").catch(() => "application/octet-stream");
    return { path: file, mime: mime.trim(), size: s.size };
  } catch {
    return null;
  }
}

/** Abre el binario como stream para no cargarlo entero en memoria. */
export function readBlobStream(info: BlobInfo): ReadStream {
  return createReadStream(info.path);
}

/** Borra el blob y su meta. No falla si no existían. */
export async function deleteBlob(id: string): Promise<void> {
  const file = pathFor(id);
  await rm(file, { force: true });
  await rm(`${file}.meta`, { force: true });
}
