import ruleService from './ruleService.js';
import { successResponse, createdResponse } from '../../core/utils/apiResponse.js';

export const ruleController = {
  async getSchema(req, res) {
    const { workspaceId, projectId } = req.query;
    const schema = await ruleService.getSchema(req.user.id, { workspaceId, projectId: projectId || null });
    return successResponse(res, schema);
  },

  async listTemplates(req, res) {
    return successResponse(res, ruleService.listTemplates());
  },

  async applyTemplate(req, res) {
    const { workspaceId, projectId, params, name } = req.validatedBody;
    const rule = await ruleService.applyTemplate(req.params.key, req.user.id, {
      workspaceId, projectId: projectId || null, params, name
    });
    return createdResponse(res, rule, 'Rule created from template');
  },

  async list(req, res) {
    const { workspaceId, projectId } = req.query;
    const rules = await ruleService.list(req.user.id, { workspaceId, projectId: projectId || null });
    return successResponse(res, rules);
  },

  async create(req, res) {
    const rule = await ruleService.create(req.user.id, req.validatedBody);
    return createdResponse(res, rule, 'Rule created');
  },

  async getById(req, res) {
    const rule = await ruleService.getById(req.params.id, req.user.id);
    return successResponse(res, rule);
  },

  async update(req, res) {
    const rule = await ruleService.update(req.params.id, req.user.id, req.validatedBody);
    return successResponse(res, rule, 'Rule updated');
  },

  async remove(req, res) {
    await ruleService.remove(req.params.id, req.user.id);
    return successResponse(res, null, 'Rule deleted');
  },

  async dryRun(req, res) {
    const { taskId } = req.validatedBody;
    const result = await ruleService.dryRun(req.params.id, req.user.id, taskId);
    return successResponse(res, result);
  },

  async getRuns(req, res) {
    const { cursor, limit } = req.query;
    const data = await ruleService.getRuns(req.params.id, req.user.id, {
      cursor: cursor || null,
      limit: limit ? parseInt(limit, 10) : 30
    });
    return successResponse(res, data);
  }
};

export default ruleController;
