import assert from "node:assert/strict";
import test from "node:test";
import type {
  RectangleObject,
  SeamPairObject,
  StitchObject,
} from "../../types/cad";
import { createPath } from "../geometry/pathMath";
import { generateStitch } from "../stitch/stitchMath";
import {
  analyzeSeamPair,
  findBestFitHoleCount,
  orderStitchHoles,
} from "./seamMatch";

const rectangle: RectangleObject = {
  id: "rect",
  type: "rectangle",
  x: 0,
  y: 0,
  width: 20,
  height: 10,
  cornerRadii: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
  linkCorners: true,
};
const stitch = (id: string, spacing = 5): StitchObject => ({
  id,
  type: "stitch",
  sourceObjectId: rectangle.id,
  offset: 0,
  spacing,
  holeSize: 1,
  holeShape: "round",
  holeAngle: 0,
  mode: "fit-evenly",
  alignment: "start",
  cornerMode: "continuous",
  maxSpacingDeviation: 5,
  showLine: true,
  showHoles: true,
  startHoleIndex: 0,
  direction: "forward",
  backstitchCount: 0,
  showHoleNumbers: false,
});
const seam: SeamPairObject = {
  id: "seam",
  type: "seamPair",
  name: "Seam 1",
  stitchAId: "a",
  stitchBId: "b",
  directionA: "forward",
  directionB: "forward",
  alignment: "start",
  startHoleA: 0,
  startHoleB: 0,
  tolerance: 0.5,
};

test("start hole rotation and reverse direction preserve the selected first hole", () => {
  const generated = generateStitch(createPath(rectangle), stitch("a"));
  const forward = orderStitchHoles(generated, 2, "forward");
  const reverse = orderStitchHoles(generated, 2, "reverse");
  assert.equal(forward[0].sourceIndex, 2);
  assert.equal(reverse[0].sourceIndex, 2);
  assert.equal(forward[1].sourceIndex, 3);
  assert.equal(reverse[1].sourceIndex, 1);
  assert.equal(forward.at(-1)?.normalizedPosition, 1);
});

test("perfect seams map holes and are compatible", () => {
  const result = analyzeSeamPair(seam, [rectangle, stitch("a"), stitch("b")]);
  assert.equal(result.holeCountA, result.holeCountB);
  assert.equal(result.maxDeviation, 0);
  assert.equal(result.averageDeviation, 0);
  assert.equal(result.compatible, true);
});

test("different hole counts are incompatible", () => {
  const result = analyzeSeamPair(seam, [
    rectangle,
    stitch("a"),
    stitch("b", 6),
  ]);
  assert.notEqual(result.holeCountA, result.holeCountB);
  assert.equal(result.compatible, false);
});

test("best fit minimizes maximum requested spacing deviation", () => {
  const result = findBestFitHoleCount(120, 118, 3.4, 3.4);
  assert.ok(result.holeCount >= 30);
  assert.ok(result.maxDeviationPercent < 5);
  assert.equal(result.spacingA, 120 / result.holeCount);
});
