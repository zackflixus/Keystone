-- Records who created a task, so rule actions like ASSIGN_TO "taskCreator"
-- have something to resolve. Nullable and unbackfilled on purpose — existing
-- tasks have no recorded creator and there's no reliable way to reconstruct
-- one; only tasks created from here on will have it set.

ALTER TABLE "Task" ADD COLUMN "createdById" TEXT;
