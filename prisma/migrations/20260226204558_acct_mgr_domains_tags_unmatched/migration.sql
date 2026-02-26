-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "unmatched_emails" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "message_id" TEXT,
    "from_email" TEXT NOT NULL,
    "from_name" TEXT,
    "from_domain" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_preview" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assigned_to_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unmatched_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unmatched_emails_thread_id_key" ON "unmatched_emails"("thread_id");

-- CreateIndex
CREATE INDEX "unmatched_emails_workspace_id_idx" ON "unmatched_emails"("workspace_id");

-- CreateIndex
CREATE INDEX "unmatched_emails_from_domain_idx" ON "unmatched_emails"("from_domain");

-- AddForeignKey
ALTER TABLE "unmatched_emails" ADD CONSTRAINT "unmatched_emails_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unmatched_emails" ADD CONSTRAINT "unmatched_emails_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
