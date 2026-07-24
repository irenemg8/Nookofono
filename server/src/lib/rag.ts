/**
 * RAG de Valentín — la mitad recuperable.
 *
 * Al subir un fichero a RAG-Pugtín se extrae su texto, se trocea y se generan
 * embeddings locales (all-MiniLM-L6-v2, 384 dimensiones, sin API de pago ni
 * datos que salgan del VPS). Los trozos se guardan en `file_chunks` con su
 * vector para poder recuperarlos por similitud.
 *
 * Lo que NO hay aquí es la GENERACIÓN de la respuesta: el modelo fine-tuneado
 * de Valentín todavía no existe, así que el endpoint de chat recupera trozos y
 * responde 503 en la parte de generar. Cuando el modelo esté, se enchufa ahí.
 */
import { and, eq, sql } from "drizzle-orm";

import { db } from "../db/client.js";
import { fileChunks, files } from "../db/schema.js";

/* --------------------------------------------------------------- embeddings */

// El modelo se carga una vez y se reutiliza (pesa ~90 MB en disco y tarda en
// arrancar). Se importa de forma perezosa para que el server no pague el
// arranque del runtime de transformers si nadie sube ficheros.
type Extractor = (text: string, opts: { pooling: "mean"; normalize: true }) => Promise<{ data: Float32Array }>;
let extractorPromise: Promise<Extractor> | null = null;

async function getExtractor(): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      return (await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2")) as unknown as Extractor;
    })();
  }
  return extractorPromise;
}

/** Texto → vector de 384 floats, normalizado (para similitud coseno). */
export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const out = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
}

/* ------------------------------------------------------------- extracción */

/** Saca texto plano del binario según su tipo. Vacío si no se sabe leerlo. */
async function extractText(bytes: Buffer, mime: string, name: string): Promise<string> {
  const ext = name.toLowerCase().split(".").pop() ?? "";

  if (mime.startsWith("text/") || ["txt", "md", "csv"].includes(ext)) {
    return bytes.toString("utf8");
  }

  if (mime === "application/pdf" || ext === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(bytes) });
    try {
      return (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  }

  if (ext === "docx" || mime.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer: bytes })).value;
  }

  if (["xlsx", "xls"].includes(ext) || mime.includes("spreadsheetml")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(bytes, { type: "buffer" });
    return wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n\n");
  }

  return "";
}

/** Trocea el texto en fragmentos solapados para no partir ideas por la mitad. */
function chunk(text: string, size = 800, overlap = 100): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += size - overlap) {
    out.push(clean.slice(i, i + size));
    if (i + size >= clean.length) break;
  }
  return out;
}

/* ----------------------------------------------------------------- indexar */

/**
 * Indexa un fichero de RAG-Pugtín: extrae, trocea, embebe y guarda los trozos.
 * Idempotente: borra los trozos anteriores del fichero antes de reindexar.
 *
 * Si el `id` no corresponde a una fila de `files` (p. ej. es una foto), no hace
 * nada: las fotos no se indexan.
 */
export async function indexFile(id: string, bytes: Buffer, mime: string): Promise<void> {
  const [file] = await db.select().from(files).where(eq(files.id, id)).limit(1);
  if (!file) return; // No es un fichero de RAG-Pugtín (p. ej. una foto).

  const text = await extractText(bytes, mime, file.name);
  const pieces = chunk(text);

  // Fuera lo viejo, tanto si vamos a reindexar como si el fichero se quedó sin
  // texto legible (un .png subido a Archivos): no dejar trozos huérfanos.
  await db.delete(fileChunks).where(eq(fileChunks.fileId, id));
  if (pieces.length === 0) return;

  for (const content of pieces) {
    const embedding = await embed(content);
    await db.insert(fileChunks).values({ fileId: id, content, embedding });
  }
}

/* --------------------------------------------------------------- recuperar */

export interface RetrievedChunk {
  fileId: string;
  content: string;
  distance: number;
}

/** Los `k` trozos más cercanos a la pregunta por distancia coseno (pgvector). */
export async function retrieve(query: string, k = 6): Promise<RetrievedChunk[]> {
  const vec = await embed(query);
  const literal = `[${vec.join(",")}]`;

  const rows = await db
    .select({
      fileId: fileChunks.fileId,
      content: fileChunks.content,
      distance: sql<number>`${fileChunks.embedding} <=> ${literal}::vector`,
    })
    .from(fileChunks)
    .where(and(sql`${fileChunks.embedding} IS NOT NULL`))
    .orderBy(sql`${fileChunks.embedding} <=> ${literal}::vector`)
    .limit(k);

  return rows;
}
