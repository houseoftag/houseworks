-- AlterTable
ALTER TABLE "items" ADD COLUMN     "next_due_date" TIMESTAMP(3),
ADD COLUMN     "recurrence" JSONB;

-- CreateIndex
CREATE INDEX "items_next_due_date_idx" ON "items"("next_due_date");
