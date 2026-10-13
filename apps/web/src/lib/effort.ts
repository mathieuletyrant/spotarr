// The LLM's efforts, as the server takes them, and how long each may take: the
// server gives up after 60 s, 3 min and 5 min (integrations/llm/client.ts).
export const EFFORTS = [
  { value: "low", label: "Low · a few seconds" },
  { value: "medium", label: "Medium · up to 3 min" },
  { value: "high", label: "High · up to 5 min" },
];

// What a Share's page says while it waits, by the effort its Identification gets.
export function waitingText(effort: string | undefined): string {
  if (effort === "medium") return "This can take up to 3 minutes at medium effort";
  if (effort === "high") return "This can take up to 5 minutes at high effort";
  return "This takes 10 to 30 seconds";
}
