import { Bot } from "lucide-react";
import { type Form, Section, SubHeading } from "./fields";
import { McpUrlField } from "./mcp-url-field";

// The MCP server's tools (apps/server/src/api/mcp/), as this section lists them.
const MCP_TOOLS = [
  {
    name: "list_shares",
    description:
      "Your shares, newest first, with their candidates. Filters by status, genre, keyword or text.",
  },
  {
    name: "list_genres",
    description: "Genres in your history, most frequent first.",
  },
  {
    name: "list_keywords",
    description: "TMDB keywords in your history, most frequent first.",
  },
];

export function McpSection({ form }: { form: Form }) {
  return (
    <Section
      id="mcp"
      icon={<Bot aria-hidden className="size-5" />}
      title="MCP"
      description="Lets an AI assistant like Claude read your history. Read-only."
    >
      <McpUrlField form={form} />

      <SubHeading title="Tools" description="What the assistant can call." />
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
