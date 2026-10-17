/// <reference types="bun" />

import { expect, test } from "bun:test";
import { create } from "@bufbuild/protobuf";
import { SyncCollectionResponseSchema } from "@spotarr/contract";
import { describeSync } from "./collection";

const result = (fields: object) =>
  create(SyncCollectionResponseSchema, { collection: "Spotted", ...fields });

test("a sync says what it changed, and what it left out", () => {
  expect(
    describeSync(result({ titles: 3, added: 1, removed: 2, watched: 4, notInJellyfin: 1 })),
  ).toBe("3 titles in Spotted: 1 added, 2 removed. 4 watched, 1 not in Jellyfin yet.");
});

test("a sync with nothing to do says so", () => {
  expect(describeSync(result({ titles: 1 }))).toBe("1 title in Spotted, nothing to change.");
  expect(describeSync(result({}))).toBe("0 titles in Spotted, nothing to change.");
});
