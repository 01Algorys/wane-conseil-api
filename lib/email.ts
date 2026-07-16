import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
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
  attachments?: { filename: string; content: Buffer }[]
}) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_FROM) {
    console.warn('[email] SMTP config incomplete; skipping send for', options.to)
    return
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments,
  })
}
