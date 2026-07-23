/**
 * Importar y exportar documentos de Word.
 *
 * Como en la app de hojas, las librerías pesan y van con `import()` dinámico:
 * sólo llegan al navegador al abrir o guardar un documento.
 *
 * - **Leer** un `.docx` → HTML, con `mammoth`.
 * - **Escribir** HTML → `.docx`, con `html-to-docx`.
 *
 * El formato que se conserva es el básico: títulos, negrita, cursiva, listas,
 * párrafos. Tablas, imágenes o estilos finos del original se pierden al
 * reeditar —igual que las hojas pierden colores—. Se avisa en la app.
 */

export async function importDocx(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  // Un .doc "de los nuestros" es en realidad HTML de Word: se lee tal cual.
  if (name.endsWith(".doc") || name.endsWith(".html") || file.type.includes("html")) {
    const text = await file.text();
    // Nos quedamos con el cuerpo si viene documento completo.
    const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(text);
    return body ? body[1] : text;
  }

  const mammoth = await import("mammoth");
  const buffer = await file.arrayBuffer();
  const { value } = await mammoth.convertToHtml({ arrayBuffer: buffer });
  return value || "<p></p>";
}

export async function exportDocxBlob(html: string): Promise<Blob> {
  const mod = await import("html-to-docx");
  const htmlToDocx = (mod.default ?? mod) as (h: string) => Promise<ArrayBuffer | Blob>;
  const out = await htmlToDocx(wrap(html));
  return out instanceof Blob
    ? out
    : new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
}

/**
 * Exporta como `.doc` que abre Word directamente.
 *
 * Es HTML con las cabeceras que Word entiende: cero dependencias, siempre
 * funciona. Es la red de seguridad si algún día `html-to-docx` diera guerra en
 * el navegador, y una opción de descarga por sí misma.
 */
export function exportDocBlob(html: string): Blob {
  const doc = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Documento</title></head><body>${html}</body></html>`;
  return new Blob([doc], { type: "application/msword" });
}

function wrap(html: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
}
