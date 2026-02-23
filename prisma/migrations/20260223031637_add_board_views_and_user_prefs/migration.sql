-- AlterTable
ALTER TABLE "items" ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "board_views" (
    "id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "sort" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_board_prefs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "columnWidths" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_board_prefs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "board_views_board_id_idx" ON "board_views"("board_id");

-- CreateIndex
CREATE INDEX "user_board_prefs_user_id_idx" ON "user_board_prefs"("user_id");

-- CreateIndex
CREATE INDEX "user_board_prefs_board_id_idx" ON "user_board_prefs"("board_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_board_prefs_user_id_board_id_key" ON "user_board_prefs"("user_id", "board_id");

-- AddForeignKey
ALTER TABLE "board_views" ADD CONSTRAINT "board_views_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_board_prefs" ADD CONSTRAINT "user_board_prefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_board_prefs" ADD CONSTRAINT "user_board_prefs_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
