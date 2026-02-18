-- CreateTable
CREATE TABLE "board_templates" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "column_config" JSONB NOT NULL,
    "group_config" JSONB NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "board_templates_workspace_id_idx" ON "board_templates"("workspace_id");

-- AddForeignKey
ALTER TABLE "board_templates" ADD CONSTRAINT "board_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_templates" ADD CONSTRAINT "board_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
