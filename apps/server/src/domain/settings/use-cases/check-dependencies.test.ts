import { afterEach, expect, mock, test } from "bun:test";
import { getGetMovieMovieIdResponseMock } from "../../../integrations/seerr/gen/seerr.faker";
import { getMovieDetailsResponseMock } from "../../../integrations/tmdb/gen/tmdb.faker";
import { fakeFetch } from "../../../testing/fake-fetch";
import { SettingsSchema } from "../schema";
import { checkDependencies } from "./check-dependencies";

afterEach(() => mock.restore());

const settings = SettingsSchema.parse({
  identification: { llmApiKey: "llm-key", tmdbToken: "tmdb-token" },
  seerr: { url: "http://seerr.test", apiKey: "wrong-key" },
});

const llmAnswer = {
  id: "1",
  object: "chat.completion",
  created: 0,
  model: "m",
  choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "ok" } }],
};

test("a wrong Seerr key shows Seerr in error, the others still answer", async () => {
  fakeFetch({
    "/api/v1/chat/completions": llmAnswer,
    "/3/movie/550": getMovieDetailsResponseMock({ id: 550 }),
    "/api/v1/movie/550": 401,
  });

  const dependencies = await checkDependencies(settings);

  expect(dependencies.slice(0, 3)).toEqual([
    { name: "LLM", state: "OK", detail: "google/gemini-3.8-flash" },
    { name: "TMDB", state: "OK", detail: "fr-FR" },
    { name: "Seerr", state: "ERROR", detail: "Seerr refused the API key (401)" },
  ]);
  // ffmpeg is installed wherever tests run (CI included); yt-dlp may not be.
  expect(dependencies.find((d) => d.name === "ffmpeg")?.state).toBe("OK");
});

test("empty settings are NOT_CONFIGURED, without calling anything", async () => {
  fakeFetch({});
  const dependencies = await checkDependencies(SettingsSchema.parse({}));
  expect(dependencies.slice(0, 3).map((d) => [d.name, d.state])).toEqual([
    ["LLM", "NOT_CONFIGURED"],
    ["TMDB", "NOT_CONFIGURED"],
    ["Seerr", "NOT_CONFIGURED"],
  ]);
});

test("Seerr answering fine is OK", async () => {
  fakeFetch({
    "/api/v1/chat/completions": llmAnswer,
    "/3/movie/550": getMovieDetailsResponseMock({ id: 550 }),
    "/api/v1/movie/550": getGetMovieMovieIdResponseMock({ mediaInfo: undefined }),
  });
  const dependencies = await checkDependencies(settings);
  expect(dependencies.find((d) => d.name === "Seerr")).toEqual({
    name: "Seerr",
    state: "OK",
    detail: "http://seerr.test",
  });
});

test("Jellyfin is listed only once its URL is set, and needs its user", async () => {
  fakeFetch({
    "/api/v1/chat/completions": llmAnswer,
    "/3/movie/550": getMovieDetailsResponseMock({ id: 550 }),
    "/api/v1/movie/550": getGetMovieMovieIdResponseMock({ mediaInfo: undefined }),
    "/System/Info": { Version: "12.2.0" },
    "/Users": [{ Name: "Mathieu", Id: "u1" }],
  });
  const jellyfinOf = async (jellyfin: object) => {
    const dependencies = await checkDependencies(SettingsSchema.parse({ ...settings, jellyfin }));
    return dependencies.find((d) => d.name === "Jellyfin");
  };
  const connection = { url: "http://jellyfin.test", apiKey: "key" };

  expect(await jellyfinOf({})).toBeUndefined();
  expect(await jellyfinOf({ url: "http://jellyfin.test" })).toMatchObject({
    state: "NOT_CONFIGURED",
  });
  expect(await jellyfinOf({ ...connection, user: "mathieu" })).toEqual({
    name: "Jellyfin",
    state: "OK",
    detail: "12.2.0, mathieu",
  });
  expect(await jellyfinOf({ ...connection, user: "paul" })).toEqual({
    name: "Jellyfin",
    state: "ERROR",
    detail: 'Jellyfin has no user named "paul"',
  });
});
