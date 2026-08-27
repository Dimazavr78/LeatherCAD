import type {
  CadObject,
  DimensionObject,
  DimensionReference,
  DimensionType,
  PathObject,
  Point,
} from "../../types/cad";
import {
  distance,
  normalizeSweep,
  pointOnCircle,
} from "../geometry/geometryMath";
import { createPath, getPathLength } from "../geometry/pathMath";

export interface Measurement {
  distance: number;
  deltaX: number;
  deltaY: number;
  angle: number;
}

export interface SnapAnchor {
  point: Point;
  reference: DimensionReference;
  kind: "endpoint" | "center" | "vertex";
}

export function measurePoints(a: Point, b: Point): Measurement {
  const deltaX = b.x - a.x;
  const deltaY = b.y - a.y;
  return {
    distance: Math.hypot(deltaX, deltaY),
    deltaX,
    deltaY,
    angle: (Math.atan2(deltaY, deltaX) * 180) / Math.PI,
  };
}

export function getObjectAnchors(object: PathObject): SnapAnchor[] {
  const reference = (
    anchor: DimensionReference["anchor"],
    point: Point,
    kind: SnapAnchor["kind"],
  ): SnapAnchor => ({
    point,
    kind,
    reference: { objectId: object.id, anchor },
  });
  if (object.type === "line")
    return [
      reference("start", { x: object.x1, y: object.y1 }, "endpoint"),
      reference("end", { x: object.x2, y: object.y2 }, "endpoint"),
    ];
  if (object.type === "rectangle")
    return [
      reference("top-left", { x: object.x, y: object.y }, "vertex"),
      reference(
        "top-right",
        { x: object.x + object.width, y: object.y },
        "vertex",
      ),
      reference(
        "bottom-right",
        { x: object.x + object.width, y: object.y + object.height },
        "vertex",
      ),
      reference(
        "bottom-left",
        { x: object.x, y: object.y + object.height },
        "vertex",
      ),
    ];
  if (object.type === "polyline")
    return object.points.map((point, vertexIndex) => ({
      point,
      kind: "vertex",
      reference: { objectId: object.id, anchor: "point", vertexIndex },
    }));
  return [reference("center", { x: object.cx, y: object.cy }, "center")];
}

export function resolveDimensionReference(
  reference: DimensionReference,
  objects: CadObject[],
): Point | null {
  if (!reference.objectId) return reference.point ?? null;
  const object = objects.find(
    (candidate) => candidate.id === reference.objectId,
  );
  if (!object || object.type === "stitch" || object.type === "dimension")
    return reference.point ?? null;
  if (object.type === "line")
    return reference.anchor === "end"
      ? { x: object.x2, y: object.y2 }
      : { x: object.x1, y: object.y1 };
  if (object.type === "rectangle") {
    const right =
      reference.anchor === "top-right" || reference.anchor === "bottom-right";
    const bottom =
      reference.anchor === "bottom-left" || reference.anchor === "bottom-right";
    return {
      x: object.x + (right ? object.width : 0),
      y: object.y + (bottom ? object.height : 0),
    };
  }
  if (object.type === "polyline") {
    if (reference.vertexIndex !== undefined)
      return object.points[reference.vertexIndex] ?? null;
    if (reference.point) {
      let nearest = object.points[0];
      let best = Infinity;
      for (const point of object.points) {
        const current = distance(point, reference.point);
        if (current < best) {
          best = current;
          nearest = point;
        }
      }
      return nearest ?? null;
    }
    return (
      object.points[
        reference.anchor === "end" ? object.points.length - 1 : 0
      ] ?? null
    );
  }
  return { x: object.cx, y: object.cy };
}

export function getDimensionValue(
  dimension: DimensionObject,
  objects: CadObject[],
): number {
  const source = dimension.referenceA.objectId
    ? objects.find((object) => object.id === dimension.referenceA.objectId)
    : null;
  if (
    dimension.dimensionType === "radius" &&
    source &&
    (source.type === "circle" || source.type === "arc")
  )
    return source.radius;
  if (dimension.dimensionType === "diameter" && source?.type === "circle")
    return source.radius * 2;
  if (dimension.dimensionType === "arc-length" && source?.type === "arc")
    return (
      (source.radius *
        normalizeSweep(source.startAngle, source.endAngle) *
        Math.PI) /
      180
    );
  const a = resolveDimensionReference(dimension.referenceA, objects);
  const b = dimension.referenceB
    ? resolveDimensionReference(dimension.referenceB, objects)
    : null;
  if (!a || !b) return 0;
  if (dimension.dimensionType === "horizontal") return Math.abs(b.x - a.x);
  if (dimension.dimensionType === "vertical") return Math.abs(b.y - a.y);
  return distance(a, b);
}

export function getPathMeasurement(object: PathObject): number {
  const path = createPath(object);
  return path ? getPathLength(path) : 0;
}

export function getRadialEnd(
  dimension: DimensionObject,
  objects: CadObject[],
): Point | null {
  const source = objects.find(
    (object) => object.id === dimension.referenceA.objectId,
  );
  if (!source || (source.type !== "circle" && source.type !== "arc"))
    return null;
  const angle =
    source.type === "arc"
      ? source.startAngle +
        normalizeSweep(source.startAngle, source.endAngle) / 2
      : -45;
  return pointOnCircle({ x: source.cx, y: source.cy }, source.radius, angle);
}

export function supportsDimensionType(
  type: DimensionType,
  object: CadObject | undefined,
): boolean {
  if (type === "radius")
    return object?.type === "circle" || object?.type === "arc";
  if (type === "diameter") return object?.type === "circle";
  if (type === "arc-length") return object?.type === "arc";
  return true;
}
