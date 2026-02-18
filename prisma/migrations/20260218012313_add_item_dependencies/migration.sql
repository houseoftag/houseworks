-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('BLOCKS', 'BLOCKED_BY', 'RELATES_TO', 'DUPLICATES');

-- CreateTable
CREATE TABLE "item_dependencies" (
    "id" TEXT NOT NULL,
    "source_item_id" TEXT NOT NULL,
    "target_item_id" TEXT NOT NULL,
    "type" "DependencyType" NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_dependencies_source_item_id_idx" ON "item_dependencies"("source_item_id");

-- CreateIndex
CREATE INDEX "item_dependencies_target_item_id_idx" ON "item_dependencies"("target_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_dependencies_source_item_id_target_item_id_type_key" ON "item_dependencies"("source_item_id", "target_item_id", "type");

-- AddForeignKey
ALTER TABLE "item_dependencies" ADD CONSTRAINT "item_dependencies_source_item_id_fkey" FOREIGN KEY ("source_item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_dependencies" ADD CONSTRAINT "item_dependencies_target_item_id_fkey" FOREIGN KEY ("target_item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_dependencies" ADD CONSTRAINT "item_dependencies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
