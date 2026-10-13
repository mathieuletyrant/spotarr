import { expect, test } from "bun:test";
import type { Share } from "../types";
import { historyPage } from "./history";

function share(id: string, summary: Share["summary"], text = ""): Share {
  return {
    id,
    createdAt: "2026-10-12T10:00:00.000Z",
    input: { text, hasImage: false },
    source: "text",
    identification: { status: "READY", extractors: [], clues: {} },
    candidates: [{ tmdbId: 1, type: "MOVIE", title: `Title of ${id}`, libraryState: "ABSENT" }],
    additions: [],
    frames: [],
    summary,
  };
}

// Newest first, like ShareRepository.all().
const history = [
  share("shr_3", "TO_CHOOSE", "the film with Cillian Murphy"),
  share("shr_2", "NO_MATCH"),
  share("shr_1", "TO_CHOOSE"),
];

test("pages follow each other with the cursor", () => {
  const first = historyPage(history, { limit: 2, summaries: [] });
  expect(first.shares.map((s) => s.id)).toEqual(["shr_3", "shr_2"]);
  expect(first.nextCursor).toBe("shr_2");

  const second = historyPage(history, { limit: 2, cursor: first.nextCursor, summaries: [] });
  expect(second.shares.map((s) => s.id)).toEqual(["shr_1"]);
  expect(second.nextCursor).toBeUndefined();
});

test("filters by Summary", () => {
  const page = historyPage(history, { limit: 10, summaries: ["TO_CHOOSE"] });
  expect(page.shares.map((s) => s.id)).toEqual(["shr_3", "shr_1"]);
});

test("searches the text and the candidates' titles, ignoring case", () => {
  expect(
    historyPage(history, { limit: 10, summaries: [], query: "cillian" }).shares.map((s) => s.id),
  ).toEqual(["shr_3"]);
  expect(
    historyPage(history, { limit: 10, summaries: [], query: "TITLE OF SHR_2" }).shares.map(
      (s) => s.id,
    ),
  ).toEqual(["shr_2"]);
});

test("counts cover the whole history, whatever the filters", () => {
  const page = historyPage(history, { limit: 1, summaries: ["NO_MATCH"] });
  expect(page.total).toBe(3);
  expect(Object.fromEntries(page.counts)).toEqual({ TO_CHOOSE: 2, NO_MATCH: 1 });
});

test("a page holds 50 Shares when no size is asked, 100 at most, and at least 1", () => {
  const many = Array.from({ length: 120 }, (_, i) =>
    share(`shr_${String(i).padStart(3, "0")}`, "TO_CHOOSE"),
  );
  expect(historyPage(many, { summaries: [] }).shares).toHaveLength(50);
  expect(historyPage(many, { limit: 500, summaries: [] }).shares).toHaveLength(100);
  expect(() => historyPage(many, { limit: 0, summaries: [] })).toThrow("page_size");
  expect(() => historyPage(many, { limit: -5, summaries: [] })).toThrow("page_size");
});
