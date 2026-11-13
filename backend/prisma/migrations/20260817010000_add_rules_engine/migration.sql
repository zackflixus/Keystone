-- Rules engine: Rule + RuleRun.
--
-- See modules/rules/ruleRegistry.js for what trigger/conditions/actions JSON
-- shapes mean, and modules/rules/ruleEngine.js for how RuleRun rows and the
-- (ruleId, eventId) unique constraint are used as an idempotency + loop guard.

-- CreateEnum
CREATE TYPE "RuleRunStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED_CONDITION', 'SKIPPED_DEPTH', 'SKIPPED_CHAIN');

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "trigger" JSONB NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "templateKey" TEXT,
    "createdById" TEXT NOT NULL,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleRun" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "taskId" TEXT,
    "status" "RuleRunStatus" NOT NULL,
    "actionResults" JSONB,
    "error" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rule_workspaceId_enabled_idx" ON "Rule"("workspaceId", "enabled");

-- CreateIndex
CREATE INDEX "Rule_projectId_enabled_idx" ON "Rule"("projectId", "enabled");

-- CreateIndex
CREATE INDEX "RuleRun_ruleId_createdAt_idx" ON "RuleRun"("ruleId", "createdAt");

-- CreateIndex
CREATE INDEX "RuleRun_ruleId_chainId_idx" ON "RuleRun"("ruleId", "chainId");

-- Idempotency guard: a BullMQ retry re-delivering the same event to the same
-- rule cannot create a second row here, so applyRule() can tell a genuine
-- retry apart from a first run by catching this constraint's violation.
-- CreateIndex
CREATE UNIQUE INDEX "RuleRun_ruleId_eventId_key" ON "RuleRun"("ruleId", "eventId");

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleRun" ADD CONSTRAINT "RuleRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
