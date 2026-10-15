import { ConnectError } from "@connectrpc/connect";
import { RefreshCw } from "lucide-react";
import { useRef, useState } from "react";

// Regenerate a token, after asking in a native <dialog>, like deleting a
// Share: the current one stops working at once. `regenerate` makes the new
// one; the dialog closes once it is done, and shows the error if it fails.
export function RegenerateButton({
  id,
  question,
  warning,
  regenerate,
}: {
  id: string;
  question: string;
  warning: string;
  regenerate: () => Promise<unknown>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setPending(true);
    setError(undefined);
    try {
      await regenerate();
      dialog.current?.close();
    } catch (failure) {
      setError(ConnectError.from(failure).rawMessage);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-surface"
      >
        <RefreshCw aria-hidden className="size-4" />
        Regenerate
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-surface-raised text-text shadow-xl backdrop:bg-bg/70 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col gap-4 p-6">
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            {question}
          </h2>
          <p className="text-sm text-text-muted">{warning}</p>
          {error && <p className="text-sm text-status-error">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="h-10 rounded-md px-4 text-sm font-medium text-text-muted hover:bg-text/8 hover:text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className="flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-surface"
            >
              <RefreshCw aria-hidden className="size-4" />
              {pending ? "Regenerating…" : "Regenerate"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
