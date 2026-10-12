import { afterEach, expect, mock, test } from "bun:test";
import { Seerr } from "../../integrations/seerr/client";
import { getGetMovieMovieIdResponseMock } from "../../integrations/seerr/gen/seerr.faker";
import { Tmdb } from "../../integrations/tmdb/client";
import {
  getFindByIdResponseMock,
  getMovieDetailsResponseMock,
} from "../../integrations/tmdb/gen/tmdb.faker";
import { fakeFetch } from "../../testing/fake-fetch";
import type { Video } from "./extractors/video";
import type { Guesses, Llm } from "./guess-titles";
import { identify } from "./identify";

afterEach(() => mock.restore());

const tmdb = new Tmdb({ token: "tok", language: "fr-FR" });
const seerr = new Seerr({ url: "http://seerr.test", apiKey: "key" });
const inLibrary = getGetMovieMovieIdResponseMock({ mediaInfo: { status: 5 } });
const dune = getMovieDetailsResponseMock({
  id: 693134,
  title: "Dune : Deuxième partie",
  release_date: "2024-02-27",
});
const reel: Video = {
  caption: "tu as du choix sur Netflix",
  author: "CameraCam",
  frames: [new Uint8Array([1])],
};

const notCalled = async (): Promise<never> => {
  throw new Error("should not be called");
};
const llmAnswering =
  (answer: Guesses): Llm =>
  async () =>
    answer;

test("an IMDb link gives a certain Candidate, without video nor LLM", async () => {
  fakeFetch({
    "/3/find/tt15239678": getFindByIdResponseMock({ movie_results: [dune] }),
    "/api/v1/movie/693134": inLibrary,
  });

  const result = await identify(
    { url: "https://www.imdb.com/title/tt15239678/" },
    { tmdb, seerr, readVideo: notCalled, llm: notCalled },
  );

  expect(result).toMatchObject({ status: "READY", method: "DIRECT_ID", extractors: ["id-link"] });
  expect(result.candidates).toMatchObject([
    { tmdbId: 693134, title: "Dune : Deuxième partie", year: 2024 },
  ]);
  expect(result.candidates[0]?.confidence).toBeUndefined();
});

test("a TMDB link works the same way", async () => {
  fakeFetch({ "/3/movie/693134": dune, "/api/v1/movie/693134": inLibrary });
  const result = await identify(
    { url: "https://www.themoviedb.org/movie/693134" },
    { tmdb, seerr, readVideo: notCalled, llm: notCalled },
  );
  expect(result.candidates.map((c) => c.title)).toEqual(["Dune : Deuxième partie"]);
});

test("a reel is read, then the LLM explains what it sees (Candidates come with #17)", async () => {
  const llm = llmAnswering({ reasoning: "On reconnaît Zach Galifianakis.", candidates: [] });

  const result = await identify(
    { url: "https://www.instagram.com/reel/DeHYOAbo14f/" },
    { tmdb, seerr, readVideo: async () => reel, llm },
  );

  expect(result).toEqual({
    status: "NO_MATCH",
    method: "LLM",
    extractors: ["video"],
    clues: { caption: "tu as du choix sur Netflix", author: "CameraCam" },
    reasoning: "On reconnaît Zach Galifianakis.",
    candidates: [],
  });
});

test("a video that cannot be read fails the Identification with the reason", async () => {
  const readVideo = async (): Promise<Video> => {
    throw new Error("yt-dlp failed: ERROR: Requested content is not available");
  };
  await expect(
    identify(
      { url: "https://www.instagram.com/reel/x/" },
      { tmdb, seerr, readVideo, llm: notCalled },
    ),
  ).rejects.toThrow("Requested content is not available");
});

test("Seerr being down leaves the Candidates ABSENT, without failing", async () => {
  fakeFetch({ "/3/movie/693134": dune, "/api/v1/movie/693134": 503 });
  const result = await identify(
    { url: "https://www.themoviedb.org/movie/693134" },
    { tmdb, seerr, readVideo: notCalled, llm: notCalled },
  );
  expect(result).toMatchObject({ status: "READY", candidates: [{ libraryState: "ABSENT" }] });
});
