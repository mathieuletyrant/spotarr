import { afterEach, expect, mock, test } from "bun:test";
import { openDatabase } from "../../../db";
import { Seerr } from "../../../integrations/seerr/client";
import {
  getGetMovieMovieIdResponseMock,
  getPostRequestResponseMock,
} from "../../../integrations/seerr/gen/seerr.faker";
import { fakeFetch } from "../../../testing/fake-fetch";
import { ShareRepository } from "../repository";
import { addCandidate } from "./add-candidate";

afterEach(() => mock.restore());

const seerr = new Seerr({ url: "http://seerr.test", apiKey: "key" });

// A finished Share with one Candidate, Due Date.
async function shareWithDueDate() {
  const shares = new ShareRepository(await openDatabase(":memory:"));
  const id = await shares.create({ url: "https://www.instagram.com/reel/x/" }, "instagram.com");
  await shares.finish(
    id,
    {
      status: "READY",
      method: "LLM",
      extractors: ["video"],
      clues: {},
      candidates: [
        {
          tmdbId: 41733,
          type: "MOVIE",
          title: "Date limite",
          confidence: 0.9,
          libraryState: "ABSENT",
        },
      ],
    },
    10,
  );
  return { shares, id };
}
const dueDate = { tmdbId: 41733, type: "MOVIE" as const };

test("an absent Candidate is requested from Seerr", async () => {
  const { shares, id } = await shareWithDueDate();
  const fetch = fakeFetch({
    "/api/v1/movie/41733": getGetMovieMovieIdResponseMock({ mediaInfo: undefined }),
    "/api/v1/request": getPostRequestResponseMock(),
  });

  const added: string[] = [];
  const mediaAdded = async (_share: unknown, candidate: { title: string }) => {
    added.push(candidate.title);
  };
  await addCandidate(id, dueDate, { shares, seerr, mediaAdded });

  const share = await shares.get(id);
  expect(share?.additions).toMatchObject([{ tmdbId: 41733, target: "SEERR", status: "REQUESTED" }]);
  expect(added).toEqual(["Date limite"]); // the media.added Event
  expect(share?.summary).toBe("REQUESTED");
  expect(fetch.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
    "/api/v1/movie/41733",
    "/api/v1/request",
  ]);
});

test("a Candidate already in the library is not requested again", async () => {
  const { shares, id } = await shareWithDueDate();
  fakeFetch({
    "/api/v1/movie/41733": getGetMovieMovieIdResponseMock({ mediaInfo: { status: 5 } }),
  });

  let added = false;
  await addCandidate(id, dueDate, {
    shares,
    seerr,
    mediaAdded: async () => {
      added = true;
    },
  });

  expect((await shares.get(id))?.additions.map((a) => a.status)).toEqual(["ALREADY_PRESENT"]);
  expect(added).toBe(false);
});

test("Seerr failing is recorded as a failed Addition, with the reason", async () => {
  const { shares, id } = await shareWithDueDate();
  fakeFetch({ "/api/v1/movie/41733": 503 });

  await addCandidate(id, dueDate, { shares, seerr });

  const share = await shares.get(id);
  expect(share?.additions).toMatchObject([{ status: "FAILED", error: "Seerr answered 503" }]);
  expect(share?.summary).toBe("FAILED");
});

test("only a Candidate of the Share can be added", async () => {
  const { shares, id } = await shareWithDueDate();
  await expect(
    addCandidate(id, { tmdbId: 1, type: "MOVIE" }, { shares, seerr }),
  ).rejects.toMatchObject({ code: "not_found" });
  await expect(addCandidate("shr_x", dueDate, { shares, seerr })).rejects.toMatchObject({
    code: "not_found",
  });
});
