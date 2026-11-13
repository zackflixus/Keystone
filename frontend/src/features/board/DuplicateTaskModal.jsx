import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Asana-style "Duplicate task" dialog.
 *
 * Only the options this app actually has are listed — Tags are copied silently
 * (there is no tag UI yet) and Collaborators/Projects/Dependencies don't exist.
 *
 * Props:
 *   task      — the source task ({ id, title, parentId })
 *   isSubtask — show the "Parent task" option (uncheck to lift the copy to top level)
 *   busy      — disables the form while the request is in flight
 *   onCancel()
 *   onConfirm({ title, include })
 */

// Defaults mirror Asana: assignee and due date start unchecked.
const OPTIONS = [
  { key: "description", label: "Task description", default: true },
  { key: "assignees", label: "Assignee", default: false },
  { key: "subtasks", label: "Subtasks", default: true },
  { key: "attachments", label: "Attachments", default: true },
  { key: "customFields", label: "Custom fields", default: true },
  { key: "dueDate", label: "Due date", default: false },
  { key: "estimatedTime", label: "Estimated time", default: true },
  { key: "billable", label: "Billable", default: true },
];

const defaultInclude = () =>
  OPTIONS.reduce((acc, o) => ({ ...acc, [o.key]: o.default }), {
    parentTask: true,
  });

export default function DuplicateTaskModal({
  task,
  isSubtask = false,
  busy = false,
  onCancel,
  onConfirm,
}) {
  const [title, setTitle] = useState("");
  const [include, setInclude] = useState(defaultInclude);
  const inputRef = useRef(null);

  // Prefill + pre-select the name so typing replaces it (same as Asana).
  useEffect(() => {
    if (!task) return;
    setTitle(`Duplicate of: ${task.title}`);
    setInclude(defaultInclude());
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(t);
  }, [task?.id, task?.title]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [busy, onCancel]);

  if (!task) return null;

  const toggle = (key) => setInclude((p) => ({ ...p, [key]: !p[key] }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    onConfirm({ title: trimmed.slice(0, 200), include });
  };

  const rows = isSubtask
    ? [...OPTIONS, { key: "parentTask", label: "Parent task" }]
    : OPTIONS;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 animate-fade-in"
      onClick={() => !busy && onCancel()}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--karya-surface)] rounded-xl shadow-2xl border border-[var(--karya-border)] w-full max-w-lg mx-4 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h3 className="text-lg font-bold text-[var(--karya-text-primary)]">
            Duplicate task
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="p-1 rounded-md text-[var(--karya-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        <div className="px-6 pb-2">
          <label className="block text-xs font-semibold text-[var(--karya-text-secondary)] mb-1.5">
            Task Name
          </label>
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={400}
            disabled={busy}
            className="w-full px-3 py-2.5 text-sm rounded-lg bg-[var(--karya-bg)] text-[var(--karya-text-primary)] border border-karya-blue focus:outline-none focus:ring-2 focus:ring-karya-blue/40 disabled:opacity-60"
          />
        </div>

        <div className="px-6 py-4">
          <p className="text-xs font-semibold text-[var(--karya-text-secondary)] mb-2.5">
            Include
          </p>
          <div className="space-y-0.5">
            {rows.map((opt) => (
              <label
                key={opt.key}
                className="flex items-center gap-2.5 py-1.5 px-1 -mx-1 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={!!include[opt.key]}
                  onChange={() => toggle(opt.key)}
                  disabled={busy}
                  className="w-4 h-4 rounded accent-karya-blue cursor-pointer"
                />
                <span className="text-sm text-[var(--karya-text-primary)]">
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--karya-border)]">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium rounded-lg text-[var(--karya-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-karya-blue text-white hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Duplicating…" : "Create new task"}
          </button>
        </div>
      </form>
    </div>
  );
}
