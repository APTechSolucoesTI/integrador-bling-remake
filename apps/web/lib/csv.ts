export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>,
): void {
  const escape = (value: string | number | boolean | null | undefined) => {
    const normalized =
      value === null || value === undefined ? "" : String(value);
    return `"${normalized.replaceAll('"', '""')}"`;
  };
  const content = [headers, ...rows]
    .map((row) => row.map(escape).join(";"))
    .join("\r\n");
  const blob = new Blob(["\uFEFF", content], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>,
): void {
  const xml = (value: string | number | boolean | null | undefined) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  const rowXml = (row: Array<string | number | boolean | null | undefined>) =>
    `<Row>${row
      .map((value) => {
        const type = typeof value === "number" ? "Number" : "String";
        return `<Cell><Data ss:Type="${type}">${xml(value)}</Data></Cell>`;
      })
      .join("")}</Row>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#DFF2E9" ss:Pattern="Solid"/></Style></Styles>
 <Worksheet ss:Name="${xml(sheetName.slice(0, 31))}"><Table>
  <Row ss:StyleID="Header">${headers
    .map(
      (header) => `<Cell><Data ss:Type="String">${xml(header)}</Data></Cell>`,
    )
    .join("")}</Row>
  ${rows.map(rowXml).join("\n")}
 </Table></Worksheet>
</Workbook>`;
  const blob = new Blob([workbook], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
