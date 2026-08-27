import assert from "node:assert/strict";
import test from "node:test";
import type { CadObject } from "../types/cad";
import { getDependentObjectIds } from "./dependencies";

test("dependencies are collected recursively", () => {
  const objects = [
    { id: "host", type: "circle", cx: 0, cy: 0, radius: 20 },
    {
      id: "hole",
      type: "hole",
      hostObjectId: "host",
      shape: "circle",
      position: { mode: "relative", xRatio: 0.5, yRatio: 0.5 },
      width: 5,
      height: 5,
      radius: 2.5,
      cornerRadius: 0,
      rotation: 0,
      constrainToHost: true,
    },
    {
      id: "stitch",
      type: "stitch",
      sourceObjectId: "hole",
      offset: 3,
      spacing: 3,
      holeSize: 1,
      holeShape: "round",
      holeAngle: "follow-path",
      mode: "adaptive",
      alignment: "corners",
      cornerMode: "adaptive",
      maxSpacingDeviation: 5,
      showLine: true,
      showHoles: true,
    },
  ] as CadObject[];
  assert.deepEqual([...getDependentObjectIds("host", objects)].sort(), [
    "hole",
    "stitch",
  ]);
});
