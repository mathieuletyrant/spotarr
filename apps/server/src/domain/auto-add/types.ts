import { z } from "zod";

// A Rule's conditions; all must hold, and an absent one is no condition.
export const ConditionsSchema = z.object({
  // Only movies, or only TV shows.
  type: z.enum(["MOVIE", "TV"]).optional(),
  // Only when the Identification found a single Candidate in total.
  onlyOne: z.boolean().default(false),
  // Percent. A direct IMDb/TMDB link counts as 100.
  minConfidence: z.int().min(1).max(100).optional(),
  // TMDB rating out of 10; a Candidate nobody rated fails it.
  minRating: z.number().min(0).max(10).optional(),
  minVotes: z.int().min(0).optional(),
  // A title not out yet has no rating to judge: it skips minRating and minVotes.
  unreleasedSkipsRating: z.boolean().default(false),
});

// What a Rule does with a Candidate: request it through Seerr, or put it in
// Seerr's watchlist, which requests nothing.
const ACTIONS = ["REQUEST", "WATCHLIST"] as const;

// What SaveRule accepts.
export const RuleSchema = ConditionsSchema.extend({
  name: z.string().trim().min(1, "give the rule a name").max(60),
  enabled: z.boolean(),
  action: z.enum(ACTIONS).default("REQUEST"),
});

// When auto add requests a Candidate, or puts it in the watchlist, without a click.
export type Rule = z.infer<typeof RuleSchema> & { id: string };
