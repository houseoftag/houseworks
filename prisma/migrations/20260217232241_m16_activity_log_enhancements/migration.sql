-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('WORKSPACE', 'BOARD', 'ITEM', 'COLUMN', 'GROUP', 'ATTACHMENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'ITEM_MOVED';
ALTER TYPE "ActivityType" ADD VALUE 'BOARD_DUPLICATED';
ALTER TYPE "ActivityType" ADD VALUE 'ATTACHMENT_ADDED';
ALTER TYPE "ActivityType" ADD VALUE 'ATTACHMENT_DELETED';

-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN     "entity_id" TEXT,
ADD COLUMN     "entity_type" "EntityType";
