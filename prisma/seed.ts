import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.statutHistorique.deleteMany()
  await prisma.reclamation.deleteMany()
  await prisma.rendezVous.deleteMany()
  await prisma.facture.deleteMany()
  await prisma.factureAchat.deleteMany()
  await prisma.devis.deleteMany()
  await prisma.importLog.deleteMany()
  await prisma.activityLog.deleteMany()
  await prisma.task.deleteMany()
  await prisma.contrat.deleteMany()
  await prisma.lead.deleteMany()
  await prisma.document.deleteMany()
  await prisma.client.deleteMany()
  await prisma.admin.deleteMany()
  await prisma.user.deleteMany()
  await prisma.listeReference.deleteMany()

  // --- Référentiels de base (§3.7, §3.8, §3.9, §4, §7.1, §11.2) ---
  await prisma.listeReference.createMany({
    data: [
      { type: 'DISTRIBUTEUR', nom: '+simple', ordre: 0 },
      { type: 'DISTRIBUTEUR', nom: 'April', ordre: 1 },
      { type: 'DISTRIBUTEUR', nom: 'JL Assur', ordre: 2 },

      { type: 'PRODUIT', nom: 'Auto temporaire', ordre: 0 },
      { type: 'PRODUIT', nom: 'Auto Bonus', ordre: 1 },
      { type: 'PRODUIT', nom: 'Poids-Lourds', ordre: 2 },
      { type: 'PRODUIT', nom: 'VTC', ordre: 3 },
      { type: 'PRODUIT', nom: 'Mrp Commerce', ordre: 4 },
      { type: 'PRODUIT', nom: 'À catégoriser', ordre: 99 },

      { type: 'STATUT_CONTRAT', nom: 'Actif', couleur: 'emerald', ordre: 0 },
      { type: 'STATUT_CONTRAT', nom: 'En attente de pièces', couleur: 'amber', ordre: 1 },
      { type: 'STATUT_CONTRAT', nom: 'En attente paiement', couleur: 'amber', ordre: 2 },
      { type: 'STATUT_CONTRAT', nom: 'Résilié', couleur: 'gray', ordre: 3 },
      { type: 'STATUT_CONTRAT', nom: 'Résilié non paiement', couleur: 'red', ordre: 4 },
      { type: 'STATUT_CONTRAT', nom: 'Expiré', couleur: 'gray', ordre: 5 },
      { type: 'STATUT_CONTRAT', nom: 'Erreur / À corriger', couleur: 'red', ordre: 6 },

      { type: 'TYPE_DOCUMENT', nom: 'Permis de conduire', ordre: 0 },
      { type: 'TYPE_DOCUMENT', nom: 'Carte grise', ordre: 1 },
      { type: 'TYPE_DOCUMENT', nom: "Pièce d'identité", ordre: 2 },
      { type: 'TYPE_DOCUMENT', nom: 'Justificatif de domicile', ordre: 3 },
      { type: 'TYPE_DOCUMENT', nom: "Relevé d'information", ordre: 4 },
      { type: 'TYPE_DOCUMENT', nom: 'Autre', ordre: 5 },

      { type: 'CATEGORIE_DEPENSE', nom: 'Logiciel/Abonnement', ordre: 0 },
      { type: 'CATEGORIE_DEPENSE', nom: 'Fournitures', ordre: 1 },
      { type: 'CATEGORIE_DEPENSE', nom: 'Téléphonie', ordre: 2 },
      { type: 'CATEGORIE_DEPENSE', nom: 'Déplacement', ordre: 3 },
      { type: 'CATEGORIE_DEPENSE', nom: 'Autre', ordre: 4 },
    ],
  })

  const superAdminPassword = await bcrypt.hash('Admin123!', 12)
  const commercialPassword = await bcrypt.hash('Commercial123!', 12)
  const clientPassword = await bcrypt.hash('Client123!', 12)

  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@wnconseil.fr',
      password: superAdminPassword,
      firstName: 'William',
      lastName: 'Nguyen',
      role: 'SUPER_ADMIN',
      phone: '0123456789',
      consentAt: new Date(),
      adminProfile: { create: {} },
    },
  })

  const commercial = await prisma.user.create({
    data: {
      email: 'commercial@wnconseil.fr',
      password: commercialPassword,
      firstName: 'Marie',
      lastName: 'Dupont',
      role: 'COMMERCIAL',
      phone: '0123456790',
      consentAt: new Date(),
      adminProfile: { create: {} },
    },
  })

  const clientUser = await prisma.user.create({
    data: {
      email: 'client@wnconseil.fr',
      password: clientPassword,
      firstName: 'Sophie',
      lastName: 'Laurent',
      role: 'CLIENT',
      phone: '0123456791',
      consentAt: new Date(),
      clientProfile: {
        create: {
          type: 'PARTICULIER',
          dateNaissance: new Date('1985-03-14'),
          nationalite: 'Française',
          adresse: '12 Rue de la Paix',
          ville: 'Paris',
          pays: 'France',
          codePostal: '75002',
        },
      },
    },
    include: { clientProfile: true },
  })

  const clientProUser = await prisma.user.create({
    data: {
      email: 'pro@wnconseil.fr',
      password: await bcrypt.hash('Pro123456!', 12),
      firstName: 'Alexandre',
      lastName: 'Martin',
      role: 'CLIENT',
      phone: '0123456792',
      consentAt: new Date(),
      clientProfile: {
        create: {
          type: 'PROFESSIONNEL',
          raisonSociale: 'Martin Conseil SARL',
          siret: '12345678900011',
          secteurActivite: 'Conseil en gestion',
          adresse: '45 Avenue des Champs-Élysées',
          ville: 'Paris',
          pays: 'France',
          codePostal: '75008',
        },
      },
    },
    include: { clientProfile: true },
  })

  const clientProParticulier = await prisma.user.create({
    data: {
      email: 'particulier@wnconseil.fr',
      password: await bcrypt.hash('Part123456!', 12),
      firstName: 'Julien',
      lastName: 'Durand',
      role: 'CLIENT',
      phone: '0123456793',
      consentAt: new Date(),
      clientProfile: {
        create: {
          type: 'PARTICULIER',
          dateNaissance: new Date('1990-06-25'),
          nationalite: 'Française',
          adresse: '7 Rue Montmartre',
          ville: 'Paris',
          pays: 'France',
          codePostal: '75001',
          societe: {
            connect: { id: clientProUser.clientProfile!.id },
          },
        },
      },
    },
    include: { clientProfile: true },
  })

  const leadOne = await prisma.lead.create({
    data: {
      firstName: 'Léa',
      lastName: 'Moreau',
      email: 'lea.moreau@example.com',
      phone: '0678901234',
      typeAssurance: 'auto',
      compagnie: 'Premium Auto',
      statut: 'NOUVEAU',
      ville: 'Lyon',
      pays: 'France',
      nationalite: 'Française',
      formData: { marque: 'Porsche', modele: '911 Carrera', annee: 2022 },
      createdBy: { connect: { id: superAdmin.id } },
      assignedTo: { connect: { id: commercial.id } },
      consentAt: new Date(),
    },
  })

  const leadTwo = await prisma.lead.create({
    data: {
      firstName: 'Nicolas',
      lastName: 'Roux',
      email: 'nicolas.roux@example.com',
      phone: '0687654321',
      typeAssurance: 'habitation',
      compagnie: 'Habitat Luxe',
      statut: 'EN_COURS',
      ville: 'Bordeaux',
      pays: 'France',
      formData: { type_logement: 'Villa', superficie: 250 },
      createdBy: { connect: { id: commercial.id } },
      assignedTo: { connect: { id: commercial.id } },
      consentAt: new Date(),
    },
  })

  const leadThree = await prisma.lead.create({
    data: {
      firstName: 'Claire',
      lastName: 'Bernard',
      email: 'claire.bernard@example.com',
      phone: '0676543210',
      typeAssurance: 'sante',
      statut: 'DEVIS_ENVOYE',
      ville: 'Marseille',
      pays: 'France',
      formData: { regime: 'Sécurité Sociale', couverture: 'Premium' },
      createdBy: { connect: { id: superAdmin.id } },
      assignedTo: { connect: { id: commercial.id } },
      consentAt: new Date(),
    },
  })

  const leadFour = await prisma.lead.create({
    data: {
      firstName: 'David',
      lastName: 'Petit',
      email: 'david.petit@example.com',
      phone: '0673210987',
      typeAssurance: 'rc-pro',
      statut: 'PERDU',
      ville: 'Nice',
      pays: 'France',
      formData: { activite: 'Architecte', chiffreAffaires: 320000 },
      createdBy: { connect: { id: commercial.id } },
      consentAt: new Date(),
    },
  })

  const leadFive = await prisma.lead.create({
    data: {
      firstName: 'Emma',
      lastName: 'Lemoine',
      email: 'emma.lemoine@example.com',
      phone: '0674321098',
      typeAssurance: 'prevoyance',
      statut: 'CONTRAT_SIGNE',
      ville: 'Toulouse',
      pays: 'France',
      formData: { profession: 'Consultante', capital: 400000 },
      createdBy: { connect: { id: superAdmin.id } },
      assignedTo: { connect: { id: commercial.id } },
      consentAt: new Date(),
    },
  })

  await prisma.task.createMany({
    data: [
      {
        type: 'RELANCE_DOCUMENT',
        titre: 'Relancer document auto',
        description: 'Demander certificat de non-gage et relevé d’informations',
        statut: 'A_TRAITER',
        priorite: 'HAUTE',
        echeance: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        assignedToId: commercial.id,
        leadId: leadOne.id,
      },
      {
        type: 'MODIFICATION_CONTRAT',
        titre: 'Vérifier dossier habitation',
        statut: 'EN_COURS',
        priorite: 'NORMALE',
        assignedToId: commercial.id,
        leadId: leadTwo.id,
      },
      {
        type: 'SINISTRE',
        titre: 'Suivi dossier santé',
        statut: 'TRAITE',
        priorite: 'BASSE',
        assignedToId: commercial.id,
        leadId: leadThree.id,
      },
      {
        type: 'RECLAMATION',
        titre: 'Traiter réclamation RC Pro',
        statut: 'A_TRAITER',
        priorite: 'URGENTE',
        echeance: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        assignedToId: commercial.id,
        leadId: leadFour.id,
      },
    ],
  })

  await prisma.contrat.create({
    data: {
      numero: 'WN-2026-0001',
      typeAssurance: 'auto',
      compagnie: 'Premium Auto',
      dateDebut: new Date('2026-06-01'),
      dateFin: new Date('2027-06-01'),
      prime: 6200,
      statut: 'ACTIF',
      clientId: clientUser.clientProfile!.id,
      leadId: leadOne.id,
    },
  })

  await prisma.contrat.create({
    data: {
      numero: 'WN-2026-0002',
      typeAssurance: 'habitation',
      compagnie: 'Habitat Luxe',
      dateDebut: new Date('2026-01-15'),
      dateFin: new Date('2027-01-15'),
      prime: 4200,
      statut: 'ACTIF',
      clientId: clientProUser.clientProfile!.id,
      leadId: leadTwo.id,
    },
  })

  console.log('Seed data created: super admin, commercial, clients, leads, tasks, contrats.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
