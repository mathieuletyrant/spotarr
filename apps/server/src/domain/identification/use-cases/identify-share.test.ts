import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { SpotarrError } from "../../../errors";
import type { ChatMessage } from "../../../integrations/llm/client";
import { Seerr } from "../../../integrations/seerr/client";
import { getGetMovieMovieIdResponseMock } from "../../../integrations/seerr/gen/seerr.faker";
import { Tmdb } from "../../../integrations/tmdb/client";
import {
  getFindByIdResponseMock,
  getMovieDetailsResponseMock,
} from "../../../integrations/tmdb/gen/tmdb.faker";
import { fakeFetch } from "../../../testing/fake-fetch";
import type { Photo } from "../extractors/photo";
import type { Video } from "../extractors/video";
import type { Answer, Llm } from "../guess-titles";
import { identifyShare } from "./identify-share";

afterEach(() => mock.restore());

const tmdb = new Tmdb({ token: "tok", language: "fr-FR" });
const seerr = new Seerr({ url: "http://seerr.test", apiKey: "key" });
const inLibrary = getGetMovieMovieIdResponseMock({ mediaInfo: { status: 5 } });
const dune = getMovieDetailsResponseMock({
  id: 693134,
  title: "Dune : Deuxième partie",
  release_date: "2024-02-27",
});
const frame = { atMs: 2500, jpeg: new Uint8Array([1]), thumbnail: new Uint8Array([2]) };
const reel: Video = { caption: "tu as du choix sur Netflix", author: "CameraCam", frames: [frame] };

const notCalled = async (): Promise<never> => {
  throw new Error("should not be called");
};
const llmAnswering =
  (answer: Answer): Llm =>
  async () => ({ answer, costUsd: 0.0012 });

test("an IMDb link gives a certain Candidate, without video nor LLM", async () => {
  fakeFetch({
    "/3/find/tt15239678": getFindByIdResponseMock({ movie_results: [dune] }),
    "/api/v1/movie/693134": inLibrary,
  });

  const result = await identifyShare(
    "shr_test",
    { url: "https://www.imdb.com/title/tt15239678/" },
    { tmdb, seerr, readVideo: notCalled, readPhoto: notCalled, llm: notCalled },
  );

  expect(result).toMatchObject({ status: "READY", method: "DIRECT_ID", extractors: ["id-link"] });
  expect(result.candidates).toMatchObject([
    { tmdbId: 693134, title: "Dune : Deuxième partie", year: 2024 },
  ]);
  expect(result.candidates[0]?.confidence).toBeUndefined();
});

test("a TMDB link works the same way", async () => {
  fakeFetch({ "/3/movie/693134": dune, "/api/v1/movie/693134": inLibrary });
  const result = await identifyShare(
    "shr_test",
    { url: "https://www.themoviedb.org/movie/693134" },
    { tmdb, seerr, readVideo: notCalled, readPhoto: notCalled, llm: notCalled },
  );
  expect(result.candidates.map((c) => c.title)).toEqual(["Dune : Deuxième partie"]);
});

test("a reel is read, then the LLM explains what it sees (Candidates come with #17)", async () => {
  const llm = llmAnswering({ reasoning: "On reconnaît Zach Galifianakis.", guesses: [] });

  const result = await identifyShare(
    "shr_test",
    { url: "https://www.instagram.com/reel/DeHYOAbo14f/" },
    { tmdb, seerr, readVideo: async () => reel, readPhoto: notCalled, llm },
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

test("an Instagram photo post, which has no video, is read as a photo", async () => {
  const noVideo = async (): Promise<never> => {
    throw new SpotarrError(
      "unavailable",
      "yt-dlp failed: ERROR: [Instagram] DeZTyvuF9aF: There is no video in this post",
    );
  };
  const photo: Photo = {
    caption: "NARNIA : LE NEVEU DU MAGICIEN. Bande-annonce demain.",
    author: "Netflix France",
    picture: new Uint8Array([9]),
  };
  let sent: ChatMessage[] = [];
  const llm: Llm = async (messages) => {
    sent = messages;
    return { answer: { reasoning: "La légende nomme le film.", guesses: [] } };
  };

  const result = await identifyShare(
    "shr_test",
    { url: "https://www.instagram.com/p/DeZTyvuF9aF/" },
    { tmdb, seerr, readVideo: noVideo, readPhoto: async () => photo, llm },
  );

  expect(result).toMatchObject({
    method: "LLM",
    extractors: ["instagram-photo"],
    clues: {
      caption: "NARNIA : LE NEVEU DU MAGICIEN. Bande-annonce demain.",
      author: "Netflix France",
    },
  });
  // A photo has no frames to keep, and the LLM gets its picture alone, without sound.
  expect(result.frames).toBeUndefined();
  const content = sent[1]?.content;
  const parts = Array.isArray(content) ? content.map((part) => part.type) : [];
  expect(parts).toEqual(["text", "image_url"]);
});

test("a video that cannot be read fails the Identification with the reason", async () => {
  const readVideo = async (): Promise<Video> => {
    throw new Error("yt-dlp failed: ERROR: Requested content is not available");
  };
  await expect(
    identifyShare(
      "shr_test",
      { url: "https://www.instagram.com/reel/x/" },
      { tmdb, seerr, readVideo, readPhoto: notCalled, llm: notCalled },
    ),
  ).rejects.toThrow("Requested content is not available");
});

test("Seerr being down leaves the Candidates ABSENT, without failing", async () => {
  fakeFetch({ "/3/movie/693134": dune, "/api/v1/movie/693134": 503 });
  const result = await identifyShare(
    "shr_test",
    { url: "https://www.themoviedb.org/movie/693134" },
    { tmdb, seerr, readVideo: notCalled, readPhoto: notCalled, llm: notCalled },
  );
  expect(result).toMatchObject({ status: "READY", candidates: [{ libraryState: "ABSENT" }] });
});

test("every step of an Identification logs one line with the Share's id", async () => {
  const printed = spyOn(console, "log").mockImplementation(() => {});
  process.env.NODE_ENV = "development"; // log() is silent under bun test
  try {
    fakeFetch({ "/3/movie/693134": dune, "/api/v1/movie/693134": inLibrary });
    const llm = llmAnswering({ reasoning: "", guesses: [] });
    await identifyShare(
      "shr_42",
      { url: "https://www.instagram.com/reel/x/" },
      { tmdb, seerr, readVideo: async () => reel, readPhoto: notCalled, llm },
    );
  } finally {
    process.env.NODE_ENV = "test";
  }

  const lines = printed.mock.calls.map(([line]) => JSON.parse(String(line)));
  expect(lines.map((line) => line.step)).toEqual(["video", "llm", "tmdb", "library-check"]);
  expect(lines.every((line) => line.shareId === "shr_42")).toBe(true);
  expect(lines[0]).toMatchObject({ frames: 1, audio: false });
  expect(lines[1]).toMatchObject({ guesses: 0, costUsd: 0.0012 });
});
