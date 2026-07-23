import { colName, makeAddr, type Sheet } from "./grid";

/**
 * Importar y exportar `.xlsx`/`.csv`.
 *
 * La librería `xlsx` (SheetJS) pesa bastante, así que se carga con `import()`
 * dinámico: sólo llega al navegador cuando de verdad se abre o se guarda un
 * fichero, no al abrir la app.
 */

export async function importFile(file: File): Promise<Sheet> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  const first = wb.SheetNames[0];
  const ws = wb.Sheets[first];
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");

  const cells: Record<string, string> = {};
  let maxRow = 0;
  let maxCol = 0;

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      // Se conserva la fórmula si la hay (`.f`), si no el valor mostrado.
      const raw = cell.f ? `=${cell.f}` : String(cell.w ?? cell.v ?? "");
      if (raw !== "") {
        cells[makeAddr(r, c)] = raw;
        maxRow = Math.max(maxRow, r);
        maxCol = Math.max(maxCol, c);
      }
    }
  }

  return {
    name: cleanName(file.name),
    rows: Math.max(maxRow + 2, 20),
    cols: Math.max(maxCol + 2, 8),
    cells,
  };
}

export async function exportFile(sheet: Sheet, format: "xlsx" | "csv") {
  const XLSX = await import("xlsx");

  // De nuestro modelo disperso a la matriz que espera la librería.
  const aoa: (string | number)[][] = [];
  for (let r = 0; r < sheet.rows; r++) {
    const row: (string | number)[] = [];
    for (let c = 0; c < sheet.cols; c++) {
      row.push(sheet.cells[makeAddr(r, c)] ?? "");
    }
    aoa.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31) || "Hoja");
  XLSX.writeFile(wb, `${sheet.name || "hoja"}.${format}`);
}

function cleanName(fileName: string): string {
  return fileName.replace(/\.(xlsx|xls|csv)$/i, "").slice(0, 40) || "Hoja";
}

// Se re-exporta para el índice.
export { colName };
