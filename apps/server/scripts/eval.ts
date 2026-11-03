// The evaluation set: real Instagram posts and the works they are about. Runs the real
// Identification (yt-dlp, ffmpeg, the LLM, TMDB; no Seerr) on each and prints
// whether the expected works are in the first 3 Candidates. Costs about $0.01
// a post. Re-run after any change to the prompt, the model or the matching.
//
//   pnpm --filter @spotarr/server eval        (reads the keys from ../../.env)

import type { Answer } from "../src/domain/identification/guess-titles";
import { identifyShare } from "../src/domain/identification/use-cases/identify-share";
import { identificationDeps } from "../src/domain/identification/use-cases/start-identification";
import { SettingsSchema } from "../src/domain/settings/schema";

// `post` is the link's path on instagram.com.
type Case = { post: string; expected: { title: string; tmdbId: number }[] };

const CASES: Case[] = [
  {
    post: "reel/DdmFkS8I7ta/",
    expected: [{ title: "L'Invitation (2026)", tmdbId: 950028 }],
  },
  {
    post: "reel/DeM363OouRS/",
    expected: [{ title: "Kraken (2026)", tmdbId: 1571766 }],
  },
  {
    // Three films in one reel: all three must be found.
    post: "reel/DeHYOAbo14f/",
    expected: [
      { title: "Awake", tmdbId: 13483 },
      { title: "Due Date", tmdbId: 41733 },
      { title: "Marriage Story", tmdbId: 492188 },
    ],
  },
  {
    post: "reel/DdrX8Rzo0Z9/",
    expected: [{ title: "Otec (2025)", tmdbId: 1516518 }],
  },
  {
    // An Italian TV show, out two weeks before this case was added.
    post: "reel/DdekpoZoJr7/",
    expected: [{ title: "Académie Minerva (TV, 2026)", tmdbId: 312557 }],
  },
  {
    post: "reel/DdO4J0uIxfh/",
    expected: [{ title: "The Uprising (2026)", tmdbId: 977942 }],
  },
  {
    // A carousel of ten films, shared from the eighth picture: that film is the one meant.
    post: "p/DeMojWljSKo/?img_index=8",
    expected: [{ title: "Always Be My Maybe (2019)", tmdbId: 513576 }],
  },
];

const settings = SettingsSchema.parse({
  identification: {
    llmApiKey: process.env.OPENROUTER_API_KEY ?? "",
    tmdbToken: process.env.TMDB_TOKEN ?? "",
    ...(process.env.MODEL ? { model: process.env.MODEL } : {}),
    ...(process.env.EFFORT ? { effort: process.env.EFFORT } : {}),
  },
});
const model = settings.identification.model;
const deps = identificationDeps(settings);

let passed = 0;
for (const { post, expected } of CASES) {
  // Kept to print what the LLM said when a case fails.
  let answer: Answer = { reasoning: "", guesses: [] };
  const { candidates } = await identifyShare(
    `eval_${post}`,
    { url: `https://www.instagram.com/${post}` },
    {
      ...deps,
      llm: async (messages) => {
        const reply = await deps.llm(messages);
        answer = reply.answer;
        return reply;
      },
      // No Seerr during the evaluation: every Candidate stays ABSENT.
      libraryState: async () => "ABSENT",
    },
  );

  // A single work must be in the first 3; a post of several works must list them all.
  const allowed = Math.max(3, expected.length);
  const found = candidates.slice(0, allowed).map((c) => c.tmdbId);
  const ok = expected.every((work) => found.includes(work.tmdbId));
  if (ok) passed++;

  const got = candidates.slice(0, allowed).map((c) => `${c.title} ${c.year ?? ""}`.trim());
  console.log(
    `${ok ? "✅" : "❌"} ${post}  expected ${expected.map((w) => w.title).join(", ")}  got ${got.join(", ") || "nothing"}`,
  );
  if (!ok) {
    // What the LLM said, to tell a wrong guess from a wrong TMDB match.
    for (const guess of answer.guesses) {
      console.log(
        `     LLM: ${guess.title} / ${guess.originalTitle} ${guess.year} ${guess.originalLanguage} ${guess.type}`,
      );
    }
  }
}
console.log(`\n${model} (${settings.identification.effort}): ${passed}/${CASES.length}`);
