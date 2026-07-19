// One-off, non-destructive script to create (or update the password of) a
// SUPER_ADMIN account. Unlike prisma/seed.ts this never deletes anything —
// safe to run against a database that already has real data.
//
// Usage: tsx scripts/create-admin.ts <email> <password> <firstName> <lastName>
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [email, password, firstName = 'Super', lastName = 'Admin'] = process.argv.slice(2)
  if (!email || !password) {
    console.error('Usage: tsx scripts/create-admin.ts <email> <password> [firstName] [lastName]')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }

  const hashed = await bcrypt.hash(password, 12)
  const normalizedEmail = email.trim().toLowerCase()

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: { password: hashed, role: 'SUPER_ADMIN' },
    create: {
      email: normalizedEmail,
      password: hashed,
      firstName,
      lastName,
      role: 'SUPER_ADMIN',
      consentAt: new Date(),
      adminProfile: { create: {} },
    },
  })

  console.log(`SUPER_ADMIN ready: ${user.email} (id: ${user.id})`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
