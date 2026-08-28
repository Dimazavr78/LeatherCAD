import assert from "node:assert/strict";
import test from "node:test";
import type {
  CadObject,
  HoleObject,
  Material,
  PartObject,
  RectangleObject,
} from "../../types/cad";
import { getEffectiveThickness } from "../materials";
import {
  getPartArea,
  getPartOuterPerimeter,
  getPartTotalCutLength,
  validatePart,
} from "./partGeometry";

const contour: RectangleObject = {
  id: "contour",
  type: "rectangle",
  x: 0,
  y: 0,
  width: 100,
  height: 70,
  linkCorners: true,
  cornerRadii: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
};
const part: PartObject = {
  id: "part",
  type: "part",
  name: "Front Panel",
  contourSourceId: contour.id,
  materialId: "leather",
  manufacturing: {},
  exportSettings: {
    exportOuterContour: true,
    exportHoles: true,
    exportStitch: true,
  },
};
const material: Material = {
  id: "leather",
  name: "Leather",
  category: "leather",
  thickness: 1.5,
};
const hole: HoleObject = {
  id: "hole",
  type: "hole",
  hostObjectId: contour.id,
  shape: "circle",
  position: { mode: "relative", xRatio: 0.5, yRatio: 0.5 },
  width: 20,
  height: 20,
  radius: 10,
  cornerRadius: 0,
  rotation: 0,
  constrainToHost: true,
};

test("part metrics use referenced contour without copying geometry", () => {
  const objects: CadObject[] = [contour, part];
  assert.equal(getPartArea(part, objects), 7000);
  assert.equal(getPartOuterPerimeter(part, objects), 340);
});

test("holes subtract area and add their perimeter to total cut length", () => {
  const objects: CadObject[] = [contour, hole, part];
  assert.ok(Math.abs(getPartArea(part, objects) - (7000 - Math.PI * 100)) < 1e-8);
  assert.ok(Math.abs(getPartTotalCutLength(part, objects) - (340 + Math.PI * 20)) < 1e-8);
});

test("rounded rectangle area is calculated from exact arc geometry", () => {
  const rounded = {
    ...contour,
    cornerRadii: { topLeft: 10, topRight: 10, bottomRight: 10, bottomLeft: 10 },
  };
  assert.ok(
    Math.abs(getPartArea(part, [rounded, part]) - (7000 - (4 - Math.PI) * 100)) < 1e-8,
  );
});

test("effective thickness supports a per-part override", () => {
  assert.equal(getEffectiveThickness(part, [material]), 1.5);
  assert.equal(getEffectiveThickness({ ...part, thicknessOverride: 1 }, [material]), 1);
});

test("part validation detects a hole outside the contour", () => {
  const outside = {
    ...hole,
    position: { mode: "absolute" as const, x: 99, y: 69 },
  };
  const validation = validatePart(part, [contour, outside, part], [material]);
  assert.equal(validation.holesInside, false);
  assert.equal(validation.valid, false);
});
