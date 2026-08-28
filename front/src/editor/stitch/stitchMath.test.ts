import assert from "node:assert/strict";
import test from "node:test";
import type { RectangleObject, StitchObject } from "../../types/cad";
import { createPath, getPathLength } from "../geometry/pathMath";
import { generateStitch } from "./stitchMath";

const rectangle: RectangleObject = {
  id: "rectangle",
  type: "rectangle",
  x: 0,
  y: 0,
  width: 100,
  height: 70,
  cornerRadii: {
    topLeft: 0,
    topRight: 0,
    bottomRight: 0,
    bottomLeft: 0,
  },
  linkCorners: true,
};

const parameters: StitchObject = {
  id: "stitch",
  type: "stitch",
  sourceObjectId: rectangle.id,
  offset: 3,
  spacing: 3,
  holeSize: 1,
  holeShape: "diamond",
  holeAngle: "follow-path",
  mode: "adaptive",
  alignment: "corners",
  cornerMode: "adaptive",
  maxSpacingDeviation: 5,
  showLine: true,
  showHoles: true,
  startHoleIndex: 0,
  direction: "forward",
  backstitchCount: 0,
  showHoleNumbers: false,
};

test("rectangle offset creates the expected inner perimeter", () => {
  const path = createPath(rectangle, 3);
  assert.ok(path);
  assert.equal(getPathLength(path), 316);
  assert.deepEqual(path.segments[0].start, { x: 3, y: 3 });
});

test("adaptive corner layout anchors each rectangle corner once", () => {
  const generated = generateStitch(createPath(rectangle, 3), parameters);
  const corners = generated.holes.filter((hole) => hole.corner);
  assert.equal(corners.length, 4);
  assert.ok(generated.holes.length > 100);
  assert.ok(Math.abs(generated.actualSpacing - parameters.spacing) < 0.1);
});

test("fit evenly uses a uniform spacing based on physical path length", () => {
  const generated = generateStitch(createPath(rectangle, 3), {
    ...parameters,
    mode: "fit-evenly",
    alignment: "center",
    cornerMode: "continuous",
  });
  const expected =
    generated.pathLength /
    Math.round(generated.pathLength / parameters.spacing);
  assert.equal(generated.actualSpacing, expected);
});

test("invalid inward offset returns a structured warning", () => {
  const generated = generateStitch(createPath(rectangle, 40), parameters);
  assert.deepEqual(generated.warnings, ["offset-failed"]);
  assert.equal(generated.holes.length, 0);
});
