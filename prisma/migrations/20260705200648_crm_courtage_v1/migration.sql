/*
  Warnings:

  - The `statut` column on the `Contrat` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ListeReferenceType" AS ENUM ('DISTRIBUTEUR', 'PRODUIT', 'STATUT_CONTRAT', 'TYPE_DOCUMENT', 'CATEGORIE_DEPENSE');

-- CreateEnum
CREATE TYPE "DevisStatutPipeline" AS ENUM ('NOUVEAU', 'QUALIFIE', 'DEVIS_ENVOYE', 'RELANCE', 'NEGOCIATION', 'GAGNE', 'PERDU');

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'ANNULE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskType" ADD VALUE 'APPEL';
ALTER TYPE "TaskType" ADD VALUE 'RELANCE_DEVIS';
ALTER TYPE "TaskType" ADD VALUE 'DOCUMENT_A_RECEVOIR';
ALTER TYPE "TaskType" ADD VALUE 'RENOUVELLEMENT';
ALTER TYPE "TaskType" ADD VALUE 'RELANCE_AMIABLE';

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_userId_fkey";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "civilite" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "isVip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nom" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "numeroPermis" TEXT,
ADD COLUMN     "paysPermis" TEXT,
ADD COLUMN     "prenom" TEXT,
ADD COLUMN     "telephone" TEXT,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "pays" SET DEFAULT 'France';

-- AlterTable
ALTER TABLE "Contrat" ADD COLUMN     "agentAssigneId" TEXT,
ADD COLUMN     "besoinsExprimes" TEXT,
ADD COLUMN     "dateEffet" TIMESTAMP(3),
ADD COLUMN     "dateRappel" TIMESTAMP(3),
ADD COLUMN     "dateResiliation" TIMESTAMP(3),
ADD COLUMN     "dateSouscription" TIMESTAMP(3),
ADD COLUMN     "distributeurId" TEXT,
ADD COLUMN     "dureeJours" INTEGER,
ADD COLUMN     "honoraires" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "immatriculation" TEXT,
ADD COLUMN     "marque" TEXT,
ADD COLUMN     "modele" TEXT,
ADD COLUMN     "motifResiliation" TEXT,
ADD COLUMN     "notesInternes" TEXT,
ADD COLUMN     "numeroDemande" TEXT,
ADD COLUMN     "produitId" TEXT,
ADD COLUMN     "statutRefId" TEXT,
ALTER COLUMN "typeAssurance" SET DEFAULT 'auto',
ALTER COLUMN "compagnie" SET DEFAULT '',
DROP COLUMN "statut",
ADD COLUMN     "statut" TEXT NOT NULL DEFAULT 'ACTIF';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "dateExpiration" TIMESTAMP(3),
ADD COLUMN     "libelleAutre" TEXT,
ADD COLUMN     "motifRefus" TEXT,
ADD COLUMN     "statutDocument" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
ADD COLUMN     "typeDocumentId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "contratId" TEXT,
ADD COLUMN     "devisId" TEXT;

-- DropEnum
DROP TYPE "ContratStatus";

-- CreateTable
CREATE TABLE "ListeReference" (
    "id" TEXT NOT NULL,
    "type" "ListeReferenceType" NOT NULL,
    "nom" TEXT NOT NULL,
    "couleur" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devis" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "distributeurId" TEXT,
    "produitId" TEXT,
    "statutPipeline" "DevisStatutPipeline" NOT NULL DEFAULT 'NOUVEAU',
    "montantEstime" DOUBLE PRECISION,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateRelance" TIMESTAMP(3),
    "probabilite" INTEGER,
    "motifPerte" TEXT,
    "contratId" TEXT,
    "notes" TEXT,
    "besoinsExprimes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facture" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "numeroFacture" TEXT NOT NULL,
    "dateGeneration" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montantHt" DOUBLE PRECISION NOT NULL,
    "montantTtc" DOUBLE PRECISION NOT NULL,
    "fichierPdfUrl" TEXT NOT NULL,
    "statutEnvoi" TEXT NOT NULL DEFAULT 'NON_ENVOYEE',
    "dateEnvoi" TIMESTAMP(3),
    "modeEnvoi" TEXT,
    "emailDestinataire" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Facture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RendezVous" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "clientId" TEXT,
    "contratId" TEXT,
    "devisId" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "typeRdv" TEXT NOT NULL DEFAULT 'TELEPHONE',
    "lieu" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'PREVU',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RendezVous_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactureAchat" (
    "id" TEXT NOT NULL,
    "fournisseur" TEXT NOT NULL,
    "categorieId" TEXT,
    "dateFacture" TIMESTAMP(3) NOT NULL,
    "montantTtc" DOUBLE PRECISION NOT NULL,
    "fichierUrl" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "note" TEXT,
    "dateAjout" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactureAchat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reclamation" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "texte" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'OUVERTE',
    "dateResolution" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reclamation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatutHistorique" (
    "id" TEXT NOT NULL,
    "contratId" TEXT,
    "devisId" TEXT,
    "entityType" TEXT NOT NULL,
    "ancienStatut" TEXT,
    "nouveauStatut" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatutHistorique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "totalLignes" INTEGER NOT NULL,
    "clientsCrees" INTEGER NOT NULL DEFAULT 0,
    "contratsCrees" INTEGER NOT NULL DEFAULT 0,
    "doublonsIgnores" INTEGER NOT NULL DEFAULT 0,
    "erreurs" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListeReference_type_idx" ON "ListeReference"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ListeReference_type_nom_key" ON "ListeReference"("type", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "Devis_contratId_key" ON "Devis"("contratId");

-- CreateIndex
CREATE INDEX "Devis_statutPipeline_idx" ON "Devis"("statutPipeline");

-- CreateIndex
CREATE UNIQUE INDEX "Facture_numeroFacture_key" ON "Facture"("numeroFacture");

-- CreateIndex
CREATE INDEX "Facture_contratId_idx" ON "Facture"("contratId");

-- CreateIndex
CREATE INDEX "Facture_statutEnvoi_idx" ON "Facture"("statutEnvoi");

-- CreateIndex
CREATE INDEX "RendezVous_dateDebut_idx" ON "RendezVous"("dateDebut");

-- CreateIndex
CREATE INDEX "RendezVous_statut_idx" ON "RendezVous"("statut");

-- CreateIndex
CREATE INDEX "FactureAchat_dateFacture_idx" ON "FactureAchat"("dateFacture");

-- CreateIndex
CREATE INDEX "FactureAchat_categorieId_idx" ON "FactureAchat"("categorieId");

-- CreateIndex
CREATE INDEX "Client_nom_prenom_idx" ON "Client"("nom", "prenom");

-- CreateIndex
CREATE INDEX "Client_email_idx" ON "Client"("email");

-- CreateIndex
CREATE INDEX "Client_telephone_idx" ON "Client"("telephone");

-- CreateIndex
CREATE INDEX "Contrat_statut_idx" ON "Contrat"("statut");

-- CreateIndex
CREATE INDEX "Contrat_dateFin_idx" ON "Contrat"("dateFin");

-- CreateIndex
CREATE INDEX "Contrat_distributeurId_idx" ON "Contrat"("distributeurId");

-- CreateIndex
CREATE INDEX "Document_statutDocument_idx" ON "Document"("statutDocument");

-- CreateIndex
CREATE INDEX "Document_typeDocumentId_idx" ON "Document"("typeDocumentId");

-- CreateIndex
CREATE INDEX "Task_statut_idx" ON "Task"("statut");

-- CreateIndex
CREATE INDEX "Task_echeance_idx" ON "Task"("echeance");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_distributeurId_fkey" FOREIGN KEY ("distributeurId") REFERENCES "ListeReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "ListeReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_statutRefId_fkey" FOREIGN KEY ("statutRefId") REFERENCES "ListeReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_agentAssigneId_fkey" FOREIGN KEY ("agentAssigneId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_distributeurId_fkey" FOREIGN KEY ("distributeurId") REFERENCES "ListeReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "ListeReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_typeDocumentId_fkey" FOREIGN KEY ("typeDocumentId") REFERENCES "ListeReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "Devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "Devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureAchat" ADD CONSTRAINT "FactureAchat_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "ListeReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatutHistorique" ADD CONSTRAINT "StatutHistorique_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatutHistorique" ADD CONSTRAINT "StatutHistorique_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "Devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportLog" ADD CONSTRAINT "ImportLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
