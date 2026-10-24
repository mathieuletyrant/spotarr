import { useMutation } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { useQueryClient } from "@tanstack/react-query";
import { settingsQuery } from "../../queries/settings";
import { useToast } from "../toast";
import { CopyField } from "./copy-field";
import type { Form } from "./fields";
import { RegenerateButton } from "./regenerate-button";

// The address an MCP client is given: read-only, it lists the Shares. The MCP
// token sits in it because some MCP clients only send the URL they were given.
export function McpUrlField({ form }: { form: Form }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const token = form.values["access.mcpToken"] ?? "";

  const regenerate = useMutation(SpotarrService.method.regenerateMcpToken, {
    onSuccess: async ({ mcpToken }) => {
      // In the form too, else the new token would count as an unsaved change.
      form.change("access.mcpToken", mcpToken);
      toast("New MCP URL made");
      await queryClient.invalidateQueries({ queryKey: settingsQuery().queryKey });
    },
  });

  return (
    <CopyField
      id="mcp-url"
      label="MCP URL"
      value={`${window.location.origin}/mcp?token=${token}`}
      hint="Paste it in your MCP client. Change the address if the client reaches Spotarr another way."
    >
      <RegenerateButton
        id="regenerate-mcp"
        question="Make a new MCP URL?"
        warning="The current one stops working. Give the new one to your MCP clients."
        regenerate={() => regenerate.mutateAsync({})}
      />
    </CopyField>
  );
}
