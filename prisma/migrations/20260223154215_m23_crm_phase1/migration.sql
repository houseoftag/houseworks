-- CreateEnum
CREATE TYPE "BoardType" AS ENUM ('STANDARD', 'CRM');

-- CreateEnum
CREATE TYPE "CrmEntryType" AS ENUM ('NOTE', 'DOCUMENT', 'DELIVERABLE', 'EMAIL_IN', 'EMAIL_OUT', 'INVOICE', 'MEETING', 'CALL');

-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('GMAIL', 'OUTLOOK');

-- AlterTable
ALTER TABLE "boards" ADD COLUMN     "board_type" "BoardType" NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE "crm_profiles" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "company" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "tier" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_timeline_entries" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "type" "CrmEntryType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" TEXT,
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_timeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_integrations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "provider" "EmailProvider" NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "email" TEXT NOT NULL,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_profiles_item_id_key" ON "crm_profiles"("item_id");

-- CreateIndex
CREATE INDEX "crm_timeline_entries_item_id_idx" ON "crm_timeline_entries"("item_id");

-- CreateIndex
CREATE INDEX "crm_timeline_entries_created_at_idx" ON "crm_timeline_entries"("created_at");

-- CreateIndex
CREATE INDEX "email_integrations_workspace_id_idx" ON "email_integrations"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_integrations_workspace_id_email_key" ON "email_integrations"("workspace_id", "email");

-- AddForeignKey
ALTER TABLE "crm_profiles" ADD CONSTRAINT "crm_profiles_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_timeline_entries" ADD CONSTRAINT "crm_timeline_entries_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_timeline_entries" ADD CONSTRAINT "crm_timeline_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_integrations" ADD CONSTRAINT "email_integrations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
