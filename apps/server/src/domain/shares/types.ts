import { z } from "zod";

// Candidates and clues are stored as JSON in the shares table; these schemas
// validate them on the way in and out, like the settings document.
export const CandidateSchema = z.object({
  tmdbId: z.int(),
  type: z.enum(["MOVIE", "TV"]),
  title: z.string(),
  originalTitle: z.string().optional(),
  year: z.int().optional(),
  posterUrl: z.string().optional(),
  // Absent for a direct ID, which is certain.
  confidence: z.number().min(0).max(1).optional(),
  libraryState: z.enum(["ABSENT", "REQUESTED", "PARTIAL", "AVAILABLE"]),
});
export type Candidate = z.infer<typeof CandidateSchema>;

export const CluesSchema = z.object({
  caption: z.string().optional(),
  author: z.string().optional(),
  subtitles: z.string().optional(),
});
export type Clues = z.infer<typeof CluesSchema>;

export type IdentificationStatus = "QUEUED" | "PROCESSING" | "READY" | "NO_MATCH" | "FAILED";
export type Method = "DIRECT_ID" | "LLM";
export type AdditionStatus = "ADDED" | "REQUESTED" | "ALREADY_PRESENT" | "FAILED";
export type Summary =
  | "IN_PROGRESS"
  | "TO_CHOOSE"
  | "ADDED"
  | "REQUESTED"
  | "ALREADY_PRESENT"
  | "NO_MATCH"
  | "FAILED";

export type ShareInput = { url?: string; text?: string; image?: Uint8Array };

export type Addition = {
  id: string;
  createdAt: string;
  tmdbId: number;
  type: Candidate["type"];
  target: "ARR" | "SEERR";
  status: AdditionStatus;
  error?: string;
  // Made by auto add, without a click.
  automatic: boolean;
};

export type Share = {
  id: string;
  createdAt: string;
  input: { url?: string; text?: string; hasImage: boolean };
  source: string;
  identification: {
    status: IdentificationStatus;
    method?: Method;
    durationMs?: number;
    extractors: string[];
    clues: Clues;
    reasoning?: string;
    error?: string;
  };
  candidates: Candidate[];
  additions: Addition[];
  // Thumbnails of the shared video, in order; served by api/frames.ts.
  frames: { position: number; atMs: number }[];
  summary: Summary;
};

// What an Identification produces. Candidates come sorted, best first.
export type IdentificationResult = {
  status: "READY" | "NO_MATCH";
  method?: Method;
  extractors: string[];
  clues: Clues;
  reasoning?: string;
  candidates: Candidate[];
  frames?: { atMs: number; thumbnail: Uint8Array }[];
  // In US dollars, when the LLM's provider reports it.
  llmCostUsd?: number;
};
