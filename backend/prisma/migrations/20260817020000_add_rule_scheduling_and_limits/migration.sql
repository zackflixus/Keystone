-- Phase 5: scheduled (due-date) triggers and auto-disable on repeated failure.
-- See modules/rules/dueDateScheduler.js and modules/rules/ruleEngine.js.
--
-- Per-workspace rate limiting (also Phase 5) is a Redis counter with no schema
-- footprint — a throttled action is silently retried a few seconds later
-- rather than recorded as a distinct RuleRun outcome, so it doesn't need a
-- RuleRunStatus value here.

ALTER TABLE "Rule" ADD COLUMN "consecutiveFailCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Rule" ADD COLUMN "autoDisabledAt" TIMESTAMP(3);
