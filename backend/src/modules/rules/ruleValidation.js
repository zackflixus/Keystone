import { body, param, query } from 'express-validator';

export const ruleIdValidation = [
  param('id').isUUID().withMessage('Invalid rule ID')
];

export const schemaQueryValidation = [
  query('workspaceId').isUUID().withMessage('workspaceId is required'),
  query('projectId').optional().isUUID().withMessage('Invalid project ID')
];

export const listRulesValidation = [
  query('workspaceId').isUUID().withMessage('workspaceId is required'),
  query('projectId').optional().isUUID().withMessage('Invalid project ID')
];

// trigger/conditions/actions are validated for shape against the registry
// inside ruleService (ruleRegistry.js is the source of truth) — express-
// validator only checks that the right JSON shapes were sent at all.
export const createRuleValidation = [
  body('name')
    .trim().notEmpty().withMessage('Rule name is required')
    .isLength({ min: 1, max: 120 }).withMessage('Name must be 1–120 characters'),
  body('description').optional({ values: 'null' }).trim().isLength({ max: 500 }),
  body('workspaceId').isUUID().withMessage('workspaceId is required'),
  body('projectId').optional({ values: 'null' }).isUUID().withMessage('Invalid project ID'),
  body('enabled').optional().isBoolean(),
  body('trigger').isObject().withMessage('trigger is required'),
  body('trigger.type').notEmpty().withMessage('trigger.type is required'),
  body('conditions').optional().isObject(),
  body('actions').isArray({ min: 1 }).withMessage('At least one action is required'),
  body('actions.*.type').notEmpty().withMessage('Every action needs a type')
];

export const updateRuleValidation = [
  body('name').optional().trim().isLength({ min: 1, max: 120 }).withMessage('Name must be 1–120 characters'),
  body('description').optional({ values: 'null' }).trim().isLength({ max: 500 }),
  body('enabled').optional().isBoolean(),
  body('trigger').optional().isObject(),
  body('trigger.type').if(body('trigger').exists()).notEmpty().withMessage('trigger.type is required'),
  body('conditions').optional().isObject(),
  body('actions').optional().isArray({ min: 1 }).withMessage('At least one action is required')
];

export const dryRunValidation = [
  body('taskId').isUUID().withMessage('taskId is required')
];

export const applyTemplateValidation = [
  param('key').notEmpty().withMessage('Template key is required'),
  body('workspaceId').isUUID().withMessage('workspaceId is required'),
  body('projectId').optional({ values: 'null' }).isUUID().withMessage('Invalid project ID'),
  body('params').optional().isObject()
];

export const runsQueryValidation = [
  param('id').isUUID().withMessage('Invalid rule ID'),
  query('cursor').optional().isISO8601().withMessage('Invalid cursor'),
  query('limit').optional().isInt({ min: 1, max: 100 })
];
