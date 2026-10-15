// Floats at the bottom while the form has unsaved changes, or an error that
// belongs to no field.
export function SaveBar({
  changed,
  error,
  saving,
  onCancel,
}: {
  changed: number;
  error?: string;
  saving: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-6 z-10 flex justify-center px-4">
      <div className="flex items-center gap-4 rounded-full border border-border bg-surface-raised py-2 pr-2 pl-5 shadow-lg">
        <p className="text-sm">
          {error ? (
            <span className="text-status-error">{error}</span>
          ) : (
            `${changed} unsaved ${changed === 1 ? "change" : "changes"}`
          )}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-full px-4 text-sm font-medium text-text-muted hover:bg-text/8 hover:text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || changed === 0}
            className="h-9 rounded-full bg-accent px-5 text-sm font-medium text-accent-text"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
