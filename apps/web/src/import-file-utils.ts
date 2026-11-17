const spreadsheetFormulaPrefix = /^[\t\r ]*[=+@-]/;

function escapeCsvCell(value: string, protectFormulas: boolean): string {
  const safeValue =
    protectFormulas && spreadsheetFormulaPrefix.test(value)
      ? "'" + value
      : value;
  return '"' + safeValue.replaceAll('"', '""') + '"';
}

export function serializeImportCsv(
  rows: readonly (readonly string[])[],
  protectFormulas = true,
): string {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row.map((value) => escapeCsvCell(value, protectFormulas)).join(','),
      )
      .join('\r\n')
  );
}

export function downloadImportCsv(
  fileName: string,
  rows: readonly (readonly string[])[],
  protectFormulas = true,
): void {
  const safeFileName = fileName
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .trim();
  const blob = new Blob([serializeImportCsv(rows, protectFormulas)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFileName || 'instituteos-import.csv';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
