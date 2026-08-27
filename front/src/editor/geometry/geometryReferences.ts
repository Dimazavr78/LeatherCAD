import type {
  CadObject,
  GeometryReference,
  PathObject,
  Point,
} from "../../types/cad";
import { pointOnCircle } from "./geometryMath";

export interface GeometryAnchorPoint {
  point: Point;
  reference: GeometryReference;
  kind: "endpoint" | "center" | "vertex" | "edge";
}

export function resolveGeometryReference(
  reference: GeometryReference,
  objects: CadObject[],
): Point | null {
  if (!reference.objectId) return reference.point ?? null;
  const object = objects.find((item) => item.id === reference.objectId);
  if (
    !object ||
    object.type === "stitch" ||
    object.type === "dimension" ||
    object.type === "hole"
  )
    return reference.point ?? null;
  if (object.type === "line") {
    if (reference.anchor === "center")
      return { x: (object.x1 + object.x2) / 2, y: (object.y1 + object.y2) / 2 };
    return reference.anchor === "end"
      ? { x: object.x2, y: object.y2 }
      : { x: object.x1, y: object.y1 };
  }
  if (object.type === "rectangle") {
    const horizontal =
      reference.anchor === "right" ||
      reference.anchor === "top-right" ||
      reference.anchor === "bottom-right"
        ? 1
        : reference.anchor === "center" ||
            reference.anchor === "top" ||
            reference.anchor === "bottom"
          ? 0.5
          : 0;
    const vertical =
      reference.anchor === "bottom" ||
      reference.anchor === "bottom-left" ||
      reference.anchor === "bottom-right"
        ? 1
        : reference.anchor === "center" ||
            reference.anchor === "left" ||
            reference.anchor === "right"
          ? 0.5
          : 0;
    return {
      x: object.x + object.width * horizontal,
      y: object.y + object.height * vertical,
    };
  }
  if (object.type === "polyline") {
    const index = reference.index ?? reference.vertexIndex ?? 0;
    if (reference.anchor === "edge") {
      const a = object.points[index];
      const b = object.points[(index + 1) % object.points.length];
      return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
    }
    return object.points[index] ?? null;
  }
  const center = { x: object.cx, y: object.cy };
  if (reference.anchor === "center") return center;
  if (object.type === "arc") {
    if (reference.anchor === "start")
      return pointOnCircle(center, object.radius, object.startAngle);
    if (reference.anchor === "end")
      return pointOnCircle(center, object.radius, object.endAngle);
  }
  const angle =
    reference.anchor === "left"
      ? 180
      : reference.anchor === "top"
        ? -90
        : reference.anchor === "bottom"
          ? 90
          : 0;
  return pointOnCircle(center, object.radius, angle);
}

export function getGeometryAnchors(object: PathObject): GeometryAnchorPoint[] {
  const anchor = (
    name: GeometryReference["anchor"],
    kind: GeometryAnchorPoint["kind"] = "vertex",
    index?: number,
  ): GeometryAnchorPoint => ({
    point: resolveGeometryReference(
      { objectId: object.id, anchor: name, index },
      [object],
    )!,
    reference: { objectId: object.id, anchor: name, index },
    kind,
  });
  if (object.type === "rectangle")
    return [
      anchor("center", "center"),
      anchor("top-left"),
      anchor("top-right"),
      anchor("bottom-right"),
      anchor("bottom-left"),
      anchor("left", "edge"),
      anchor("right", "edge"),
      anchor("top", "edge"),
      anchor("bottom", "edge"),
    ];
  if (object.type === "line")
    return [
      anchor("start", "endpoint"),
      anchor("end", "endpoint"),
      anchor("center", "center"),
    ];
  if (object.type === "polyline")
    return object.points.flatMap((_, index) => [
      anchor("vertex", "vertex", index),
      ...(object.closed || index < object.points.length - 1
        ? [anchor("edge", "edge", index)]
        : []),
    ]);
  if (object.type === "arc")
    return [
      anchor("center", "center"),
      anchor("start", "endpoint"),
      anchor("end", "endpoint"),
    ];
  return [
    anchor("center", "center"),
    anchor("left", "endpoint"),
    anchor("right", "endpoint"),
    anchor("top", "endpoint"),
    anchor("bottom", "endpoint"),
  ];
}
