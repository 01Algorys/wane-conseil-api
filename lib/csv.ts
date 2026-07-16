export function toCsv(rows: Record<string, string | number>[], headers: { key: string; label: string }[]) {
  const escape = (value: string | number) => {
    const str = String(value ?? '')
    return /[",\n;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }

  const headerLine = headers.map((h) => escape(h.label)).join(';')
  const lines = rows.map((row) => headers.map((h) => escape(row[h.key])).join(';'))
  return '﻿' + [headerLine, ...lines].join('\n')
}

export function csvResponse(filename: string, csv: string) {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
