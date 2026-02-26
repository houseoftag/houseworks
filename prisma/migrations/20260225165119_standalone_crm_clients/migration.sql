/*
  Warnings:

  - You are about to drop the column `item_id` on the `contacts` table. All the data in the column will be lost.
  - You are about to drop the column `item_id` on the `crm_timeline_entries` table. All the data in the column will be lost.
  - You are about to drop the column `item_id` on the `deals` table. All the data in the column will be lost.
  - You are about to drop the `crm_profiles` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `client_id` to the `contacts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `client_id` to the `crm_timeline_entries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `client_id` to the `deals` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_item_id_fkey";

-- DropForeignKey
ALTER TABLE "crm_profiles" DROP CONSTRAINT "crm_profiles_item_id_fkey";

-- DropForeignKey
ALTER TABLE "crm_timeline_entries" DROP CONSTRAINT "crm_timeline_entries_item_id_fkey";

-- DropForeignKey
ALTER TABLE "deals" DROP CONSTRAINT "deals_item_id_fkey";

-- DropIndex
DROP INDEX "contacts_item_id_idx";

-- DropIndex
DROP INDEX "crm_timeline_entries_item_id_idx";

-- DropIndex
DROP INDEX "deals_item_id_idx";

-- AlterTable
ALTER TABLE "contacts" DROP COLUMN "item_id",
ADD COLUMN     "client_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "crm_timeline_entries" DROP COLUMN "item_id",
ADD COLUMN     "client_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "deals" DROP COLUMN "item_id",
ADD COLUMN     "client_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "crm_profiles";

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "tier" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clients_workspace_id_idx" ON "clients"("workspace_id");

-- CreateIndex
CREATE INDEX "contacts_client_id_idx" ON "contacts"("client_id");

-- CreateIndex
CREATE INDEX "crm_timeline_entries_client_id_idx" ON "crm_timeline_entries"("client_id");

-- CreateIndex
CREATE INDEX "deals_client_id_idx" ON "deals"("client_id");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_timeline_entries" ADD CONSTRAINT "crm_timeline_entries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
