import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { randomUUID } from 'crypto'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  ImportFieldKey,
  mapRow,
  inferProduit,
  normalizeDedupKey,
  normalizePhone,
  addDays,
  CATEGORISER_LABEL,
} from '@/lib/excel-import'

export const runtime = 'nodejs'
const CHUNK_SIZE = 500

export async function POST(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const mappingRaw = formData.get('mapping') as string | null
  if (!file || !mappingRaw) {
    return NextResponse.json({ message: 'Fichier ou mapping manquant.' }, { status: 422 })
  }

  const mapping = JSON.parse(mappingRaw) as Record<number, ImportFieldKey>

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null })
  const dataRows = rows.slice(1).filter((r) => {
    if (!r.some((cell) => cell !== null && cell !== undefined && cell !== '')) return false
    const joined = r.map((c) => (c === null ? '' : String(c))).join(' ').toLowerCase()
    return !/^\s*total\s*$/.test(joined.trim())
  })

  const errors: { line: number; reason: string }[] = []
  let doublonsIgnores = 0

  // --- Préchargement des référentiels et clients existants ---
  const [existingDistributeurs, existingProduits, existingStatuts, existingClients, existingNumeros] = await Promise.all([
    prisma.listeReference.findMany({ where: { type: 'DISTRIBUTEUR' } }),
    prisma.listeReference.findMany({ where: { type: 'PRODUIT' } }),
    prisma.listeReference.findMany({ where: { type: 'STATUT_CONTRAT' } }),
    prisma.client.findMany({ select: { id: true, nom: true, prenom: true, telephone: true, email: true } }),
    prisma.contrat.findMany({ select: { numero: true } }),
  ])

  const distributeurMap = new Map(existingDistributeurs.map((d) => [d.nom.toLowerCase(), d.id]))
  const produitMap = new Map(existingProduits.map((p) => [p.nom.toLowerCase(), p.id]))
  const statutMap = new Map(existingStatuts.map((s) => [s.nom.toLowerCase(), s.id]))
  const clientMap = new Map<string, string>()
  for (const c of existingClients) {
    if (c.telephone) clientMap.set(normalizeDedupKey(c.nom, c.prenom, normalizePhone(c.telephone)), c.id)
    if (c.email) clientMap.set(normalizeDedupKey(c.nom, c.prenom, c.email), c.id)
  }
  const numeroSet = new Set(existingNumeros.map((c) => c.numero))

  const newDistributeurs: { id: string; type: 'DISTRIBUTEUR'; nom: string }[] = []
  const newProduits: { id: string; type: 'PRODUIT'; nom: string }[] = []
  const newStatuts: { id: string; type: 'STATUT_CONTRAT'; nom: string; couleur: string }[] = []
  const newClients: {
    id: string
    nom: string | null
    prenom: string | null
    telephone: string | null
    email: string | null
    numeroPermis: string | null
    paysPermis: string | null
    ville: string | null
    codePostal: string | null
    adresse: string | null
    dateNaissance: Date | null
  }[] = []
  const newContrats: Record<string, unknown>[] = []

  function getOrCreateRef(
    map: Map<string, string>,
    list: { id: string; nom: string }[],
    type: 'DISTRIBUTEUR' | 'PRODUIT' | 'STATUT_CONTRAT',
    nom: string,
    couleur?: string,
  ) {
    const key = nom.toLowerCase()
    const existing = map.get(key)
    if (existing) return existing
    const id = randomUUID()
    map.set(key, id)
    list.push({ id, type, nom, ...(couleur ? { couleur } : {}) } as never)
    return id
  }

  let clientsCrees = 0
  let contratsCrees = 0
  let ligne = 1

  for (const rawRow of dataRows) {
    ligne += 1
    try {
      const row = mapRow(rawRow, mapping)

      if (!row.numeroContrat) {
        errors.push({ line: ligne, reason: 'N° Contrat manquant' })
        continue
      }
      if (row.primeTtc === null) {
        errors.push({ line: ligne, reason: 'Prime TTC manquante ou invalide' })
        continue
      }
      if (numeroSet.has(row.numeroContrat)) {
        doublonsIgnores += 1
        continue
      }
      numeroSet.add(row.numeroContrat)

      // --- Client (dédoublonnage Nom + Prénom + Téléphone/Email, §12.1) ---
      const phoneKey = normalizeDedupKey(row.nom, row.prenom, normalizePhone(row.telephone))
      const emailKey = row.email ? normalizeDedupKey(row.nom, row.prenom, row.email) : null
      let clientId = clientMap.get(phoneKey) ?? (emailKey ? clientMap.get(emailKey) : undefined)

      if (!clientId) {
        clientId = randomUUID()
        newClients.push({
          id: clientId,
          nom: row.nom,
          prenom: row.prenom,
          telephone: row.telephone,
          email: row.email,
          numeroPermis: row.numeroPermis,
          paysPermis: row.paysPermis,
          ville: row.ville,
          codePostal: row.codePostal,
          adresse: row.adresse,
          dateNaissance: row.dateNaissance,
        })
        clientMap.set(phoneKey, clientId)
        if (emailKey) clientMap.set(emailKey, clientId)
        clientsCrees += 1
      }

      // --- Distributeur ---
      const distributeurId = row.distributeur
        ? getOrCreateRef(distributeurMap, newDistributeurs, 'DISTRIBUTEUR', row.distributeur)
        : null

      // --- Produit (avec heuristique de démêlage §12.1) ---
      const { produitNom, marque, modele } = inferProduit(row)
      const produitId = getOrCreateRef(produitMap, newProduits, 'PRODUIT', produitNom)

      // --- Statut par défaut : Actif, sauf mention ERREUR détectée ---
      const hasErreur = [row.numeroContrat, row.numeroDemande].some((v) => v?.toUpperCase().includes('ERREUR'))
      const statutNom = hasErreur ? 'Erreur / À corriger' : 'Actif'
      const statutId = getOrCreateRef(statutMap, newStatuts, 'STATUT_CONTRAT', statutNom, hasErreur ? 'red' : 'emerald')

      const dateDebut = row.effet ?? row.dateDemande ?? new Date()
      const dateFin = row.dureeJours ? addDays(dateDebut, row.dureeJours) : addDays(dateDebut, 365)

      newContrats.push({
        id: randomUUID(),
        numero: row.numeroContrat,
        numeroDemande: row.numeroDemande,
        clientId,
        distributeurId,
        produitId,
        statutRefId: statutId,
        typeAssurance: produitNom.toLowerCase().includes('sant') ? 'sante' : 'auto',
        compagnie: row.distributeur ?? '',
        statut: hasErreur ? 'ERREUR' : 'ACTIF',
        marque: produitNom === CATEGORISER_LABEL ? null : marque,
        modele: produitNom === CATEGORISER_LABEL ? null : modele,
        immatriculation: row.immatriculation,
        dateDebut,
        dateFin,
        dateSouscription: row.dateDemande,
        dateEffet: row.effet,
        dureeJours: row.dureeJours,
        prime: row.primeTtc,
        honoraires: row.honoraires ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      contratsCrees += 1
    } catch (err) {
      errors.push({ line: ligne, reason: err instanceof Error ? err.message : 'Erreur inconnue' })
    }
  }

  // --- Écriture en base, par lots ---
  const allNewRefs = [...newDistributeurs, ...newProduits, ...newStatuts]
  for (let i = 0; i < allNewRefs.length; i += CHUNK_SIZE) {
    await prisma.listeReference.createMany({ data: allNewRefs.slice(i, i + CHUNK_SIZE), skipDuplicates: true })
  }
  for (let i = 0; i < newClients.length; i += CHUNK_SIZE) {
    await prisma.client.createMany({ data: newClients.slice(i, i + CHUNK_SIZE), skipDuplicates: true })
  }
  for (let i = 0; i < newContrats.length; i += CHUNK_SIZE) {
    await prisma.contrat.createMany({ data: newContrats.slice(i, i + CHUNK_SIZE) as Prisma.ContratCreateManyInput[], skipDuplicates: true })
  }

  const importLog = await prisma.importLog.create({
    data: {
      nomFichier: file.name,
      totalLignes: dataRows.length,
      clientsCrees,
      contratsCrees,
      doublonsIgnores,
      erreurs: errors.length,
      details: { errors: errors.slice(0, 100) },
      createdById: token.id as string,
    },
  })

  return NextResponse.json({
    id: importLog.id,
    totalLignes: dataRows.length,
    clientsCrees,
    contratsCrees,
    doublonsIgnores,
    erreurs: errors.length,
    errorSample: errors.slice(0, 20),
  })
}
