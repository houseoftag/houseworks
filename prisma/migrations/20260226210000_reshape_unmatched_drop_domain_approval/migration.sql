-- DropForeignKey
ALTER TABLE "domain_approvals" DROP CONSTRAINT "domain_approvals_client_id_fkey";

-- DropForeignKey
ALTER TABLE "domain_approvals" DROP CONSTRAINT "domain_approvals_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "unmatched_emails" DROP CONSTRAINT "unmatched_emails_assigned_client_id_fkey";

-- DropIndex
DROP INDEX "unmatched_emails_message_id_key";

-- AlterTable
ALTER TABLE "unmatched_emails" DROP COLUMN "assigned_client_id",
DROP COLUMN "from",
DROP COLUMN "resolved_at",
DROP COLUMN "snippet",
DROP COLUMN "to",
ADD COLUMN     "assigned_to_id" TEXT,
ADD COLUMN     "body_preview" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "from_email" TEXT NOT NULL,
ADD COLUMN     "from_name" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "thread_id" TEXT NOT NULL,
ALTER COLUMN "message_id" DROP NOT NULL,
ALTER COLUMN "received_at" DROP DEFAULT;

-- DropTable
DROP TABLE "domain_approvals";

-- CreateIndex
CREATE UNIQUE INDEX "unmatched_emails_thread_id_key" ON "unmatched_emails"("thread_id");

-- AddForeignKey
ALTER TABLE "unmatched_emails" ADD CONSTRAINT "unmatched_emails_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
