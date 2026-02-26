-- CreateTable
CREATE TABLE "quickbooks_integrations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quickbooks_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quickbooks_integrations_workspace_id_key" ON "quickbooks_integrations"("workspace_id");

-- AddForeignKey
ALTER TABLE "quickbooks_integrations" ADD CONSTRAINT "quickbooks_integrations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
