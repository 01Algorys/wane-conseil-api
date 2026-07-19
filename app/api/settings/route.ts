import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/audit'

const SETTING_KEYS = ['general', 'email', 'security'] as const
type SettingKey = (typeof SETTING_KEYS)[number]

async function requireSuperAdmin(req: Request) {
  const actor = await getActor(req)
  if (!actor || actor.kind !== 'user' || actor.role !== 'SUPER_ADMIN') return null
  return actor
}

export async function GET(req: Request) {
  const actor = await requireSuperAdmin(req)
  if (!actor) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const rows = await prisma.appSetting.findMany({ where: { key: { in: [...SETTING_KEYS] } } })
  const result: Record<string, unknown> = {}
  for (const row of rows) result[row.key] = row.value
  return NextResponse.json(result)
}

const patchSchema = z.object({
  key: z.enum(SETTING_KEYS),
  value: z.record(z.string(), z.unknown()),
})

export async function PATCH(req: Request) {
  const actor = await requireSuperAdmin(req)
  if (!actor) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Données invalides', errors: parsed.error.flatten() }, { status: 422 })
  }

  const key: SettingKey = parsed.data.key
  const value = parsed.data.value as Prisma.InputJsonValue
  const row = await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })

  void logActivity({ userId: actor.id as string, action: 'SETTINGS_UPDATED', details: key, req })

  return NextResponse.json({ key: row.key, value: row.value })
}
