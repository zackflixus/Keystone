/**
 * Rules execute as their creator, not as whoever triggered the event that
 * fired them, and not as a synthetic system user.
 *
 * Two reasons this beats a dedicated "system" account:
 *   - Permission checks stay meaningful for free. taskService/commentService
 *     already run every write through getContextFromTask's hasPermission
 *     check for whoever is passed as the acting user. Using the rule's
 *     creator means that check is re-evaluated on every run against their
 *     *current* role — if they lose access to the project, the rule starts
 *     failing loudly instead of silently acting with more power than any
 *     real member has.
 *   - No synthetic user means no WorkspaceMember row to create and keep in
 *     sync in every workspace a rule might run in.
 *
 * The event this produces is still tagged actorType: 'RULE' (see
 * domainEvents.js) so activity logs and the UI can tell "Rule: X" apart from
 * a human edit by the same person.
 */
export function buildRuleContext({ rule, depth, chainId }) {
  return {
    actingUserId: rule.createdById,
    ruleContext: {
      actorType: 'RULE',
      depth: (depth ?? 0) + 1,
      chainId
    }
  };
}
