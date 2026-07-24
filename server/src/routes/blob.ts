/**
 * El almacén de binarios: `PUT/GET/DELETE /api/files/:id/blob`.
 *
 * El `:id` es el de una fila de `files` o de `photos` —un único almacén sirve a
 * las dos colecciones—. El cuerpo del PUT es el fichero crudo con su
 * `Content-Type` real; el GET lo devuelve tal cual para verlo o descargarlo.
 *
 * Al subir un fichero de RAG-Pugtín se lanza la indexación para Valentín
 * (extraer texto, trocear, generar embeddings) en segundo plano: subir no debe
 * esperar a que termine el troceado.
 */
import { Readable } from "node:stream";

import { Hono } from "hono";

import type { AuthVars } from "../auth/middleware.js";
import { deleteBlob, readBlobStream, saveBlob, statBlob } from "../lib/blobs.js";
import { indexFile } from "../lib/rag.js";

type Env = { Bindings: Record<string, never>; Variables: AuthVars };

const r = new Hono<Env>();

/** Sube (o reemplaza) el binario. Body = fichero crudo. */
r.put("/:id/blob", async (c) => {
  const id = c.req.param("id");
  const mime = c.req.header("content-type") ?? "application/octet-stream";
  const bytes = Buffer.from(await c.req.arrayBuffer());

  if (bytes.length === 0) {
    return c.json({ error: { code: "EMPTY_BODY", message: "El fichero está vacío" } }, 400);
  }

  try {
    await saveBlob(id, bytes, mime);
  } catch {
    return c.json({ error: { code: "INVALID_ID", message: "Identificador no válido" } }, 400);
  }

  // Indexado para el RAG en segundo plano; si falla, no rompe la subida (el
  // fichero ya está guardado y se podrá reindexar). Sólo aplica a ficheros de
  // RAG-Pugtín; para fotos, indexFile no encuentra fila en `files` y no hace nada.
  void indexFile(id, bytes, mime).catch((err) => {
    console.error(`RAG: no se pudo indexar ${id}:`, err);
  });

  return c.body(null, 201);
});

/** Devuelve el binario por streaming. */
r.get("/:id/blob", async (c) => {
  const info = await statBlob(c.req.param("id")).catch(() => null);
  if (!info) {
    return c.json({ error: { code: "NOT_FOUND", message: "No existe" } }, 404);
  }

  // Que el navegador lo cachee: el binario de un id nunca cambia sin cambiar la
  // fila (y su updatedAt), así que es seguro.
  const headers = {
    "Content-Type": info.mime,
    "Content-Length": String(info.size),
    "Cache-Control": "private, max-age=31536000, immutable",
  };

  // El ReadStream de Node se convierte a ReadableStream web, que es lo que
  // espera la Response de Hono; `@hono/node-server` lo vuelca al socket sin
  // cargar el fichero entero en memoria.
  const body = Readable.toWeb(readBlobStream(info)) as ReadableStream;
  return new Response(body, { headers });
});

/** Borra el binario. Se usa poco por separado: el DELETE de la fila ya lo borra. */
r.delete("/:id/blob", async (c) => {
  await deleteBlob(c.req.param("id")).catch(() => {});
  return c.body(null, 204);
});

export default r;
