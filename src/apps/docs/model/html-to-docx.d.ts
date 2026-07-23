/** `html-to-docx` no trae tipos. Sólo se usa su función por defecto. */
declare module "html-to-docx" {
  export default function htmlToDocx(
    html: string,
    headerHtml?: string | null,
    options?: Record<string, unknown>,
  ): Promise<ArrayBuffer | Blob>;
}
