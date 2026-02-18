/*
  Warnings:

  - Added the required column `workspace_id` to the `activity_logs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'ITEM_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'ITEM_DELETED';
ALTER TYPE "ActivityType" ADD VALUE 'BOARD_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'BOARD_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'BOARD_DELETED';
ALTER TYPE "ActivityType" ADD VALUE 'MEMBER_ADDED';
ALTER TYPE "ActivityType" ADD VALUE 'MEMBER_REMOVED';
ALTER TYPE "ActivityType" ADD VALUE 'AUTOMATION_TRIGGERED';

-- DropForeignKey
ALTER TABLE "activity_logs" DROP CONSTRAINT "activity_logs_item_id_fkey";

-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN     "board_id" TEXT,
ADD COLUMN     "workspace_id" TEXT NOT NULL,
ALTER COLUMN "item_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "activity_logs_workspace_id_idx" ON "activity_logs"("workspace_id");

-- CreateIndex
CREATE INDEX "activity_logs_board_id_idx" ON "activity_logs"("board_id");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
