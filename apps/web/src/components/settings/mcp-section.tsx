import { Bot } from "lucide-react";
import { type Form, Section, SubHeading } from "./fields";
import { McpUrlField } from "./mcp-url-field";

// The MCP server's tools (apps/server/src/api/mcp/), as this section lists them.
const MCP_TOOLS = [
  {
    name: "list_shares",
    description:
      "The history, newest first, with each Share's candidates and where they stand. Filters by status, genre and text.",
  },
  {
    name: "list_genres",
    description: "Every genre of the history, most Shares first: the names list_shares filters by.",
  },
];

export function McpSection({ form }: { form: Form }) {
  return (
    <Section
      id="mcp"
      icon={<Bot aria-hidden className="size-5" />}
      title="MCP"
      description="Lets an AI assistant like Claude read the history: read-only, it changes nothing."
    >
      <McpUrlField form={form} />

      <SubHeading title="Tools" description="What the assistant can call. Both only read." />
      <ul className="flex flex-col gap-3 md:col-span-2">
        {MCP_TOOLS.map((tool) => (
          <li key={tool.name} className="flex flex-col gap-0.5 text-sm">
            <code className="w-fit rounded bg-text/8 px-1.5 py-0.5 font-mono text-xs">
              {tool.name}
            </code>
            <span className="text-text-muted">{tool.description}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
