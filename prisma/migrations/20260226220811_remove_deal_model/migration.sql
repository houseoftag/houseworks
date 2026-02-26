/*
  Warnings:

  - You are about to drop the `deals` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "deals" DROP CONSTRAINT "deals_client_id_fkey";

-- DropTable
DROP TABLE "deals";

-- DropEnum
DROP TYPE "DealStage";
