import { useMutation } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useRef } from "react";
import { settingsQuery } from "../../queries/settings";
import { useToast } from "../toast";
import type { Form } from "./fields";
import { TokenField } from "./token-field";

// The address an MCP client is given: read-only, it lists the Shares. The MCP
// token sits in it because some MCP clients only send the URL they were given.
// Regenerate asks first, in a native <dialog>, like deleting a Share.
export function McpUrlField({ form }: { form: Form }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const token = form.values["access.mcpToken"] ?? "";
  const url = `${window.location.origin}/mcp?token=${token}`;

  const regenerate = useMutation(SpotarrService.method.regenerateMcpToken, {
    onSuccess: async ({ mcpToken }) => {
      // In the form too, else the new token would count as an unsaved change.
      form.change("access.mcpToken", mcpToken);
      dialog.current?.close();
      toast("New MCP URL made");
      await queryClient.invalidateQueries({ queryKey: settingsQuery().queryKey });
    },
  });

  return (
    <>
      <TokenField
        id="mcp-url"
        label="MCP URL"
        value={url}
        hint="Give it to an MCP client: an AI assistant like Claude then reads the history through it, and nothing more. It uses this page's address; change it if the client reaches Spotarr at another one."
      >
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-surface"
        >
          <RefreshCw aria-hidden className="size-4" />
          Regenerate
        </button>
      </TokenField>

      <dialog
        ref={dialog}
        aria-labelledby="regenerate-mcp-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-surface-raised text-text shadow-xl backdrop:bg-bg/70 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col gap-4 p-6">
          <h2 id="regenerate-mcp-title" className="text-lg font-semibold">
            Make a new MCP URL?
          </h2>
          <p className="text-sm text-text-muted">
            The current one stops working at once: give the new one to your MCP clients.
          </p>
          {regenerate.error && (
            <p className="text-sm text-status-error">{regenerate.error.rawMessage}</p>
          )}
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
              onClick={() => regenerate.mutate({})}
              disabled={regenerate.isPending}
              className="flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-surface"
            >
              <RefreshCw aria-hidden className="size-4" />
              {regenerate.isPending ? "Regenerating…" : "Regenerate"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
