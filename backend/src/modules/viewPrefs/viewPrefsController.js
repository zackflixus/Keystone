import { viewPrefsService } from './viewPrefsService.js';

export const viewPrefsController = {
  async get(req, res, next) {
    try {
      const prefs = await viewPrefsService.get(req.user.id, req.params.projectId);
      res.json(prefs);
    } catch (err) {
      next(err);
    }
  },

  async upsert(req, res, next) {
    try {
      const result = await viewPrefsService.upsert(req.user.id, req.params.projectId, {
        colWidths: req.body.colWidths,
        columnVisibility: req.body.columnVisibility,
        dashboardWidgets: req.body.dashboardWidgets,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
