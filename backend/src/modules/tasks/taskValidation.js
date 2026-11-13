import { body, param, query } from 'express-validator';

// Keep these in sync with the TaskStatus / Priority / TaskType enums in prisma/schema.prisma
const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'NEXT_SPRINT', 'DONE', 'VERIFIED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];
const TASK_TYPES = ['DEFAULT_TASK', 'MILESTONE', 'APPROVAL'];

// Builds "Invalid status \"FOO\". Allowed values: TODO, IN_PROGRESS, ..." so the
// caller can see both what it sent and what it should have sent.
const enumMessage = (label, allowed) => (value) =>
  `Invalid ${label} "${value}". Allowed values: ${allowed.join(', ')}`;

export const createTaskValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Task title is required')
    .isLength({ min: 1, max: 400 })
    .withMessage('Title must be between 1 and 400 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  body('status')
    .optional()
    .isIn(TASK_STATUSES)
    .withMessage(enumMessage('status', TASK_STATUSES)),
  body('priority')
    .optional()
    .isIn(PRIORITIES)
    .withMessage(enumMessage('priority', PRIORITIES)),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid due date'),
  body('estimatedTime')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Estimated time must be a positive number (minutes)'),
  body('taskType')
    .optional()
    .isIn(TASK_TYPES)
    .withMessage(enumMessage('task type', TASK_TYPES)),
  body('parentId')
    .optional()
    .isUUID()
    .withMessage('Invalid parent task ID')
];

export const updateTaskValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 400 })
    .withMessage('Title must be between 1 and 400 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  body('status')
    .optional()
    .isIn(TASK_STATUSES)
    .withMessage(enumMessage('status', TASK_STATUSES)),
  body('priority')
    .optional()
    .isIn(PRIORITIES)
    .withMessage(enumMessage('priority', PRIORITIES)),
  body('dueDate')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('Invalid due date'),
  body('estimatedTime')
    .optional({ values: 'null' })
    .isInt({ min: 0 })
    .withMessage('Estimated time must be a positive number (minutes)'),
  body('taskType')
    .optional()
    .isIn(TASK_TYPES)
    .withMessage(enumMessage('task type', TASK_TYPES)),
  body('parentId')
    .optional()
    .isUUID()
    .withMessage('Invalid parent task ID')
];

// Duplicate — everything is optional. `title` defaults to "Duplicate of: <task title>"
// and `include` defaults are resolved in taskService.duplicate.
export const duplicateTaskValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 400 })
    .withMessage('Title must be between 1 and 400 characters'),
  body('include')
    .optional()
    .isObject()
    .withMessage('include must be an object of boolean flags')
    .custom((value) => {
      const allowed = [
        'description', 'assignees', 'subtasks', 'attachments', 'tags',
        'customFields', 'dueDate', 'estimatedTime', 'billable', 'parentTask'
      ];
      for (const [key, flag] of Object.entries(value)) {
        if (!allowed.includes(key)) throw new Error(`Unknown include option: ${key}`);
        if (typeof flag !== 'boolean') throw new Error(`include.${key} must be a boolean`);
      }
      return true;
    })
];

export const moveTaskValidation = [
  body('listId')
    .isUUID()
    .withMessage('Invalid list ID'),
  body('position')
    .optional({ values: 'undefined' })
    .isFloat()
    .withMessage('Position must be a number'),
  // parentId may be: a UUID string (becomes a subtask), null (becomes top-level), or omitted (no change)
  body('parentId')
    .custom((value) => {
      if (value === undefined || value === null) return true;
      if (typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)) return true;
      throw new Error('parentId must be a UUID string or null');
    })
];

export const assignUserValidation = [
  body('userId')
    .isUUID()
    .withMessage('Invalid user ID')
];

export const taskIdValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid task ID')
];

export const searchValidation = [
  query('q')
    .trim()
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
];

export default {
  createTaskValidation,
  updateTaskValidation,
  duplicateTaskValidation,
  moveTaskValidation,
  assignUserValidation,
  taskIdValidation,
  searchValidation
};
