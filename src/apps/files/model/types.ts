import type { Entity } from "../../../shared/lib/use-remote-collection";
import type { PersonId } from "../../../shared/lib/use-current-user";

/**
 * RAGugtín — el Drive de la pareja.
 *
 * Carpetas y ficheros son dos colecciones de metadatos. El **contenido** de los
 * ficheros no vive aquí, sino en el almacén de binarios (`shared/lib/filestore`).
 *
 * Además de guardar, RAGugtín es **la fuente del RAG de Valentín**: el modelo
 * fine-tuneado lee de aquí para responder con datos vuestros. Eso pide, en el
 * backend, que se extraiga el texto de cada fichero al subirlo — ver
 * `docs/BACKEND-RAGUGTIN.md`.
 */

export interface Folder extends Entity {
  name: string;
  /** Carpeta padre; `""` es la raíz. */
  parentId: string;
  createdBy: PersonId | "";
}

export interface FileItem extends Entity {
  name: string;
  /** Carpeta donde está; `""` es la raíz. */
  folderId: string;
  mime: string;
  size: number;
  /** Etiquetas libres. */
  tags: string[];
  uploadedBy: PersonId | "";
}

/** Familia del fichero a partir del nombre/mime, para el icono y las acciones. */
export type Kind = "sheet" | "doc" | "image" | "pdf" | "text" | "other";

export function kindOf(file: { name: string; mime: string }): Kind {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["xlsx", "xls", "csv"].includes(ext)) return "sheet";
  if (["doc", "docx", "odt"].includes(ext)) return "doc";
  if (["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["txt", "md", "json"].includes(ext)) return "text";
  if (file.mime.startsWith("image/")) return "image";
  return "other";
}

export function isSheet(file: { name: string; mime: string }): boolean {
  return kindOf(file) === "sheet";
}

export function isDoc(file: { name: string; mime: string }): boolean {
  return kindOf(file) === "doc";
}

/** "1,4 MB" a partir de los bytes. */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
