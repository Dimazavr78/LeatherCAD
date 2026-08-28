import type { CadObject, HoleObject, PathObject, Point } from "../../types/cad";
import { createPath, type CadPath } from "../geometry/pathMath";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getObjectBounds(object: PathObject): Bounds {
  if (object.type === "rectangle")
    return {
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
    };
  if (object.type === "circle" || object.type === "arc")
    return {
      x: object.cx - object.radius,
      y: object.cy - object.radius,
      width: object.radius * 2,
      height: object.radius * 2,
    };
  const points =
    object.type === "line"
      ? [
          { x: object.x1, y: object.y1 },
          { x: object.x2, y: object.y2 },
        ]
      : object.points;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

export function resolveHoleCenter(
  hole: HoleObject,
  objects: CadObject[],
): Point | null {
  const directHost = objects.find((object) => object.id === hole.hostObjectId);
  const partHost =
    directHost?.type === "part"
      ? objects.find((object) => object.id === directHost.contourSourceId)
      : directHost;
  const host = objects.find(
    (object): object is PathObject =>
      object.id === partHost?.id &&
      (object.type === "rectangle" ||
        object.type === "circle" ||
        (object.type === "polyline" && object.closed)),
  );
  if (!host) return null;
  const bounds = getObjectBounds(host);
  if (hole.position.mode === "absolute")
    return { x: hole.position.x, y: hole.position.y };
  if (hole.position.mode === "relative")
    return {
      x: bounds.x + bounds.width * hole.position.xRatio,
      y: bounds.y + bounds.height * hole.position.yRatio,
    };
  return {
    x:
      hole.position.fromX === "left"
        ? bounds.x + hole.position.offsetX
        : bounds.x + bounds.width - hole.position.offsetX,
    y:
      hole.position.fromY === "top"
        ? bounds.y + hole.position.offsetY
        : bounds.y + bounds.height - hole.position.offsetY,
  };
}

export function moveHole(
  hole: HoleObject,
  objects: CadObject[],
  point: Point,
): HoleObject {
  const directHost = objects.find((object) => object.id === hole.hostObjectId);
  const partHost =
    directHost?.type === "part"
      ? objects.find((object) => object.id === directHost.contourSourceId)
      : directHost;
  const host = objects.find(
    (object): object is PathObject =>
      object.id === partHost?.id &&
      object.type !== "line" &&
      object.type !== "arc",
  );
  if (!host) return hole;
  const bounds = getObjectBounds(host);
  const halfWidth = hole.shape === "circle" ? hole.radius : hole.width / 2;
  const halfHeight = hole.shape === "circle" ? hole.radius : hole.height / 2;
  const constrained = hole.constrainToHost
    ? {
        x: Math.max(
          bounds.x + halfWidth,
          Math.min(bounds.x + bounds.width - halfWidth, point.x),
        ),
        y: Math.max(
          bounds.y + halfHeight,
          Math.min(bounds.y + bounds.height - halfHeight, point.y),
        ),
      }
    : point;
  if (hole.position.mode === "relative")
    return {
      ...hole,
      position: {
        mode: "relative",
        xRatio: (constrained.x - bounds.x) / bounds.width,
        yRatio: (constrained.y - bounds.y) / bounds.height,
      },
    };
  if (hole.position.mode === "offset")
    return {
      ...hole,
      position: {
        ...hole.position,
        offsetX:
          hole.position.fromX === "left"
            ? constrained.x - bounds.x
            : bounds.x + bounds.width - constrained.x,
        offsetY:
          hole.position.fromY === "top"
            ? constrained.y - bounds.y
            : bounds.y + bounds.height - constrained.y,
      },
    };
  return {
    ...hole,
    position: { mode: "absolute", x: constrained.x, y: constrained.y },
  };
}

export function setHoleCornerRadius(
  hole: HoleObject,
  requestedRadius: number,
  step = 0.5,
): HoleObject {
  return {
    ...hole,
    cornerRadius: Math.min(
      Math.min(hole.width, hole.height) / 2,
      Math.max(0, Math.round(requestedRadius / step) * step),
    ),
  };
}

export function createHolePath(
  hole: HoleObject,
  objects: CadObject[],
  outwardOffset = 0,
): CadPath | null {
  const center = resolveHoleCenter(hole, objects);
  if (!center) return null;
  let path: CadPath | null;
  if (hole.shape === "circle")
    path = createPath({
      id: hole.id,
      type: "circle",
      cx: center.x,
      cy: center.y,
      radius: hole.radius + outwardOffset,
    });
  else {
    const width = hole.width + outwardOffset * 2;
    const height = hole.height + outwardOffset * 2;
    const radius =
      hole.shape === "slot"
        ? height / 2
        : Math.min(hole.cornerRadius + outwardOffset, width / 2, height / 2);
    path = createPath({
      id: hole.id,
      type: "rectangle",
      x: center.x - width / 2,
      y: center.y - height / 2,
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
  }
  if (!path || !hole.rotation) return path;
  const radians = (hole.rotation * Math.PI) / 180;
  const rotate = (point: Point): Point => ({
    x:
      center.x +
      (point.x - center.x) * Math.cos(radians) -
      (point.y - center.y) * Math.sin(radians),
    y:
      center.y +
      (point.x - center.x) * Math.sin(radians) +
      (point.y - center.y) * Math.cos(radians),
  });
  return {
    ...path,
    segments: path.segments.map((segment) =>
      segment.type === "line"
        ? { ...segment, start: rotate(segment.start), end: rotate(segment.end) }
        : {
            ...segment,
            start: rotate(segment.start),
            end: rotate(segment.end),
            center: rotate(segment.center),
          },
    ),
  };
}

export function isPointInHost(
  point: Point,
  object: CadObject,
): object is PathObject {
  if (object.type === "rectangle")
    return (
      point.x >= object.x &&
      point.x <= object.x + object.width &&
      point.y >= object.y &&
      point.y <= object.y + object.height
    );
  if (object.type === "circle")
    return (
      Math.hypot(point.x - object.cx, point.y - object.cy) <= object.radius
    );
  if (object.type !== "polyline" || !object.closed) return false;
  let inside = false;
  for (
    let i = 0, j = object.points.length - 1;
    i < object.points.length;
    j = i++
  ) {
    const a = object.points[i],
      b = object.points[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
