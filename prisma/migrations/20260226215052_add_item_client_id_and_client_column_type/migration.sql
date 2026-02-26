-- AlterEnum
ALTER TYPE "ColumnType" ADD VALUE 'CLIENT';

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "client_id" TEXT;

-- CreateIndex
CREATE INDEX "items_client_id_idx" ON "items"("client_id");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
