import { expect, test } from "bun:test";
import { inViewFirst } from "./pictures";

const slides = ["cover.jpg", "hating-game.jpg", "set-it-up.jpg"];

test("a carousel shared from its third picture puts that picture first", () => {
  const url = "https://www.instagram.com/p/DeMojWljSKo/?img_index=3&dlrf=N2pheGRhOTFqZGJn";
  expect(inViewFirst(url, slides)).toEqual({
    pictureUrls: ["set-it-up.jpg", "cover.jpg", "hating-game.jpg"],
    firstInView: true,
  });
});

test("a link without img_index keeps the carousel's order", () => {
  const url = "https://www.instagram.com/p/DeMojWljSKo/?xtok=N2pheGRhOTFqZGJn";
  expect(inViewFirst(url, slides)).toEqual({ pictureUrls: slides, firstInView: false });
});

test("an img_index past the last picture is ignored", () => {
  const url = "https://www.instagram.com/p/DeMojWljSKo/?img_index=8";
  expect(inViewFirst(url, slides)).toEqual({ pictureUrls: slides, firstInView: false });
});
