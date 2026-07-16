import { NextResponse } from 'next/server'
import { getActor } from '@/lib/request-actor'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const token = await getActor(req)
  if (!token || !['SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'].includes(token.role as string)) {
    return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 })
  }

  const tasks = await prisma.task.findMany({
    include: {
      lead: true,
      assignedTo: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(tasks)
}
