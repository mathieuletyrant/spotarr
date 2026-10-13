import { afterEach, expect, mock, spyOn, test } from "bun:test";
import type { ChatMessage } from "../../../integrations/llm/client";
import { Tmdb } from "../../../integrations/tmdb/client";
import {
  getFindByIdResponseMock,
  getMovieDetailsResponseMock,
} from "../../../integrations/tmdb/gen/tmdb.faker";
import { fakeFetch } from "../../../testing/fake-fetch";
import type { Candidate } from "../../shares/types";
import type { Link } from "../extractors/link";
import type { Answer, Guess, Llm } from "../guess-titles";
import { identifyShare } from "./identify-share";

afterEach(() => mock.restore());

const tmdb = new Tmdb({ token: "tok", language: "fr-FR" });
const dune = getMovieDetailsResponseMock({
  id: 693134,
  title: "Dune : Deuxième partie",
  release_date: "2024-02-27",
});
const reel: Link = {
  extractor: "video",
  caption: "tu as du choix sur Netflix",
  author: "CameraCam",
  images: [new Uint8Array([1])],
  frames: [{ atMs: 2500, thumbnail: new Uint8Array([2]) }],
};

const notCalled = async (): Promise<never> => {
  throw new Error("should not be called");
};
const llmAnswering =
  (answer: Answer): Llm =>
  async () => ({ answer, costUsd: 0.0012 });
const available = async (): Promise<Candidate["libraryState"]> => "AVAILABLE";

test("an IMDb link gives a certain Candidate, without video nor LLM", async () => {
  fakeFetch({ "/3/find/tt15239678": getFindByIdResponseMock({ movie_results: [dune] }) });

  const result = await identifyShare(
    "shr_test",
    { url: "https://www.imdb.com/title/tt15239678/" },
    { tmdb, readLink: notCalled, llm: notCalled, libraryState: available },
  );

  expect(result).toMatchObject({ status: "READY", method: "DIRECT_ID", extractors: ["id-link"] });
  expect(result.candidates).toMatchObject([
    { tmdbId: 693134, title: "Dune : Deuxième partie", year: 2024 },
  ]);
  expect(result.candidates[0]?.confidence).toBeUndefined();
  expect(result.candidates[0]?.libraryState).toBe("AVAILABLE");
});

test("a pasted text with an IMDb link is identified the same way", async () => {
  fakeFetch({ "/3/find/tt15239678": getFindByIdResponseMock({ movie_results: [dune] }) });
  const result = await identifyShare(
    "shr_test",
    { text: "à voir : https://www.imdb.com/title/tt15239678/" },
    { tmdb, readLink: notCalled, llm: notCalled, libraryState: available },
  );
  expect(result).toMatchObject({ status: "READY", method: "DIRECT_ID" });
  expect(result.candidates.map((c) => c.title)).toEqual(["Dune : Deuxième partie"]);
});

test("a TMDB link works the same way", async () => {
  fakeFetch({ "/3/movie/693134": dune });
  const result = await identifyShare(
    "shr_test",
    { url: "https://www.themoviedb.org/movie/693134" },
    { tmdb, readLink: notCalled, llm: notCalled, libraryState: available },
  );
  expect(result.candidates.map((c) => c.title)).toEqual(["Dune : Deuxième partie"]);
});

test("a reel the LLM cannot name ends NO_MATCH, with its reasoning and frames", async () => {
  const llm = llmAnswering({ reasoning: "On reconnaît Zach Galifianakis.", guesses: [] });

  const result = await identifyShare(
    "shr_test",
    { url: "https://www.instagram.com/reel/DeHYOAbo14f/" },
    { tmdb, readLink: async () => reel, llm, libraryState: available },
  );

  expect(result).toEqual({
    status: "NO_MATCH",
    method: "LLM",
    extractors: ["video"],
    clues: { caption: "tu as du choix sur Netflix", author: "CameraCam" },
    reasoning: "On reconnaît Zach Galifianakis.",
    candidates: [],
    frames: [{ atMs: 2500, thumbnail: new Uint8Array([2]) }],
    llmCostUsd: 0.0012,
  });
});

test("a photo post: the LLM gets its picture alone, without sound, and no frames are kept", async () => {
  const photo: Link = {
    extractor: "instagram-photo",
    caption: "NARNIA : LE NEVEU DU MAGICIEN. Bande-annonce demain.",
    author: "Netflix France",
    images: [new Uint8Array([9])],
  };
  let sent: ChatMessage[] = [];
  const llm: Llm = async (messages) => {
    sent = messages;
    return { answer: { reasoning: "La légende nomme le film.", guesses: [] } };
  };

  const result = await identifyShare(
    "shr_test",
    { url: "https://www.instagram.com/p/DeZTyvuF9aF/" },
    { tmdb, readLink: async () => photo, llm, libraryState: available },
  );

  expect(result).toMatchObject({
    method: "LLM",
    extractors: ["instagram-photo"],
    clues: {
      caption: "NARNIA : LE NEVEU DU MAGICIEN. Bande-annonce demain.",
      author: "Netflix France",
    },
  });
  expect(result.frames).toBeUndefined();
  const content = sent[1]?.content;
  const parts = Array.isArray(content) ? content.map((part) => part.type) : [];
  expect(parts).toEqual(["text", "image_url"]);
});

test("the LLM's guesses, confirmed on TMDB, become Candidates with their Library state", async () => {
  // Real TMDB answers recorded on 2026-10-12, keyed "query|year".
  const recorded: Record<string, object> = await Bun.file(
    new URL("../fixtures/tmdb-searches.json", import.meta.url),
  ).json();
  fakeFetch({
    "/3/search/movie": (url) => {
      const key = `${url.searchParams.get("query")}|${url.searchParams.get("primary_release_year") ?? ""}`;
      return recorded[key] ?? { page: 1, results: [] };
    },
  });
  const kraken: Guess = {
    title: "Kraken",
    originalTitle: "Kraken",
    year: 2024,
    originalLanguage: "fr",
    type: "movie",
    confidence: 0.8,
    reason: "La légende parle du film Kraken.",
  };
  const llm = llmAnswering({ reasoning: "Un film français.", guesses: [kraken] });

  const result = await identifyShare(
    "shr_test",
    { url: "https://www.instagram.com/reel/x/" },
    { tmdb, readLink: async () => reel, llm, libraryState: available },
  );

  expect(result).toMatchObject({ status: "READY", method: "LLM", extractors: ["video"] });
  expect(result.candidates).toMatchObject([
    { tmdbId: 1571766, title: "Kraken", year: 2026, confidence: 0.8, libraryState: "AVAILABLE" },
  ]);
});

test("a video that cannot be read fails the Identification with the reason", async () => {
  const readLink = async (): Promise<Link> => {
    throw new Error("yt-dlp failed: ERROR: Requested content is not available");
  };
  await expect(
    identifyShare(
      "shr_test",
      { url: "https://www.instagram.com/reel/x/" },
      { tmdb, readLink, llm: notCalled, libraryState: available },
    ),
  ).rejects.toThrow("Requested content is not available");
});

test("Seerr being down leaves the Candidates ABSENT, without failing", async () => {
  fakeFetch({ "/3/movie/693134": dune });
  const seerrDown = async (): Promise<never> => {
    throw new Error("Seerr answered 503");
  };
  const result = await identifyShare(
    "shr_test",
    { url: "https://www.themoviedb.org/movie/693134" },
    { tmdb, readLink: notCalled, llm: notCalled, libraryState: seerrDown },
  );
  expect(result).toMatchObject({ status: "READY", candidates: [{ libraryState: "ABSENT" }] });
});

test("every step of an Identification logs one line with the Share's id", async () => {
  const printed = spyOn(console, "log").mockImplementation(() => {});
  process.env.NODE_ENV = "development"; // log() is silent under bun test
  try {
    const llm = llmAnswering({ reasoning: "", guesses: [] });
    await identifyShare(
      "shr_42",
      { url: "https://www.instagram.com/reel/x/" },
      { tmdb, readLink: async () => reel, llm, libraryState: available },
    );
  } finally {
    process.env.NODE_ENV = "test";
  }

  const lines = printed.mock.calls.map(([line]) => JSON.parse(String(line)));
  expect(lines.map((line) => line.step)).toEqual(["read", "llm", "tmdb", "library-check"]);
  expect(lines.every((line) => line.shareId === "shr_42")).toBe(true);
  expect(lines[0]).toMatchObject({ extractor: "video", images: 1, audio: false });
  expect(lines[1]).toMatchObject({ guesses: 0, costUsd: 0.0012 });
});
