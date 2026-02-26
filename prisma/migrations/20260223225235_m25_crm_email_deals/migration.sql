-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('LEAD', 'CONTACTED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- AlterTable
ALTER TABLE "crm_profiles" ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "stage" "DealStage" NOT NULL DEFAULT 'LEAD',
    "probability" INTEGER,
    "closed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deals_item_id_idx" ON "deals"("item_id");

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
