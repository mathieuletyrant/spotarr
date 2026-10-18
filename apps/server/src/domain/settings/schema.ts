import { z } from "zod";
import { EFFORTS } from "../../integrations/llm/client";

// The settings as the rest of the server sees them, with their defaults.
// Field names match the contract's (camelCase) so mapping is a plain copy.
// `prefault({})` fills a missing section with its inner defaults.
const optionalUrl = z.union([z.literal(""), z.url()]);

export const SettingsSchema = z.object({
  identification: z
    .object({
      llmApiUrl: z.url().default("https://openrouter.ai/api/v1"),
      llmApiKey: z.string().default(""),
      // Must read images and hear audio: it gets the video's frames and sound.
      // Chosen on 2026-10-12, the only one of 4 vision models to find all 3
      // films of a test reel.
      model: z.string().default("google/gemini-3.8-flash"),
      // Gemini 3.8 Flash answered in 15 to 45 s without an effort, in 3 to 6 s
      // with "low", naming the same films on the test reel.
      effort: z.enum(EFFORTS).default("low"),
      tmdbToken: z.string().default(""),
      language: z
        .string()
        .regex(/^[a-z]{2}-[A-Z]{2}$/, "expected a language tag like fr-FR")
        .default("fr-FR"),
    })
    .prefault({}),
  seerr: z
    .object({
      url: optionalUrl.default(""),
      apiKey: z.string().default(""),
    })
    .prefault({}),
  extraction: z
    .object({
      // 15 images at most reach the LLM per Identification: each one costs tokens.
      framesPerVideo: z.int().min(1).max(15).default(6),
      maxVideoMb: z.int().min(1).max(2000).default(200),
      // Read when the queue starts: a change applies at the next restart.
      concurrency: z.int().min(1).max(4).default(2),
    })
    .prefault({}),
  webhooks: z
    .object({
      // Where the web UI answers: events link to the Share's page. Empty: no link.
      webUiUrl: optionalUrl.default(""),
    })
    .prefault({}),
  streaming: z
    .object({
      // TMDB ids of the Platforms subscribed to: Crunchyroll is 283.
      platformIds: z.array(z.int().positive()).default([]),
    })
    .prefault({}),
  access: z
    .object({
      // Generated at first start, read-only for clients (see SettingsRepository.update).
      apiToken: z.string().default(""),
      // Read-only access for MCP clients, at /mcp?token=…; the API refuses it.
      // Generated at first start, changed by regenerateMcpToken() only.
      mcpToken: z.string().default(""),
      // What Seerr gives when it reports a change, at /seerr/webhook; refused
      // anywhere else. Generated at first start, changed by regenerateSeerrToken() only.
      seerrToken: z.string().default(""),
    })
    .prefault({}),
});

export type Settings = z.infer<typeof SettingsSchema>;

// What UpdateSettings may carry: any subset of any section. A choice among a
// few strings (the effort) arrives as any string: update() validates it.
type Patch<Section> = { [K in keyof Section]?: Section[K] extends string ? string : Section[K] };
export type SettingsPatch = { [S in keyof Settings]?: Patch<Settings[S]> };
