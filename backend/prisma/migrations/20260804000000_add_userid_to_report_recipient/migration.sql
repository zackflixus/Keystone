-- Scope ReportRecipient (saved report recipients) per-user instead of shared per-workspace.
-- Backfill userId from addedById so existing rows keep working, owned by whoever added them.

ALTER TABLE "ReportRecipient" ADD COLUMN IF NOT EXISTS "userId" TEXT;

UPDATE "ReportRecipient" SET "userId" = "addedById" WHERE "userId" IS NULL;

ALTER TABLE "ReportRecipient" ALTER COLUMN "userId" SET NOT NULL;

DROP INDEX IF EXISTS "ReportRecipient_email_workspaceId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "ReportRecipient_email_workspaceId_userId_key"
  ON "ReportRecipient"("email", "workspaceId", "userId");

CREATE INDEX IF NOT EXISTS "ReportRecipient_userId_idx" ON "ReportRecipient"("userId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReportRecipient_userId_fkey'
  ) THEN
    ALTER TABLE "ReportRecipient"
      ADD CONSTRAINT "ReportRecipient_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
