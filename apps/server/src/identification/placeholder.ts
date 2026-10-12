import type { Identify } from "../shares/queue";

// Stand-in until the real pipeline lands (extractors #12–#15, LLM #16, TMDB #17):
// every Share ends without a match, so the queue and the history work end to end.
export const identifyNothing: Identify = async () => ({
  status: "NO_MATCH",
  extractors: [],
  clues: {},
  candidates: [],
});
