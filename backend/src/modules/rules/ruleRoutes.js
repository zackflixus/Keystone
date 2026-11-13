import express from 'express';
import ruleController from './ruleController.js';
import { authenticate } from '../../core/middlewares/authMiddleware.js';
import { asyncHandler } from '../../core/middlewares/asyncHandler.js';
import { validate } from '../../core/middlewares/validate.js';
import {
  ruleIdValidation,
  schemaQueryValidation,
  listRulesValidation,
  createRuleValidation,
  updateRuleValidation,
  dryRunValidation,
  applyTemplateValidation,
  runsQueryValidation
} from './ruleValidation.js';

const router = express.Router();

// Static-path routes must be registered before the "/:id" routes below —
// Express would otherwise match "/schema" and "/templates" as an :id value.
router.get('/schema', authenticate, validate(schemaQueryValidation), asyncHandler(ruleController.getSchema));
router.get('/templates', authenticate, asyncHandler(ruleController.listTemplates));
router.post('/templates/:key/apply', authenticate, validate(applyTemplateValidation), asyncHandler(ruleController.applyTemplate));

router.get('/', authenticate, validate(listRulesValidation), asyncHandler(ruleController.list));
router.post('/', authenticate, validate(createRuleValidation), asyncHandler(ruleController.create));

router.get('/:id', authenticate, validate(ruleIdValidation), asyncHandler(ruleController.getById));
router.patch('/:id', authenticate, validate(ruleIdValidation), validate(updateRuleValidation), asyncHandler(ruleController.update));
router.delete('/:id', authenticate, validate(ruleIdValidation), asyncHandler(ruleController.remove));

router.post('/:id/dry-run', authenticate, validate(ruleIdValidation), validate(dryRunValidation), asyncHandler(ruleController.dryRun));
router.get('/:id/runs', authenticate, validate(runsQueryValidation), asyncHandler(ruleController.getRuns));

export default router;
