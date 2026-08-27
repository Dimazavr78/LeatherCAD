import assert from "node:assert/strict";
import test from "node:test";
import type { HoleObject, RectangleObject } from "../../types/cad";
import {
  createHolePath,
  resolveHoleCenter,
  setHoleCornerRadius,
} from "./holeGeometry";
import { getPathLength } from "../geometry/pathMath";

const host: RectangleObject = {
  id: "host",
  type: "rectangle",
  x: 10,
  y: 20,
  width: 100,
  height: 70,
  linkCorners: true,
  cornerRadii: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
};
const hole: HoleObject = {
  id: "hole",
  type: "hole",
  hostObjectId: host.id,
  shape: "circle",
  position: { mode: "relative", xRatio: 0.5, yRatio: 0.5 },
  width: 10,
  height: 5,
  radius: 10,
  cornerRadius: 0,
  rotation: 0,
  constrainToHost: true,
};

test("relative hole remains centered in its host", () => {
  assert.deepEqual(resolveHoleCenter(hole, [host, hole]), { x: 60, y: 55 });
  assert.deepEqual(
    resolveHoleCenter(hole, [{ ...host, width: 200, height: 140 }, hole]),
    { x: 110, y: 90 },
  );
});

test("hole stitch offset expands toward host material", () => {
  const path = createHolePath(hole, [host, hole], 3)!;
  assert.ok(Math.abs(getPathLength(path) - 2 * Math.PI * 13) < 1e-8);
});

test("rectangular hole corner radius snaps and stays within its bounds", () => {
  const rectangular = {
    ...hole,
    shape: "rectangle" as const,
    width: 20,
    height: 10,
  };
  assert.equal(setHoleCornerRadius(rectangular, 2.26).cornerRadius, 2.5);
  assert.equal(setHoleCornerRadius(rectangular, 50).cornerRadius, 5);
});
