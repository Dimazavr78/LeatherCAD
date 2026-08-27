import type { PathObject, Point } from "../../types/cad";
import { distance, normalizeSweep, pointOnCircle } from "./geometryMath";
export interface PathSample {
  point: Point;
  tangent: Point;
  distance: number;
  corner?: boolean;
}
export interface CadPath {
  points: Point[];
  closed: boolean;
  kind: "segments" | "circle" | "arc";
  center?: Point;
  radius?: number;
  startAngle?: number;
  sweepAngle?: number;
}
function offsetSegments(
  points: Point[],
  closed: boolean,
  offset: number,
): Point[] {
  if (!offset || points.length < 2) return points.map((p) => ({ ...p }));
  return points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const a = !closed && index === 0 ? point : previous;
    const b = !closed && index === points.length - 1 ? point : next;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    return {
      x: point.x + (-dy / length) * offset,
      y: point.y + (dx / length) * offset,
    };
  });
}
export function createPath(object: PathObject, offset = 0): CadPath | null {
  if (object.type === "rectangle") {
    const x = object.x + offset;
    const y = object.y + offset;
    const width = object.width - offset * 2;
    const height = object.height - offset * 2;
    if (width <= 0 || height <= 0) return null;
    return {
      kind: "segments",
      closed: true,
      points: [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ],
    };
  }
  if (object.type === "line")
    return {
      kind: "segments",
      closed: false,
      points: offsetSegments(
        [
          { x: object.x1, y: object.y1 },
          { x: object.x2, y: object.y2 },
        ],
        false,
        offset,
      ),
    };
  if (object.type === "polyline")
    return {
      kind: "segments",
      closed: object.closed,
      points: offsetSegments(
        object.points,
        object.closed,
        object.closed ? -offset : offset,
      ),
    };
  const radius = object.radius - offset;
  if (radius <= 0) return null;
  if (object.type === "circle")
    return {
      kind: "circle",
      closed: true,
      points: [],
      center: { x: object.cx, y: object.cy },
      radius,
    };
  return {
    kind: "arc",
    closed: false,
    points: [],
    center: { x: object.cx, y: object.cy },
    radius,
    startAngle: object.startAngle,
    sweepAngle: normalizeSweep(object.startAngle, object.endAngle),
  };
}
export function getPathLength(path: CadPath): number {
  if (path.kind === "circle") return 2 * Math.PI * (path.radius ?? 0);
  if (path.kind === "arc")
    return (((path.sweepAngle ?? 0) * Math.PI) / 180) * (path.radius ?? 0);
  let result = 0;
  const count = path.closed ? path.points.length : path.points.length - 1;
  for (let i = 0; i < count; i += 1)
    result += distance(
      path.points[i],
      path.points[(i + 1) % path.points.length],
    );
  return result;
}
export function getPointAtDistance(
  path: CadPath,
  requested: number,
): PathSample {
  const length = getPathLength(path);
  const value =
    path.closed && length
      ? ((requested % length) + length) % length
      : Math.max(0, Math.min(length, requested));
  if (path.kind !== "segments") {
    const radius = path.radius ?? 0;
    const angle =
      (path.kind === "arc" ? (path.startAngle ?? 0) : 0) +
      (radius ? ((value / radius) * 180) / Math.PI : 0);
    return {
      point: pointOnCircle(path.center ?? { x: 0, y: 0 }, radius, angle),
      tangent: pointOnCircle({ x: 0, y: 0 }, 1, angle + 90),
      distance: value,
    };
  }
  let walked = 0;
  const count = path.closed ? path.points.length : path.points.length - 1;
  for (let i = 0; i < count; i += 1) {
    const a = path.points[i];
    const b = path.points[(i + 1) % path.points.length];
    const segment = distance(a, b);
    if (walked + segment >= value || i === count - 1) {
      const ratio = segment ? (value - walked) / segment : 0;
      return {
        point: { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio },
        tangent: {
          x: (b.x - a.x) / (segment || 1),
          y: (b.y - a.y) / (segment || 1),
        },
        distance: value,
        corner: Math.abs(value - walked) < 1e-5,
      };
    }
    walked += segment;
  }
  return {
    point: path.points[0] ?? { x: 0, y: 0 },
    tangent: { x: 1, y: 0 },
    distance: value,
  };
}
export function getCornerDistances(path: CadPath): number[] {
  if (path.kind !== "segments") return [];
  const result = [0];
  let walked = 0;
  const count = path.closed ? path.points.length : path.points.length - 1;
  for (let i = 0; i < count; i += 1) {
    walked += distance(
      path.points[i],
      path.points[(i + 1) % path.points.length],
    );
    if (i < count - 1) result.push(walked);
  }
  return result;
}
