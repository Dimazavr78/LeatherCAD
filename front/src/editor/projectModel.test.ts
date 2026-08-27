import assert from "node:assert/strict";
import test from "node:test";
import type { DimensionObject, EditorLevel, StitchObject } from "../types/cad";
import {
  DEFAULT_LAYER_IDS,
  getAutomaticLayerId,
  getLevelPath,
  ROOT_LEVEL_ID,
} from "./projectModel";

test("specialized objects use their automatic layers", () => {
  const stitch = { type: "stitch" } as StitchObject;
  const dimension = { type: "dimension" } as DimensionObject;
  assert.equal(getAutomaticLayerId(stitch, "custom"), DEFAULT_LAYER_IDS.stitch);
  assert.equal(
    getAutomaticLayerId(dimension, "custom"),
    DEFAULT_LAYER_IDS.dimensions,
  );
});

test("level path follows parents from root to current context", () => {
  const levels: EditorLevel[] = [
    { id: ROOT_LEVEL_ID, name: "Project", parentId: null },
    { id: "front", name: "Front", parentId: ROOT_LEVEL_ID },
    { id: "pocket", name: "Pocket", parentId: "front" },
  ];
  assert.deepEqual(
    getLevelPath(levels, "pocket").map((level) => level.name),
    ["Project", "Front", "Pocket"],
  );
});
