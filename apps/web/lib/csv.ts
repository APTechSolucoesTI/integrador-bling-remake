import { utils, writeFileXLSX } from "xlsx";

export type SpreadsheetValue = string | number | boolean | null | undefined;

export function downloadXlsx(
  filename: string,
  headers: string[],
  rows: SpreadsheetValue[][],
  sheetName = "Dados",
): void {
  const worksheet = utils.aoa_to_sheet([
    headers,
    ...rows.map((row) => row.map(spreadsheetValue)),
  ]);
  worksheet["!freeze"] = { ySplit: 1 };
  worksheet["!autofilter"] = {
    ref: utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: Math.max(headers.length - 1, 0), r: rows.length },
    }),
  };
  worksheet["!cols"] = headers.map((header, index) => ({
    wch: Math.min(
      48,
      Math.max(
        header.length + 2,
        ...rows.map((row) => String(row[index] ?? "").length + 2),
      ),
    ),
  }));

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const outputName = filename
    .replace(/\.(?:csv|xls)$/i, "")
    .replace(/\.xlsx$/i, "");
  writeFileXLSX(
    workbook,
    `${outputName}.xlsx`,
    { compression: true },
  );
}

// Mantém os pontos de exportação existentes compatíveis enquanto todos passam
// a gerar XLSX real. Os nomes serão ajustados gradualmente na interface.
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: SpreadsheetValue[][],
): void {
  downloadXlsx(filename, headers, rows);
}

export function downloadExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: SpreadsheetValue[][],
): void {
  downloadXlsx(filename, headers, rows, sheetName);
}

function spreadsheetValue(value: SpreadsheetValue): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return value;

  const numeric = numericValue(value.trim());
  if (numeric !== null) return numeric;

  // Dados externos não podem ser interpretados como fórmulas pelo Excel.
  return /^[=+\-@]/.test(value.trim()) ? `'${value}` : value;
}

function numericValue(value: string): number | null {
  // Inteiros:
  // só converte para número se for seguro no JavaScript.
  // Isso evita corromper chave NF-e, identificadores longos etc.
  if (/^-?\d+$/.test(value)) {
    // Mantém identificadores com zero à esquerda como texto.
    if (/^-?0\d+$/.test(value)) return null;

    const parsed = Number(value);

    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  // Decimal padrão: 1234.56
  if (/^-?(?:0|[1-9]\d*)\.\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  // Moeda brasileira: R$ 1.234,56
  const currency = value
    .replace(/\s/g, "")
    .match(/^R\$(-?[\d.]+,\d{2})$/);

  if (currency) {
    const parsed = Number(
      currency[1]!.replaceAll(".", "").replace(",", "."),
    );

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
