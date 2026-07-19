import type { Client, Contrat, Devis, ListeReference } from '@prisma/client'
import { sendEmail } from './email'
import { DEVIS_PIPELINE_LABELS } from './labels'

const NOTIFY_TO = process.env.NOTIFICATION_EMAIL || 'louaymezlini16@gmail.com'
const GOLD = '#C9A84C'
const INK = '#0a0a0a'

type ClientLite = Pick<
  Client,
  'nom' | 'prenom' | 'civilite' | 'email' | 'telephone' | 'adresse' | 'codePostal' | 'ville'
>

function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return 'Non renseignée'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return 'Non renseignée'
  return d.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
}

function fmtMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Non estimé'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

function actorLabel(actorKind: 'user' | 'partner'): string {
  return actorKind === 'partner' ? 'Site partenaire TempAssur' : 'CRM WN Conseil (création manuelle)'
}

function clientName(client: ClientLite): string {
  const parts = [client.civilite, client.prenom, client.nom].filter(Boolean)
  return parts.length ? parts.join(' ') : 'Client sans nom'
}

interface Section {
  heading: string
  rows: [string, string][]
}

function renderSections(sections: Section[]): string {
  return sections
    .map(
      (section) => `
        <tr>
          <td style="padding:24px 32px 8px 32px;">
            <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${GOLD};">${esc(section.heading)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 8px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              ${section.rows
                .map(
                  ([label, value], i) => `
                <tr style="background:${i % 2 === 0 ? '#fafafa' : '#ffffff'};">
                  <td style="padding:9px 12px;font-size:13px;color:#6b7280;width:38%;border-bottom:1px solid #f0f0f0;">${esc(label)}</td>
                  <td style="padding:9px 12px;font-size:13px;color:#111111;font-weight:600;border-bottom:1px solid #f0f0f0;">${esc(value)}</td>
                </tr>`
                )
                .join('')}
            </table>
          </td>
        </tr>`
    )
    .join('')
}

function emailShell(opts: { badge: string; title: string; sections: Section[]; note?: string }): string {
  return `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:${INK};padding:28px 32px;">
              <p style="margin:0;font-size:12px;letter-spacing:.14em;color:${GOLD};font-weight:700;text-transform:uppercase;">WN Conseil</p>
              <p style="margin:6px 0 0 0;font-size:20px;color:#ffffff;font-weight:700;">${esc(opts.title)}</p>
              <span style="display:inline-block;margin-top:10px;padding:4px 10px;border-radius:999px;background:rgba(201,168,76,0.15);color:${GOLD};font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;">${esc(opts.badge)}</span>
            </td>
          </tr>
          ${renderSections(opts.sections)}
          <tr>
            <td style="padding:24px 32px 32px 32px;">
              ${opts.note ? `<p style="margin:0 0 12px 0;font-size:12px;color:#9ca3af;">${esc(opts.note)}</p>` : ''}
              <a href="${esc(process.env.FRONTEND_ORIGIN || '')}" style="display:inline-block;padding:10px 20px;border-radius:8px;background:${GOLD};color:${INK};font-size:13px;font-weight:700;text-decoration:none;">Ouvrir le CRM</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#fafafa;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">Notification automatique — WN Conseil CRM.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

type DevisWithRelations = Devis & { client: ClientLite; distributeur?: ListeReference | null; produit?: ListeReference | null }

export async function notifyNewDevis(devis: DevisWithRelations, actorKind: 'user' | 'partner'): Promise<void> {
  try {
    const html = emailShell({
      badge: 'Nouveau devis',
      title: `Devis ${clientName(devis.client)}`,
      sections: [
        {
          heading: 'Client',
          rows: [
            ['Nom', clientName(devis.client)],
            ['Email', devis.client.email || 'Non renseigné'],
            ['Téléphone', devis.client.telephone || 'Non renseigné'],
            ['Adresse', [devis.client.adresse, devis.client.codePostal, devis.client.ville].filter(Boolean).join(', ') || 'Non renseignée'],
          ],
        },
        {
          heading: 'Devis',
          rows: [
            ['Référence', devis.id],
            ['Statut', DEVIS_PIPELINE_LABELS[devis.statutPipeline] ?? devis.statutPipeline],
            ['Montant estimé', fmtMoney(devis.montantEstime)],
            ['Produit', devis.produit?.nom ?? 'Non spécifié'],
            ['Distributeur', devis.distributeur?.nom ?? 'Non spécifié'],
            ['Créé le', fmtDate(devis.dateCreation)],
            ['Origine', actorLabel(actorKind)],
          ],
        },
        ...(devis.besoinsExprimes
          ? [{ heading: 'Détails exprimés', rows: [['Besoins', devis.besoinsExprimes] as [string, string]] }]
          : []),
      ],
      note: 'Ce devis n’est pas encore un contrat — il devient un contrat lors du paiement ou de sa transformation manuelle.',
    })

    await sendEmail({ to: NOTIFY_TO, subject: `Nouveau devis — ${clientName(devis.client)}`, html, type: 'NEW_DEVIS' })
    console.log('[notify] new-devis email sent for', devis.id)
  } catch (err) {
    console.error('[notify] failed to send new-devis email', err)
  }
}

type ContratWithRelations = Contrat & { client: ClientLite; distributeur?: ListeReference | null; produitRef?: ListeReference | null }

export async function notifyNewContrat(
  contrat: ContratWithRelations,
  actorKind: 'user' | 'partner',
  opts?: { fromDevisId?: string }
): Promise<void> {
  try {
    const html = emailShell({
      badge: 'Nouveau contrat',
      title: `Contrat ${contrat.numero}`,
      sections: [
        {
          heading: 'Client',
          rows: [
            ['Nom', clientName(contrat.client)],
            ['Email', contrat.client.email || 'Non renseigné'],
            ['Téléphone', contrat.client.telephone || 'Non renseigné'],
            ['Adresse', [contrat.client.adresse, contrat.client.codePostal, contrat.client.ville].filter(Boolean).join(', ') || 'Non renseignée'],
          ],
        },
        {
          heading: 'Contrat',
          rows: [
            ['Numéro', contrat.numero],
            ['Prime', fmtMoney(contrat.prime)],
            ['Honoraires', fmtMoney(contrat.honoraires)],
            ['Date d’effet', fmtDate(contrat.dateEffet)],
            ['Date de fin', fmtDate(contrat.dateFin)],
            ['Durée', contrat.dureeJours ? `${contrat.dureeJours} jours` : 'Non renseignée'],
            ['Produit', contrat.produitRef?.nom ?? 'Non spécifié'],
            ['Distributeur', contrat.distributeur?.nom ?? 'Non spécifié'],
            ['Origine', actorLabel(actorKind)],
            ...(opts?.fromDevisId ? ([['Issu du devis', opts.fromDevisId]] as [string, string][]) : []),
          ],
        },
        ...(contrat.marque || contrat.modele || contrat.immatriculation
          ? [
              {
                heading: 'Véhicule',
                rows: [
                  ['Marque', contrat.marque || 'Non renseignée'],
                  ['Modèle', contrat.modele || 'Non renseigné'],
                  ['Immatriculation', contrat.immatriculation || 'Non renseignée'],
                ] as [string, string][],
              },
            ]
          : []),
      ],
    })

    await sendEmail({ to: NOTIFY_TO, subject: `Nouveau contrat — ${contrat.numero}`, html, type: 'NEW_CONTRAT' })
    console.log('[notify] new-contrat email sent for', contrat.id)
  } catch (err) {
    console.error('[notify] failed to send new-contrat email', err)
  }
}
