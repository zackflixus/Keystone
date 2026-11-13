import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ── Thunks ──────────────────────────────────────────────────────────────────

export const fetchRuleSchema = createAsyncThunk(
  'rule/fetchSchema',
  async ({ workspaceId, projectId }, { rejectWithValue }) => {
    try {
      const res = await api.get('/api/v1/rules/schema', { params: { workspaceId, projectId: projectId || undefined } });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load rule schema');
    }
  }
);

export const fetchRuleTemplates = createAsyncThunk(
  'rule/fetchTemplates',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/api/v1/rules/templates');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load templates');
    }
  }
);

export const fetchRules = createAsyncThunk(
  'rule/fetchRules',
  async ({ workspaceId, projectId }, { rejectWithValue }) => {
    try {
      const res = await api.get('/api/v1/rules', { params: { workspaceId, projectId: projectId || undefined } });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load rules');
    }
  }
);

export const createRule = createAsyncThunk(
  'rule/createRule',
  async (data, { rejectWithValue }) => {
    try {
      const res = await api.post('/api/v1/rules', data);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create rule');
    }
  }
);

export const applyRuleTemplate = createAsyncThunk(
  'rule/applyTemplate',
  async ({ key, ...data }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/api/v1/rules/templates/${key}/apply`, data);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to apply template');
    }
  }
);

export const updateRule = createAsyncThunk(
  'rule/updateRule',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/api/v1/rules/${id}`, data);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update rule');
    }
  }
);

export const toggleRuleEnabled = createAsyncThunk(
  'rule/toggleEnabled',
  async ({ id, enabled }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/api/v1/rules/${id}`, { enabled });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update rule');
    }
  }
);

export const deleteRule = createAsyncThunk(
  'rule/deleteRule',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/api/v1/rules/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete rule');
    }
  }
);

export const dryRunRule = createAsyncThunk(
  'rule/dryRun',
  async ({ id, taskId }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/api/v1/rules/${id}/dry-run`, { taskId });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to test rule');
    }
  }
);

export const fetchRuleRuns = createAsyncThunk(
  'rule/fetchRuns',
  async ({ id, cursor }, { rejectWithValue }) => {
    try {
      const res = await api.get(`/api/v1/rules/${id}/runs`, { params: { cursor: cursor || undefined } });
      return { ruleId: id, cursor, ...res.data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load run history');
    }
  }
);

// ── Slice ───────────────────────────────────────────────────────────────────

const initialState = {
  schema: null,
  schemaLoading: false,
  templates: [],
  templatesLoading: false,
  rules: [],
  rulesLoading: false,
  saving: false,
  dryRunResult: null,
  dryRunLoading: false,
  runs: { items: [], nextCursor: null, hasMore: false },
  runsLoading: false,
  error: null,
};

const ruleSlice = createSlice({
  name: 'rule',
  initialState,
  reducers: {
    clearDryRunResult: (state) => { state.dryRunResult = null; },
    clearRuns: (state) => { state.runs = { items: [], nextCursor: null, hasMore: false }; },
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRuleSchema.pending, (s) => { s.schemaLoading = true; })
      .addCase(fetchRuleSchema.fulfilled, (s, a) => { s.schemaLoading = false; s.schema = a.payload; })
      .addCase(fetchRuleSchema.rejected, (s, a) => { s.schemaLoading = false; s.error = a.payload; })

      .addCase(fetchRuleTemplates.pending, (s) => { s.templatesLoading = true; })
      .addCase(fetchRuleTemplates.fulfilled, (s, a) => { s.templatesLoading = false; s.templates = a.payload; })
      .addCase(fetchRuleTemplates.rejected, (s, a) => { s.templatesLoading = false; s.error = a.payload; })

      .addCase(fetchRules.pending, (s) => { s.rulesLoading = true; s.error = null; })
      .addCase(fetchRules.fulfilled, (s, a) => { s.rulesLoading = false; s.rules = a.payload; })
      .addCase(fetchRules.rejected, (s, a) => { s.rulesLoading = false; s.error = a.payload; })

      .addCase(createRule.pending, (s) => { s.saving = true; s.error = null; })
      .addCase(createRule.fulfilled, (s, a) => { s.saving = false; s.rules.unshift(a.payload); })
      .addCase(createRule.rejected, (s, a) => { s.saving = false; s.error = a.payload; })

      .addCase(applyRuleTemplate.pending, (s) => { s.saving = true; s.error = null; })
      .addCase(applyRuleTemplate.fulfilled, (s, a) => { s.saving = false; s.rules.unshift(a.payload); })
      .addCase(applyRuleTemplate.rejected, (s, a) => { s.saving = false; s.error = a.payload; })

      .addCase(updateRule.pending, (s) => { s.saving = true; s.error = null; })
      .addCase(updateRule.fulfilled, (s, a) => {
        s.saving = false;
        const i = s.rules.findIndex((r) => r.id === a.payload.id);
        if (i !== -1) s.rules[i] = a.payload;
      })
      .addCase(updateRule.rejected, (s, a) => { s.saving = false; s.error = a.payload; })

      // Optimistic: flip the switch immediately on click instead of waiting on the
      // PATCH round-trip — the checkbox is controlled by this state, so without this
      // it snaps back to its old position for a moment (or gets stuck if the request
      // fails) instead of tracking the click.
      .addCase(toggleRuleEnabled.pending, (s, a) => {
        const { id, enabled } = a.meta.arg;
        const r = s.rules.find((r) => r.id === id);
        if (r) r.enabled = enabled;
      })
      .addCase(toggleRuleEnabled.fulfilled, (s, a) => {
        const i = s.rules.findIndex((r) => r.id === a.payload.id);
        if (i !== -1) s.rules[i] = a.payload;
      })
      .addCase(toggleRuleEnabled.rejected, (s, a) => {
        s.error = a.payload;
        const { id, enabled } = a.meta.arg;
        const r = s.rules.find((r) => r.id === id);
        if (r) r.enabled = !enabled; // revert the optimistic flip
      })

      .addCase(deleteRule.fulfilled, (s, a) => {
        s.rules = s.rules.filter((r) => r.id !== a.payload);
      })
      .addCase(deleteRule.rejected, (s, a) => { s.error = a.payload; })

      .addCase(dryRunRule.pending, (s) => { s.dryRunLoading = true; s.dryRunResult = null; })
      .addCase(dryRunRule.fulfilled, (s, a) => { s.dryRunLoading = false; s.dryRunResult = a.payload; })
      .addCase(dryRunRule.rejected, (s, a) => { s.dryRunLoading = false; s.error = a.payload; })

      .addCase(fetchRuleRuns.pending, (s) => { s.runsLoading = true; })
      .addCase(fetchRuleRuns.fulfilled, (s, a) => {
        s.runsLoading = false;
        s.runs = {
          items: a.payload.cursor ? [...s.runs.items, ...a.payload.items] : a.payload.items,
          nextCursor: a.payload.nextCursor,
          hasMore: a.payload.hasMore,
        };
      })
      .addCase(fetchRuleRuns.rejected, (s, a) => { s.runsLoading = false; s.error = a.payload; });
  },
});

export const { clearDryRunResult, clearRuns, clearError } = ruleSlice.actions;
export default ruleSlice.reducer;
