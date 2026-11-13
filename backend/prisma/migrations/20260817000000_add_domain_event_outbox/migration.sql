-- Rules engine: transactional outbox.
--
-- Rows are written in the same transaction as the change that caused them, then
-- drained onto the BullMQ queue by src/modules/rules/outbox.js.
--
-- No foreign keys to Task or Project on purpose: an event must survive the
-- deletion of whatever it describes, so identifiers live inside `payload`.

-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- Drives the publisher's "oldest unpublished first" scan.
-- CreateIndex
CREATE INDEX "DomainEvent_publishedAt_createdAt_idx" ON "DomainEvent"("publishedAt", "createdAt");

-- CreateIndex
CREATE INDEX "DomainEvent_workspaceId_type_idx" ON "DomainEvent"("workspaceId", "type");
