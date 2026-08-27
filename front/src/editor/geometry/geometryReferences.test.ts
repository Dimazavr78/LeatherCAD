import assert from "node:assert/strict";
import test from "node:test";
import type { RectangleObject } from "../../types/cad";
import {
  getGeometryAnchors,
  resolveGeometryReference,
} from "./geometryReferences";

const rectangle: RectangleObject = {
  id: "r",
  type: "rectangle",
  x: 10,
  y: 20,
  width: 100,
  height: 70,
  linkCorners: true,
  cornerRadii: { topLeft: 10, topRight: 10, bottomRight: 10, bottomLeft: 10 },
};

test("rounded rectangle keeps logical bounding-box anchors", () => {
  assert.deepEqual(
    resolveGeometryReference({ objectId: "r", anchor: "top-left" }, [
      rectangle,
    ]),
    { x: 10, y: 20 },
  );
  assert.equal(getGeometryAnchors(rectangle).length, 9);
});
