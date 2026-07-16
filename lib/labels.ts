export const DEVIS_PIPELINE_LABELS: Record<string, string> = {
  NOUVEAU: 'Nouveau / À traiter',
  QUALIFIE: 'Qualifié',
  DEVIS_ENVOYE: 'Devis envoyé',
  RELANCE: 'Relance',
  NEGOCIATION: 'Négociation',
  GAGNE: 'Gagné / Transformé',
  PERDU: 'Perdu',
}

export const DEVIS_PIPELINE_ORDER = ['NOUVEAU', 'QUALIFIE', 'DEVIS_ENVOYE', 'RELANCE', 'NEGOCIATION', 'GAGNE', 'PERDU']

export const DEVIS_PIPELINE_COLORS: Record<string, string> = {
  NOUVEAU: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  QUALIFIE: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  DEVIS_ENVOYE: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  RELANCE: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  NEGOCIATION: 'text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/20',
  GAGNE: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  PERDU: 'text-red-400 bg-red-400/10 border-red-400/20',
}

export const TASK_TYPE_LABELS: Record<string, string> = {
  APPEL: 'Appel',
  RELANCE_DEVIS: 'Relance devis',
  DOCUMENT_A_RECEVOIR: 'Document à recevoir',
  RENOUVELLEMENT: 'Renouvellement',
  RECLAMATION: 'Réclamation',
  RELANCE_AMIABLE: 'Relance amiable',
  REMBOURSEMENT: 'Remboursement',
  AVENANT: 'Avenant',
  MODIFICATION_CONTRAT: 'Modification contrat',
  RELANCE_DOCUMENT: 'Relance document',
  SINISTRE: 'Sinistre',
  AUTRE: 'Autre',
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  A_TRAITER: 'À faire',
  EN_COURS: 'En cours',
  TRAITE: 'Terminée',
  ANNULE: 'Annulée',
}

export const TASK_STATUS_COLORS: Record<string, string> = {
  A_TRAITER: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  EN_COURS: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  TRAITE: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  ANNULE: 'text-gray-400 bg-gray-900 border-gray-700',
}

export const PRIORITE_LABELS: Record<string, string> = {
  BASSE: 'Basse',
  NORMALE: 'Normale',
  HAUTE: 'Haute',
  URGENTE: 'Urgente',
}

export const PRIORITE_COLORS: Record<string, string> = {
  BASSE: 'text-gray-400 bg-gray-900 border-gray-700',
  NORMALE: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  HAUTE: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  URGENTE: 'text-red-400 bg-red-400/10 border-red-400/20',
}

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  MANQUANT: 'Manquant',
  EN_ATTENTE: 'En attente de validation',
  VALIDE: 'Validé',
  REFUSE: 'Refusé',
}

export const DOCUMENT_STATUS_COLORS: Record<string, string> = {
  MANQUANT: 'text-red-400 bg-red-400/10 border-red-400/20',
  EN_ATTENTE: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  VALIDE: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  REFUSE: 'text-gray-400 bg-gray-900 border-gray-700',
}

export const RDV_TYPE_LABELS: Record<string, string> = {
  TELEPHONE: 'Téléphone',
  VISIO: 'Visio',
  PRESENTIEL: 'Présentiel',
}

export const RDV_STATUS_LABELS: Record<string, string> = {
  PREVU: 'Prévu',
  CONFIRME: 'Confirmé',
  REALISE: 'Réalisé',
  ANNULE: 'Annulé',
  REPORTE: 'Reporté',
}

export const RDV_STATUS_COLORS: Record<string, string> = {
  PREVU: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  CONFIRME: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  REALISE: 'text-gray-400 bg-gray-900 border-gray-700',
  ANNULE: 'text-red-400 bg-red-400/10 border-red-400/20',
  REPORTE: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
}

export const FACTURE_ENVOI_LABELS: Record<string, string> = {
  NON_ENVOYEE: 'Non envoyée',
  ENVOYEE: 'Envoyée',
  ERREUR: "Erreur d'envoi",
}

export const RECLAMATION_STATUS_LABELS: Record<string, string> = {
  OUVERTE: 'Ouverte',
  EN_COURS: 'En cours',
  RESOLUE: 'Résolue',
}

export const RECLAMATION_STATUS_COLORS: Record<string, string> = {
  OUVERTE: 'text-red-400 bg-red-400/10 border-red-400/20',
  EN_COURS: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  RESOLUE: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
}

export function currencyFmt(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}
