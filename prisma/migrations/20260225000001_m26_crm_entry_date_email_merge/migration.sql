-- AlterEnum: replace EMAIL_IN/EMAIL_OUT with EMAIL, mapping existing rows
BEGIN;
CREATE TYPE "CrmEntryType_new" AS ENUM ('NOTE', 'DOCUMENT', 'DELIVERABLE', 'EMAIL', 'INVOICE', 'MEETING', 'CALL');
ALTER TABLE "crm_timeline_entries"
  ALTER COLUMN "type" TYPE "CrmEntryType_new"
  USING (
    CASE "type"::text
      WHEN 'EMAIL_IN' THEN 'EMAIL'
      WHEN 'EMAIL_OUT' THEN 'EMAIL'
      ELSE "type"::text
    END
  )::"CrmEntryType_new";
ALTER TYPE "CrmEntryType" RENAME TO "CrmEntryType_old";
ALTER TYPE "CrmEntryType_new" RENAME TO "CrmEntryType";
DROP TYPE "CrmEntryType_old";
COMMIT;

-- AlterTable: add entryDate and entryTime columns
ALTER TABLE "crm_timeline_entries" ADD COLUMN "entry_date" TEXT,
ADD COLUMN "entry_time" TEXT;
