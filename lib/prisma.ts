import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

const isNewClient = !global.prisma
export const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

if (isNewClient) {
  prisma
    .$connect()
    .then(() => console.log('[prisma] database connected'))
    .catch((error) => console.error('[prisma] database connection failed', error))
}
