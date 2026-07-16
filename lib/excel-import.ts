// Logique partagée d'import du fichier Excel maître (§12/§13 du cahier des charges).
// Colonnes attendues : Distributeur, Nom, Prénom, Date naissance, Téléphone, Email,
// N° Permis, Pays permis, Ville, CP, Adresse, Date demande, N° Demande, N° Contrat,
// Marque, Modèle, Immatriculation, Effet, Durée (j), Prime TTC (€), Honoraires (€)

export type ImportFieldKey =
  | 'distributeur'
  | 'nom'
  | 'prenom'
  | 'dateNaissance'
  | 'telephone'
  | 'email'
  | 'numeroPermis'
  | 'paysPermis'
  | 'ville'
  | 'codePostal'
  | 'adresse'
  | 'dateDemande'
  | 'numeroDemande'
  | 'numeroContrat'
  | 'marque'
  | 'modele'
  | 'immatriculation'
  | 'effet'
  | 'dureeJours'
  | 'primeTtc'
  | 'honoraires'
  | 'ignore'

export const IMPORT_FIELD_LABELS: Record<ImportFieldKey, string> = {
  distributeur: 'Distributeur',
  nom: 'Nom',
  prenom: 'Prénom',
  dateNaissance: 'Date de naissance',
  telephone: 'Téléphone',
  email: 'Email',
  numeroPermis: 'N° Permis',
  paysPermis: 'Pays permis',
  ville: 'Ville',
  codePostal: 'Code postal',
  adresse: 'Adresse',
  dateDemande: 'Date demande',
  numeroDemande: 'N° Demande',
  numeroContrat: 'N° Contrat',
  marque: 'Marque',
  modele: 'Modèle',
  immatriculation: 'Immatriculation',
  effet: 'Date d\'effet',
  dureeJours: 'Durée (jours)',
  primeTtc: 'Prime TTC',
  honoraires: 'Honoraires',
  ignore: 'Ignorer cette colonne',
}

const ALIASES: Record<ImportFieldKey, string[]> = {
  distributeur: ['distributeur'],
  nom: ['nom'],
  prenom: ['prenom', 'prnom'],
  dateNaissance: ['date naissance', 'datenaissance', 'ne le', 'naissance'],
  telephone: ['telephone', 'tel', 'tlphone', 'portable'],
  email: ['email', 'mail', 'e mail'],
  numeroPermis: ['n permis', 'numero permis', 'permis'],
  paysPermis: ['pays permis'],
  ville: ['ville'],
  codePostal: ['cp', 'code postal'],
  adresse: ['adresse'],
  dateDemande: ['date demande'],
  numeroDemande: ['n demande', 'numero demande'],
  numeroContrat: ['n contrat', 'numero contrat'],
  marque: ['marque'],
  modele: ['modele', 'modle'],
  immatriculation: ['immatriculation', 'immat'],
  effet: ['effet', 'date effet'],
  dureeJours: ['duree j', 'duree', 'duree jours'],
  primeTtc: ['prime ttc', 'prime'],
  honoraires: ['honoraires'],
  ignore: [],
}

export function normalizeHeader(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents
    .replace(/[°()€$#'’]/g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

export function guessMapping(headers: string[]): Record<number, ImportFieldKey> {
  const mapping: Record<number, ImportFieldKey> = {}
  const used = new Set<ImportFieldKey>()

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header)
    let bestField: ImportFieldKey | null = null

    for (const field of Object.keys(ALIASES) as ImportFieldKey[]) {
      if (used.has(field)) continue
      if (ALIASES[field].some((alias) => normalized === alias || normalized.includes(alias))) {
        bestField = field
        break
      }
    }

    mapping[index] = bestField ?? 'ignore'
    if (bestField) used.add(bestField)
  })

  return mapping
}

const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30)).getTime()

export function parseFlexibleDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date && !isNaN(value.getTime())) return value

  if (typeof value === 'number') {
    // Numéro de série Excel
    const ms = EXCEL_EPOCH + value * 86400000
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d
  }

  const str = String(value).trim()
  if (!str) return null

  // DD-MM-YYYY or DD/MM/YYYY [HH:MM[:SS]]
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (dmy) {
    const [, d, m, y, h = '0', mi = '0', s = '0'] = dmy
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(mi), Number(s))
    return isNaN(date.getTime()) ? null : date
  }

  // YYYY-MM-DD [HH:MM[:SS]]
  const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (ymd) {
    const [, y, m, d, h = '0', mi = '0', s = '0'] = ymd
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(mi), Number(s))
    return isNaN(date.getTime()) ? null : date
  }

  const fallback = new Date(str)
  return isNaN(fallback.getTime()) ? null : fallback
}

export function parseFlexibleNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return isNaN(value) ? null : value
  const cleaned = String(value).replace(/[^\d,.-]/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

export function normalizeDedupKey(...parts: (string | null | undefined)[]) {
  return parts
    .map((p) => (p ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' '))
    .join('|')
}

export function normalizePhone(phone: string | null | undefined) {
  if (!phone) return ''
  return phone.replace(/[^\d]/g, '')
}

export interface ParsedRow {
  distributeur: string | null
  nom: string | null
  prenom: string | null
  dateNaissance: Date | null
  telephone: string | null
  email: string | null
  numeroPermis: string | null
  paysPermis: string | null
  ville: string | null
  codePostal: string | null
  adresse: string | null
  dateDemande: Date | null
  numeroDemande: string | null
  numeroContrat: string | null
  marque: string | null
  modele: string | null
  immatriculation: string | null
  effet: Date | null
  dureeJours: number | null
  primeTtc: number | null
  honoraires: number | null
}

export function mapRow(rawRow: unknown[], mapping: Record<number, ImportFieldKey>): ParsedRow {
  const out: Record<string, unknown> = {}
  rawRow.forEach((cell, index) => {
    const field = mapping[index]
    if (!field || field === 'ignore') return
    out[field] = cell
  })

  const str = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v).trim())

  return {
    distributeur: str(out.distributeur),
    nom: str(out.nom)?.toUpperCase() ?? null,
    prenom: str(out.prenom)?.toUpperCase() ?? null,
    dateNaissance: parseFlexibleDate(out.dateNaissance),
    telephone: str(out.telephone),
    email: str(out.email)?.toLowerCase() ?? null,
    numeroPermis: str(out.numeroPermis),
    paysPermis: str(out.paysPermis),
    ville: str(out.ville),
    codePostal: str(out.codePostal),
    adresse: str(out.adresse),
    dateDemande: parseFlexibleDate(out.dateDemande),
    numeroDemande: str(out.numeroDemande),
    numeroContrat: str(out.numeroContrat),
    marque: str(out.marque),
    modele: str(out.modele),
    immatriculation: str(out.immatriculation),
    effet: parseFlexibleDate(out.effet),
    dureeJours: parseFlexibleNumber(out.dureeJours),
    primeTtc: parseFlexibleNumber(out.primeTtc),
    honoraires: parseFlexibleNumber(out.honoraires),
  }
}

export const CATEGORISER_LABEL = 'À catégoriser'

/**
 * Certaines lignes (ex: distributeur April) stockent en réalité le nom du
 * produit dans la colonne "Modèle" avec "Distributeur" comme valeur de
 * "Marque" plutôt qu'un vrai véhicule. On tente de démêler proprement,
 * sinon la ligne est taguée "À catégoriser" pour révision manuelle (§12.1).
 */
export function inferProduit(row: ParsedRow): {
  produitNom: string
  isVehicule: boolean
  marque: string | null
  modele: string | null
} {
  const marqueLower = row.marque?.toLowerCase() ?? ''

  if (marqueLower === 'distributeur' && row.modele) {
    return { produitNom: row.modele, isVehicule: false, marque: null, modele: null }
  }

  if (row.marque && row.dureeJours !== null) {
    return { produitNom: 'Auto temporaire', isVehicule: true, marque: row.marque, modele: row.modele }
  }

  if (row.marque) {
    return { produitNom: 'Auto', isVehicule: true, marque: row.marque, modele: row.modele }
  }

  return { produitNom: CATEGORISER_LABEL, isVehicule: false, marque: row.marque, modele: row.modele }
}

export function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}
