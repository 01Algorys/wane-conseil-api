import nodemailer from 'nodemailer'
import { prisma } from './prisma'

const smtpPort = Number(process.env.SMTP_PORT ?? 587)

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendEmail(options: {
  to: string
  subject: string
  html: string
  text?: string
  type?: string
  attachments?: { filename: string; content: Buffer }[]
}) {
  const type = options.type ?? 'GENERIC'

  const log = await prisma.emailLog.create({
    data: { recipient: options.to, subject: options.subject, html: options.html, type, status: 'QUEUED' },
  })

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_FROM) {
    console.warn('[email] SMTP config incomplete; skipping send for', options.to)
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', error: 'SMTP config incomplete' },
    })
    return
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    })
    await prisma.emailLog.update({ where: { id: log.id }, data: { status: 'SENT', sentAt: new Date() } })
  } catch (error) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', error: error instanceof Error ? error.message : String(error) },
    })
    throw error
  }
}

export async function resendEmailLog(id: string): Promise<void> {
  const log = await prisma.emailLog.findUniqueOrThrow({ where: { id } })
  await sendEmail({ to: log.recipient, subject: log.subject, html: log.html, type: log.type })
}
