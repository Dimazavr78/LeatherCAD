import assert from "node:assert/strict";
import test from "node:test";
import type {
  ArcObject,
  CircleObject,
  DimensionObject,
  RectangleObject,
  StitchObject,
} from "../../types/cad";
import {
  driveDimensionValue,
  getDimensionValue,
  measurePoints,
} from "../dimensions/dimensionMath";
import { createPath, getPathLength, calculateVertexFillet } from "./pathMath";
import {
  changeRectangleCornerRadius,
  getRectanglePerimeter,
  normalizeRectangleCornerRadii,
} from "./rectangleGeometry";
import { generateStitch } from "../stitch/stitchMath";

const rectangle = (
  width: number,
  height: number,
  radius: number,
): RectangleObject => ({
  id: "rectangle",
  type: "rectangle",
  x: 0,
  y: 0,
  width,
  height,
  linkCorners: true,
  cornerRadii: {
    topLeft: radius,
    topRight: radius,
    bottomRight: radius,
    bottomLeft: radius,
  },
});

test("sharp and rounded rectangle paths have exact perimeters", () => {
  const sharp = rectangle(100, 70, 0);
  const rounded = rectangle(100, 70, 10);
  assert.equal(getRectanglePerimeter(sharp), 340);
  assert.ok(
    Math.abs(getRectanglePerimeter(rounded) - (260 + 20 * Math.PI)) < 1e-9,
  );
  assert.ok(
    Math.abs(
      getPathLength(createPath(rounded)!) - getRectanglePerimeter(rounded),
    ) < 1e-9,
  );
});

test("corner radius reacts to a sub-grid drag and respects linked corners", () => {
  const rounded = changeRectangleCornerRadius(
    rectangle(100, 70, 0),
    "topLeft",
    1.2,
  );

  assert.deepEqual(rounded.cornerRadii, {
    topLeft: 1,
    topRight: 1,
    bottomRight: 1,
    bottomLeft: 1,
  });
});

test("invalid rectangle radii are non-negative and side-safe", () => {
  const radii = normalizeRectangleCornerRadii(20, 20, {
    topLeft: 100,
    topRight: 100,
    bottomRight: -3,
    bottomLeft: 100,
  });
  assert.ok(radii.topLeft + radii.topRight <= 20 + 1e-9);
  assert.ok(radii.topLeft + radii.bottomLeft <= 20 + 1e-9);
  assert.equal(radii.bottomRight, 0);
});

test("polyline fillet calculates tangent points and clamps radius", () => {
  const fillet = calculateVertexFillet(
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    100,
  );
  assert.ok(fillet);
  assert.ok(fillet.radius <= fillet.maxRadius);
  assert.ok(Math.abs(fillet.radius - 5) < 1e-9);
  assert.deepEqual(fillet.tangentIn, { x: 5, y: 0 });
  assert.deepEqual(fillet.tangentOut, { x: 10, y: 5 });
  const path = createPath({
    id: "polyline",
    type: "polyline",
    closed: false,
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0, cornerRadius: 5 },
      { x: 10, y: 10 },
    ],
  });
  assert.ok(path);
  assert.ok(Math.abs(getPathLength(path) - (10 + 2.5 * Math.PI)) < 1e-9);
});

test("measurement returns distance, deltas and angle", () => {
  assert.deepEqual(measurePoints({ x: 0, y: 0 }, { x: 100, y: 0 }), {
    distance: 100,
    deltaX: 100,
    deltaY: 0,
    angle: 0,
  });
  const diagonal = measurePoints({ x: 0, y: 0 }, { x: 100, y: 100 });
  assert.ok(Math.abs(diagonal.distance - Math.sqrt(20000)) < 1e-9);
  assert.equal(diagonal.angle, 45);
});

test("horizontal, vertical and aligned dimensions update from references", () => {
  const source = rectangle(100, 70, 0);
  const base: DimensionObject = {
    id: "dimension",
    type: "dimension",
    dimensionType: "horizontal",
    referenceA: { objectId: source.id, anchor: "top-left" },
    referenceB: { objectId: source.id, anchor: "top-right" },
    offset: -10,
    precision: 2,
    showUnit: true,
  };
  assert.equal(getDimensionValue(base, [source]), 100);
  assert.equal(
    getDimensionValue(
      {
        ...base,
        dimensionType: "vertical",
        referenceB: { objectId: source.id, anchor: "bottom-left" },
      },
      [source],
    ),
    70,
  );
  assert.equal(
    getDimensionValue(
      {
        ...base,
        dimensionType: "aligned",
        referenceB: { objectId: source.id, anchor: "bottom-right" },
      },
      [source],
    ),
    Math.hypot(100, 70),
  );
  assert.equal(getDimensionValue(base, [{ ...source, width: 150 }]), 150);
  const driven = driveDimensionValue(base, source, [source, base], 150);
  assert.equal(driven?.type === "rectangle" ? driven.width : 0, 150);
});

test("circle radius/diameter and arc length dimensions are exact", () => {
  const circle: CircleObject = {
    id: "circle",
    type: "circle",
    cx: 0,
    cy: 0,
    radius: 25,
  };
  const arc: ArcObject = {
    id: "arc",
    type: "arc",
    cx: 0,
    cy: 0,
    radius: 10,
    startAngle: 0,
    endAngle: 90,
  };
  const dimension = (
    dimensionType: DimensionObject["dimensionType"],
    objectId: string,
  ): DimensionObject => ({
    id: dimensionType,
    type: "dimension",
    dimensionType,
    referenceA: { objectId, anchor: "center" },
    offset: 0,
    precision: 2,
    showUnit: true,
  });
  assert.equal(getDimensionValue(dimension("radius", circle.id), [circle]), 25);
  assert.equal(
    getDimensionValue(dimension("diameter", circle.id), [circle]),
    50,
  );
  assert.ok(
    Math.abs(
      getDimensionValue(dimension("arc-length", arc.id), [arc]) - 5 * Math.PI,
    ) < 1e-9,
  );
});

test("stitch follows rounded rectangle arc segments after radius changes", () => {
  const source = rectangle(100, 70, 10);
  const path = createPath(source, 3);
  assert.ok(path?.segments.some((segment) => segment.type === "arc"));
  const parameters: StitchObject = {
    id: "stitch",
    type: "stitch",
    sourceObjectId: source.id,
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
    startHoleIndex: 0,
    direction: "forward",
    backstitchCount: 0,
    showHoleNumbers: false,
  };
  const generated = generateStitch(path, parameters);
  assert.ok(generated.holes.length > 90);
  assert.ok(generated.holes.some((hole) => hole.angle % 90 !== 45));
});
