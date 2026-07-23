import type { Sheet } from "../../sheets/model/grid";
import { makeAddr } from "../../sheets/model/grid";

/**
 * Convierte una hoja en un blob `.xlsx`, para volver a guardarla como fichero.
 *
 * La librería `xlsx` va con `import()` dinámico, igual que en el resto de la app
 * de hojas: sólo se carga al guardar de verdad.
 */
export async function exportSheetBlob(sheet: Sheet): Promise<Blob> {
  const XLSX = await import("xlsx");

  const aoa: (string | number)[][] = [];
  for (let r = 0; r < sheet.rows; r++) {
    const row: (string | number)[] = [];
    for (let c = 0; c < sheet.cols; c++) row.push(sheet.cells[makeAddr(r, c)] ?? "");
    aoa.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31) || "Hoja");

  const array = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([array], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
