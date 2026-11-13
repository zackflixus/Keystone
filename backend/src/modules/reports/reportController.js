// Report controller
import reportService, { isWorkspaceAdmin } from './reportService.js';
import prisma from '../../core/database/prisma.js';
import { successResponse, ApiError } from '../../core/utils/apiResponse.js';

async function assertCanManageRecipients(workspaceId, userId) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
    include: { customRole: { select: { permissions: true } } },
  });
  if (!membership) throw ApiError.forbidden('You are not a member of this workspace');

  const hasPermission = isWorkspaceAdmin(membership.role) ||
    !!membership.customRole?.permissions?.['report.manageRecipients'];
  if (!hasPermission) throw ApiError.forbidden('You do not have permission to manage report recipients');
}

function parseFilters(input) {
  return {
    period: input.period || undefined,
    startDate: input.startDate || undefined,
    endDate: input.endDate || undefined,
    projectIds: input.projectIds
      ? (Array.isArray(input.projectIds) ? input.projectIds : String(input.projectIds).split(',').filter(Boolean))
      : undefined,
    userIds: input.userIds
      ? (Array.isArray(input.userIds) ? input.userIds : String(input.userIds).split(',').filter(Boolean))
      : undefined,
    groupBy: input.groupBy || undefined,
    scope: input.scope || undefined,
    billable: input.billable !== undefined && input.billable !== null && input.billable !== ''
      ? input.billable === 'true' || input.billable === true
      : undefined,
  };
}

export const reportController = {
  async getMyTimesheet(req, res) {
    const { workspaceId } = req.params;
    const filters = parseFilters(req.query);
    const data = await reportService.getMyTimesheet(req.user.id, workspaceId, filters);
    return successResponse(res, data);
  },

  async getTeamReport(req, res) {
    const { workspaceId } = req.params;
    const filters = parseFilters(req.query);
    const data = await reportService.getTeamReport(workspaceId, req.user.id, filters);
    return successResponse(res, data);
  },

  async getReportSummary(req, res) {
    const { workspaceId } = req.params;
    const filters = parseFilters(req.query);
    const data = await reportService.getReportSummary(workspaceId, req.user.id, filters);
    return successResponse(res, data);
  },

  async exportReport(req, res) {
    const { workspaceId } = req.params;
    const filters = parseFilters(req.query);
    const format = req.query.format || 'xlsx';
    const data = await reportService.exportReport(workspaceId, req.user.id, filters, format);
    const today = new Date().toISOString().split('T')[0];

    if (format === 'xlsx') {
      const filename = `work-report-${today}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', data.byteLength);
      return res.end(Buffer.from(data));
    }

    if (format === 'csv') {
      const filename = `work-report-${today}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      // Prepend BOM so Excel opens UTF-8 correctly
      return res.send('\uFEFF' + data);
    }

    return successResponse(res, data);
  },

  async emailReport(req, res) {
    const { workspaceId } = req.params;
    const recipients = req.body.recipients || [];
    const filters = parseFilters(req.body);
    const options = { message: req.body.message || '' };
    const result = await reportService.emailReport(workspaceId, req.user.id, filters, recipients, options);
    return successResponse(res, result);
  },

  // ── Saved report recipients — private per-user, gated by OWNER/ADMIN or the
  // report.manageRecipients custom-role permission ────────────────────────
  async getRecipients(req, res) {
    const { workspaceId } = req.params;
    await assertCanManageRecipients(workspaceId, req.user.id);

    const recipients = await prisma.reportRecipient.findMany({
      where: { workspaceId, userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { addedBy: { select: { id: true, name: true } } },
    });
    return successResponse(res, recipients);
  },

  async addRecipient(req, res) {
    const { workspaceId } = req.params;
    await assertCanManageRecipients(workspaceId, req.user.id);

    const { email, name } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw ApiError.badRequest('Valid email is required');
    }

    // Check if already exists in this user's own saved list
    const existing = await prisma.reportRecipient.findUnique({
      where: { email_workspaceId_userId: { email: email.toLowerCase().trim(), workspaceId, userId: req.user.id } },
    });
    if (existing) throw ApiError.conflict('This email is already added');

    const recipient = await prisma.reportRecipient.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        workspaceId,
        userId: req.user.id,
        addedById: req.user.id,
      },
      include: { addedBy: { select: { id: true, name: true } } },
    });
    return successResponse(res, recipient, 'Recipient added');
  },

  async deleteRecipient(req, res) {
    const { recipientId } = req.params;
    const recipient = await prisma.reportRecipient.findUnique({ where: { id: recipientId } });
    if (!recipient) throw ApiError.notFound('Recipient not found');

    await assertCanManageRecipients(recipient.workspaceId, req.user.id);
    if (recipient.userId !== req.user.id) {
      throw ApiError.forbidden('You can only remove your own saved recipients');
    }

    await prisma.reportRecipient.delete({ where: { id: recipientId } });
    return successResponse(res, null, 'Recipient removed');
  },
};

export default reportController;
