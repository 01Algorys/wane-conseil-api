import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'
import { ListeReferenceType } from '@prisma/client'

async function requireAuth(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) {
    return null
  }
  return token
}

// GET /api/reference-lists?type=DISTRIBUTEUR[&search=abc]
export async function GET(req: Request) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as ListeReferenceType | null
  const search = searchParams.get('search') ?? undefined
  const includeInactive = searchParams.get('includeInactive') === 'true'

  if (!type || !Object.values(ListeReferenceType).includes(type)) {
    return NextResponse.json({ message: 'Paramètre type invalide.' }, { status: 422 })
  }

  const items = await prisma.listeReference.findMany({
    where: {
      type,
      actif: includeInactive ? undefined : true,
      nom: search ? { contains: search, mode: 'insensitive' } : undefined,
    },
    orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
  })

  return NextResponse.json(items)
}

const createSchema = z.object({
  type: z.nativeEnum(ListeReferenceType),
  nom: z.string().min(1),
  couleur: z.string().optional(),
})

// POST — "création à la volée" depuis un formulaire (§3.9)
export async function POST(req: Request) {
  const token = await requireAuth(req)
  if (!token) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Données invalides', errors: parsed.error.flatten() }, { status: 422 })
  }

  const { type, nom, couleur } = parsed.data

  const existing = await prisma.listeReference.findUnique({
    where: { type_nom: { type, nom } },
  })
  if (existing) {
    if (!existing.actif) {
      const reactivated = await prisma.listeReference.update({ where: { id: existing.id }, data: { actif: true } })
      return NextResponse.json(reactivated, { status: 200 })
    }
    return NextResponse.json(existing, { status: 200 })
  }

  const created = await prisma.listeReference.create({
    data: { type, nom, couleur },
  })

  return NextResponse.json(created, { status: 201 })
}
