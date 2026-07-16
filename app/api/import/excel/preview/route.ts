import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import * as XLSX from 'xlsx'
import { guessMapping, mapRow, inferProduit } from '@/lib/excel-import'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ message: 'Aucun fichier fourni.' }, { status: 422 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  } catch {
    return NextResponse.json({ message: 'Fichier illisible. Formats acceptés : .xlsx, .xls, .csv' }, { status: 422 })
  }

  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null })

  if (rows.length < 2) {
    return NextResponse.json({ message: 'Le fichier ne contient aucune ligne de données.' }, { status: 422 })
  }

  const headers = (rows[0] as unknown[]).map((h) => (h === null ? '' : String(h)))
  const dataRows = rows.slice(1).filter((r) => r.some((cell) => cell !== null && cell !== undefined && cell !== ''))

  // Ignore la ligne "TOTAL" éventuelle en fin de fichier
  const cleanedRows = dataRows.filter((r) => {
    const joined = r.map((c) => (c === null ? '' : String(c))).join(' ').toLowerCase()
    return !/^\s*total\s*$/.test(joined.trim())
  })

  const mapping = guessMapping(headers)

  const sample = cleanedRows.slice(0, 10).map((r) => {
    const parsed = mapRow(r, mapping)
    const produit = inferProduit(parsed)
    return { ...parsed, produitInfere: produit.produitNom }
  })

  return NextResponse.json({
    sheetName,
    headers,
    mapping,
    totalRows: cleanedRows.length,
    sample,
  })
}
