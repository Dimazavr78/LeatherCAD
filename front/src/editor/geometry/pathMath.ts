import type { PathObject, Point, PolylineVertex } from "../../types/cad";
import { distance, normalizeSweep, pointOnCircle } from "./geometryMath";
import { normalizeRectangleCornerRadii } from "./rectangleGeometry";

export interface LinePathSegment {
  type: "line";
  start: Point;
  end: Point;
}
export interface ArcPathSegment {
  type: "arc";
  start: Point;
  end: Point;
  center: Point;
  radius: number;
  clockwise: boolean;
}
export type PathSegment = LinePathSegment | ArcPathSegment;
export interface CadPath {
  segments: PathSegment[];
  closed: boolean;
}
export interface PathSample {
  point: Point;
  tangent: Point;
  distance: number;
  corner?: boolean;
}

const line = (start: Point, end: Point): LinePathSegment => ({
  type: "line",
  start,
  end,
});
function arc(
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number,
  clockwise = true,
): ArcPathSegment {
  return {
    type: "arc",
    center,
    radius,
    start: pointOnCircle(center, radius, startAngle),
    end: pointOnCircle(center, radius, endAngle),
    clockwise,
  };
}
function segmentSweep(segment: ArcPathSegment): number {
  const start =
    (Math.atan2(
      segment.start.y - segment.center.y,
      segment.start.x - segment.center.x,
    ) *
      180) /
    Math.PI;
  const end =
    (Math.atan2(
      segment.end.y - segment.center.y,
      segment.end.x - segment.center.x,
    ) *
      180) /
    Math.PI;
  const positive = normalizeSweep(start, end);
  return segment.clockwise ? positive : (360 - positive) % 360;
}
export function getSegmentLength(segment: PathSegment): number {
  return segment.type === "line"
    ? distance(segment.start, segment.end)
    : (segment.radius * segmentSweep(segment) * Math.PI) / 180;
}

function rectanglePath(
  object: Extract<PathObject, { type: "rectangle" }>,
  offset: number,
): CadPath | null {
  const x = object.x + offset;
  const y = object.y + offset;
  const width = object.width - offset * 2;
  const height = object.height - offset * 2;
  if (width <= 0 || height <= 0) return null;
  const source = object.cornerRadii;
  const radii = normalizeRectangleCornerRadii(width, height, {
    topLeft: Math.max(0, source.topLeft - offset),
    topRight: Math.max(0, source.topRight - offset),
    bottomRight: Math.max(0, source.bottomRight - offset),
    bottomLeft: Math.max(0, source.bottomLeft - offset),
  });
  const { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl } = radii;
  const segments: PathSegment[] = [];
  const addLine = (a: Point, b: Point) => {
    if (distance(a, b) > 1e-9) segments.push(line(a, b));
  };
  addLine({ x: x + tl, y }, { x: x + width - tr, y });
  if (tr) segments.push(arc({ x: x + width - tr, y: y + tr }, tr, -90, 0));
  addLine({ x: x + width, y: y + tr }, { x: x + width, y: y + height - br });
  if (br)
    segments.push(arc({ x: x + width - br, y: y + height - br }, br, 0, 90));
  addLine({ x: x + width - br, y: y + height }, { x: x + bl, y: y + height });
  if (bl) segments.push(arc({ x: x + bl, y: y + height - bl }, bl, 90, 180));
  addLine({ x, y: y + height - bl }, { x, y: y + tl });
  if (tl) segments.push(arc({ x: x + tl, y: y + tl }, tl, 180, 270));
  return { segments, closed: true };
}

export interface VertexFillet {
  tangentIn: Point;
  tangentOut: Point;
  center: Point;
  radius: number;
  clockwise: boolean;
  maxRadius: number;
}
export function calculateVertexFillet(
  previous: Point,
  vertex: Point,
  next: Point,
  requestedRadius: number,
): VertexFillet | null {
  const incomingLength = distance(vertex, previous);
  const outgoingLength = distance(vertex, next);
  if (incomingLength < 1e-6 || outgoingLength < 1e-6 || requestedRadius <= 0)
    return null;
  const incoming = {
    x: (previous.x - vertex.x) / incomingLength,
    y: (previous.y - vertex.y) / incomingLength,
  };
  const outgoing = {
    x: (next.x - vertex.x) / outgoingLength,
    y: (next.y - vertex.y) / outgoingLength,
  };
  const angle = Math.acos(
    Math.max(
      -1,
      Math.min(1, incoming.x * outgoing.x + incoming.y * outgoing.y),
    ),
  );
  if (angle < 1e-3 || Math.abs(Math.PI - angle) < 1e-3) return null;
  const maxTangent = Math.min(incomingLength, outgoingLength) / 2;
  const maxRadius = maxTangent * Math.tan(angle / 2);
  const radius = Math.min(requestedRadius, maxRadius);
  const tangentDistance = radius / Math.tan(angle / 2);
  const bisectorRaw = {
    x: incoming.x + outgoing.x,
    y: incoming.y + outgoing.y,
  };
  const bisectorLength = Math.hypot(bisectorRaw.x, bisectorRaw.y);
  const centerDistance = radius / Math.sin(angle / 2);
  const center = {
    x: vertex.x + (bisectorRaw.x / bisectorLength) * centerDistance,
    y: vertex.y + (bisectorRaw.y / bisectorLength) * centerDistance,
  };
  const tangentIn = {
    x: vertex.x + incoming.x * tangentDistance,
    y: vertex.y + incoming.y * tangentDistance,
  };
  const tangentOut = {
    x: vertex.x + outgoing.x * tangentDistance,
    y: vertex.y + outgoing.y * tangentDistance,
  };
  const startAngle =
    (Math.atan2(tangentIn.y - center.y, tangentIn.x - center.x) * 180) /
    Math.PI;
  const endAngle =
    (Math.atan2(tangentOut.y - center.y, tangentOut.x - center.x) * 180) /
    Math.PI;
  return {
    tangentIn,
    tangentOut,
    center,
    radius,
    clockwise: normalizeSweep(startAngle, endAngle) <= 180,
    maxRadius,
  };
}

function polylinePath(points: PolylineVertex[], closed: boolean): CadPath {
  if (points.length < 2) return { segments: [], closed };
  const fillets = points.map((vertex, index) => {
    if (
      (!closed && (index === 0 || index === points.length - 1)) ||
      !vertex.cornerRadius
    )
      return null;
    return calculateVertexFillet(
      points[(index - 1 + points.length) % points.length],
      vertex,
      points[(index + 1) % points.length],
      vertex.cornerRadius,
    );
  });
  const segments: PathSegment[] = [];
  if (closed) {
    let current = fillets[0]?.tangentOut ?? points[0];
    for (let step = 1; step <= points.length; step += 1) {
      const index = step % points.length;
      const fillet = fillets[index];
      const target = fillet?.tangentIn ?? points[index];
      if (distance(current, target) > 1e-9)
        segments.push(line(current, target));
      if (fillet)
        segments.push({
          type: "arc",
          start: fillet.tangentIn,
          end: fillet.tangentOut,
          center: fillet.center,
          radius: fillet.radius,
          clockwise: fillet.clockwise,
        });
      current = fillet?.tangentOut ?? points[index];
    }
  } else {
    let current: Point = points[0];
    for (let index = 1; index < points.length - 1; index += 1) {
      const fillet = fillets[index];
      const target = fillet?.tangentIn ?? points[index];
      if (distance(current, target) > 1e-9)
        segments.push(line(current, target));
      if (fillet)
        segments.push({
          type: "arc",
          start: fillet.tangentIn,
          end: fillet.tangentOut,
          center: fillet.center,
          radius: fillet.radius,
          clockwise: fillet.clockwise,
        });
      current = fillet?.tangentOut ?? points[index];
    }
    segments.push(line(current, points.at(-1)!));
  }
  return { segments, closed };
}

function offsetPolyline(
  points: PolylineVertex[],
  closed: boolean,
  offset: number,
): PolylineVertex[] {
  if (!offset) return points.map((point) => ({ ...point }));
  return points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const a = !closed && index === 0 ? point : previous;
    const b = !closed && index === points.length - 1 ? point : next;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    return {
      ...point,
      x: point.x + (-dy / length) * offset,
      y: point.y + (dx / length) * offset,
    };
  });
}

export function createPath(object: PathObject, offset = 0): CadPath | null {
  if (object.type === "rectangle") return rectanglePath(object, offset);
  if (object.type === "line")
    return polylinePath(
      offsetPolyline(
        [
          { x: object.x1, y: object.y1 },
          { x: object.x2, y: object.y2 },
        ],
        false,
        offset,
      ),
      false,
    );
  if (object.type === "polyline")
    return polylinePath(
      offsetPolyline(
        object.points,
        object.closed,
        object.closed ? -offset : offset,
      ),
      object.closed,
    );
  const radius = object.radius - offset;
  if (radius <= 0) return null;
  if (object.type === "circle")
    return {
      closed: true,
      segments: [
        arc({ x: object.cx, y: object.cy }, radius, 0, 180),
        arc({ x: object.cx, y: object.cy }, radius, 180, 360),
      ],
    };
  const sweep = normalizeSweep(object.startAngle, object.endAngle);
  return {
    closed: false,
    segments: [
      arc(
        { x: object.cx, y: object.cy },
        radius,
        object.startAngle,
        object.startAngle + sweep,
      ),
    ],
  };
}

export const getPathLength = (path: CadPath) =>
  path.segments.reduce((sum, segment) => sum + getSegmentLength(segment), 0);
export function getPointAtDistance(
  path: CadPath,
  requested: number,
): PathSample {
  const total = getPathLength(path);
  const value =
    path.closed && total
      ? ((requested % total) + total) % total
      : Math.max(0, Math.min(total, requested));
  let walked = 0;
  for (let index = 0; index < path.segments.length; index += 1) {
    const segment = path.segments[index];
    const length = getSegmentLength(segment);
    if (walked + length >= value || index === path.segments.length - 1) {
      const local = length ? (value - walked) / length : 0;
      if (segment.type === "line") {
        const dx = segment.end.x - segment.start.x;
        const dy = segment.end.y - segment.start.y;
        return {
          point: {
            x: segment.start.x + dx * local,
            y: segment.start.y + dy * local,
          },
          tangent: { x: dx / (length || 1), y: dy / (length || 1) },
          distance: value,
          corner: Math.abs(value - walked) < 1e-5,
        };
      }
      const startAngle =
        (Math.atan2(
          segment.start.y - segment.center.y,
          segment.start.x - segment.center.x,
        ) *
          180) /
        Math.PI;
      const direction = segment.clockwise ? 1 : -1;
      const angle = startAngle + direction * segmentSweep(segment) * local;
      return {
        point: pointOnCircle(segment.center, segment.radius, angle),
        tangent: pointOnCircle({ x: 0, y: 0 }, 1, angle + direction * 90),
        distance: value,
        corner: Math.abs(value - walked) < 1e-5,
      };
    }
    walked += length;
  }
  return { point: { x: 0, y: 0 }, tangent: { x: 1, y: 0 }, distance: value };
}
export function getCornerDistances(path: CadPath): number[] {
  const result = [0];
  let walked = 0;
  path.segments.forEach((segment, index) => {
    walked += getSegmentLength(segment);
    if (index < path.segments.length - 1) result.push(walked);
  });
  return result;
}
export function buildPathData(path: CadPath): string {
  if (!path.segments.length) return "";
  let value = `M ${path.segments[0].start.x} ${path.segments[0].start.y}`;
  for (const segment of path.segments)
    value +=
      segment.type === "line"
        ? ` L ${segment.end.x} ${segment.end.y}`
        : ` A ${segment.radius} ${segment.radius} 0 ${segmentSweep(segment) > 180 ? 1 : 0} ${segment.clockwise ? 1 : 0} ${segment.end.x} ${segment.end.y}`;
  return value + (path.closed ? " Z" : "");
}
