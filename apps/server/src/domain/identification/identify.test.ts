import { afterEach, expect, mock, test } from "bun:test";
import { openDatabase } from "../../db";
import { Tmdb } from "../../integrations/tmdb/client";
import {
  getFindByIdResponseMock,
  getMovieDetailsResponseMock,
} from "../../integrations/tmdb/gen/tmdb.faker";
import { fakeFetch } from "../../testing/fake-fetch";
import { SettingsRepository } from "../settings/repository";
import type { Video } from "./extractors/video";
import { identify } from "./identify";

afterEach(() => mock.restore());

const settings = new SettingsRepository(await openDatabase(":memory:"));
await settings.update({ identification: { tmdbToken: "tok" } });
const tmdb = new Tmdb(settings);

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
const noVideo = async (): Promise<Video> => {
  throw new Error("readVideo should not be called");
};

test("an IMDb link gives a certain Candidate, without reading any video", async () => {
  fakeFetch({ "/3/find/tt15239678": getFindByIdResponseMock({ movie_results: [dune] }) });

  const result = await identify(
    { url: "https://www.imdb.com/title/tt15239678/" },
    { tmdb, readVideo: noVideo },
  );

  expect(result).toMatchObject({ status: "READY", method: "DIRECT_ID", extractors: ["id-link"] });
  expect(result.candidates).toMatchObject([
    { tmdbId: 693134, title: "Dune : Deuxième partie", year: 2024 },
  ]);
  expect(result.candidates[0]?.confidence).toBeUndefined();
});

test("a TMDB link works the same way", async () => {
  fakeFetch({ "/3/movie/693134": dune });
  const result = await identify(
    { url: "https://www.themoviedb.org/movie/693134" },
    { tmdb, readVideo: noVideo },
  );
  expect(result.candidates.map((c) => c.title)).toEqual(["Dune : Deuxième partie"]);
});

test("a reel gives its caption and author as clues (no candidates until the LLM, #16)", async () => {
  const result = await identify(
    { url: "https://www.instagram.com/reel/DeHYOAbo14f/" },
    { tmdb, readVideo: async () => reel },
  );
  expect(result).toEqual({
    status: "NO_MATCH",
    extractors: ["video"],
    clues: { caption: "tu as du choix sur Netflix", author: "CameraCam" },
    candidates: [],
  });
});

test("a video that cannot be read fails the Identification with the reason", async () => {
  const readVideo = async (): Promise<Video> => {
    throw new Error("yt-dlp failed: ERROR: Requested content is not available");
  };
  await expect(
    identify({ url: "https://www.instagram.com/reel/x/" }, { tmdb, readVideo }),
  ).rejects.toThrow("Requested content is not available");
});
