-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "unmatched_emails" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "from_domain" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "snippet" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "assigned_client_id" TEXT,

    CONSTRAINT "unmatched_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_approvals" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "approved" INTEGER NOT NULL DEFAULT 0,
    "rejected" INTEGER NOT NULL DEFAULT 0,
    "auto_add" BOOLEAN NOT NULL DEFAULT false,
    "client_id" TEXT,

    CONSTRAINT "domain_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unmatched_emails_message_id_key" ON "unmatched_emails"("message_id");

-- CreateIndex
CREATE INDEX "unmatched_emails_workspace_id_idx" ON "unmatched_emails"("workspace_id");

-- CreateIndex
CREATE INDEX "unmatched_emails_from_domain_idx" ON "unmatched_emails"("from_domain");

-- CreateIndex
CREATE UNIQUE INDEX "domain_approvals_workspace_id_domain_key" ON "domain_approvals"("workspace_id", "domain");

-- AddForeignKey
ALTER TABLE "unmatched_emails" ADD CONSTRAINT "unmatched_emails_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unmatched_emails" ADD CONSTRAINT "unmatched_emails_assigned_client_id_fkey" FOREIGN KEY ("assigned_client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_approvals" ADD CONSTRAINT "domain_approvals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_approvals" ADD CONSTRAINT "domain_approvals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
