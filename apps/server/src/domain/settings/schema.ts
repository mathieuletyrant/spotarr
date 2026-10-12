import { z } from "zod";

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
      cookiesTxt: z.string().default(""),
      // 8 images at most reach the LLM per Identification.
      framesPerVideo: z.int().min(1).max(8).default(6),
      maxVideoMb: z.int().min(1).max(2000).default(200),
      concurrency: z.int().min(1).max(4).default(2),
    })
    .prefault({}),
  access: z
    .object({
      // Generated at first start, read-only for clients (see SettingsRepository.update).
      apiToken: z.string().default(""),
    })
    .prefault({}),
});

export type Settings = z.infer<typeof SettingsSchema>;

// What UpdateSettings may carry: any subset of any section.
export type SettingsPatch = { [S in keyof Settings]?: Partial<Settings[S]> };
