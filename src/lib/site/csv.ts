/**
 * CSV building for administrator exports.
 *
 * Two things matter here and both are handled explicitly:
 *  1. Formula injection — a cell beginning with = + - @ (or a control
 *     character) is prefixed with an apostrophe so a spreadsheet treats it as
 *     text instead of executing it.
 *  2. Quoting — anything containing a comma, quote or newline is quoted with
 *     doubled inner quotes, as RFC 4180 requires.
 */

const RISKY_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);

  if (RISKY_PREFIX.test(text)) {
    text = `'${text}`;
  }

  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function buildCsv(columns: string[], rows: unknown[][]): string {
  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(","));
  }
  return lines.join("\r\n");
}

/** Triggers a download of the given CSV text, BOM-prefixed for Excel. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
