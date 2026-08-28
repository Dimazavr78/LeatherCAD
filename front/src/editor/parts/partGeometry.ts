import type {
  CadObject,
  HoleObject,
  Material,
  PartObject,
  PathObject,
  Point,
  StitchObject,
} from "../../types/cad";
import {
  createHolePath,
  getObjectBounds,
  isPointInHost,
} from "../holes/holeGeometry";
import { getEffectiveThickness } from "../materials";
import {
  createPath,
  getPathLength,
  type ArcPathSegment,
  type CadPath,
} from "../geometry/pathMath";
import { generateStitch } from "../stitch/stitchMath";

export interface PartGeometry {
  outerContour: PathObject;
  holes: HoleObject[];
}

export interface PartValidation {
  valid: boolean;
  contourExists: boolean;
  contourClosed: boolean;
  noSelfIntersections: boolean;
  holesInside: boolean;
  materialExists: boolean;
  thicknessValid: boolean;
  stitchesInside: boolean;
}

export function isClosedPartContour(
  object: CadObject | undefined,
): object is PathObject {
  return Boolean(
    object &&
    (object.type === "rectangle" ||
      object.type === "circle" ||
      (object.type === "polyline" && object.closed)),
  );
}

export function getPartGeometry(
  part: PartObject,
  objects: CadObject[],
): PartGeometry | null {
  const outerContour = objects.find(
    (object) => object.id === part.contourSourceId,
  );
  if (!isClosedPartContour(outerContour)) return null;
  return {
    outerContour,
    holes: objects.filter(
      (object): object is HoleObject =>
        object.type === "hole" &&
        (object.hostObjectId === part.id ||
          object.hostObjectId === part.contourSourceId),
    ),
  };
}

export function getPartBoundingBox(part: PartObject, objects: CadObject[]) {
  const geometry = getPartGeometry(part, objects);
  return geometry ? getObjectBounds(geometry.outerContour) : null;
}

function normalizedSweep(start: number, end: number) {
  return (((end - start) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

function arcArea(segment: ArcPathSegment): number {
  const start = Math.atan2(
    segment.start.y - segment.center.y,
    segment.start.x - segment.center.x,
  );
  const end = Math.atan2(
    segment.end.y - segment.center.y,
    segment.end.x - segment.center.x,
  );
  const delta = segment.clockwise
    ? normalizedSweep(start, end)
    : -normalizedSweep(end, start);
  return (
    (segment.radius * segment.center.x * (Math.sin(end) - Math.sin(start)) +
      segment.radius * segment.center.y * (-Math.cos(end) + Math.cos(start)) +
      segment.radius * segment.radius * delta) /
    2
  );
}

export function getPathArea(path: CadPath | null): number {
  if (!path?.closed) return 0;
  const signed = path.segments.reduce(
    (area, segment) =>
      area +
      (segment.type === "line"
        ? (segment.start.x * segment.end.y - segment.end.x * segment.start.y) /
          2
        : arcArea(segment)),
    0,
  );
  return Math.abs(signed);
}

export function getPartOuterPerimeter(
  part: PartObject,
  objects: CadObject[],
): number {
  const geometry = getPartGeometry(part, objects);
  return geometry ? getPathLength(createPath(geometry.outerContour)!) : 0;
}

export function getPartTotalCutLength(
  part: PartObject,
  objects: CadObject[],
): number {
  const geometry = getPartGeometry(part, objects);
  if (!geometry) return 0;
  return (
    getPartOuterPerimeter(part, objects) +
    geometry.holes.reduce(
      (length, hole) =>
        length +
        getPathLength(
          createHolePath(hole, objects) ?? { segments: [], closed: true },
        ),
      0,
    )
  );
}

export function getPartArea(part: PartObject, objects: CadObject[]): number {
  const geometry = getPartGeometry(part, objects);
  if (!geometry) return 0;
  const outer = getPathArea(createPath(geometry.outerContour));
  const holes = geometry.holes.reduce(
    (area, hole) => area + getPathArea(createHolePath(hole, objects)),
    0,
  );
  return Math.max(0, outer - holes);
}

export function getPartStitches(
  part: PartObject,
  objects: CadObject[],
): StitchObject[] {
  const geometry = getPartGeometry(part, objects);
  if (!geometry) return [];
  const sourceIds = new Set([
    part.contourSourceId,
    ...geometry.holes.map((hole) => hole.id),
  ]);
  return objects.filter(
    (object): object is StitchObject =>
      object.type === "stitch" && sourceIds.has(object.sourceObjectId),
  );
}

export function getPartDimensions(part: PartObject, objects: CadObject[]) {
  const geometry = getPartGeometry(part, objects);
  if (!geometry) return [];
  const ids = new Set([
    part.contourSourceId,
    ...geometry.holes.map((hole) => hole.id),
  ]);
  return objects.filter(
    (object) =>
      object.type === "dimension" &&
      (ids.has(object.referenceA.objectId ?? "") ||
        ids.has(object.referenceB?.objectId ?? "")),
  );
}

function orientation(a: Point, b: Point, c: Point) {
  return Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
}

function hasPolylineSelfIntersections(object: PathObject): boolean {
  if (object.type !== "polyline" || object.points.length < 4) return false;
  const segments = object.points.map((point, index) => ({
    a: point,
    b: object.points[(index + 1) % object.points.length],
  }));
  return segments.some((first, index) =>
    segments.some((second, otherIndex) => {
      if (
        index === otherIndex ||
        Math.abs(index - otherIndex) === 1 ||
        (index === 0 && otherIndex === segments.length - 1) ||
        (otherIndex === 0 && index === segments.length - 1)
      )
        return false;
      return (
        orientation(first.a, first.b, second.a) !==
          orientation(first.a, first.b, second.b) &&
        orientation(second.a, second.b, first.a) !==
          orientation(second.a, second.b, first.b)
      );
    }),
  );
}

export function validatePart(
  part: PartObject,
  objects: CadObject[],
  materials: Material[],
): PartValidation {
  const source = objects.find((object) => object.id === part.contourSourceId);
  const contourExists = Boolean(source);
  const contourClosed = isClosedPartContour(source);
  const geometry = getPartGeometry(part, objects);
  const noSelfIntersections =
    !source ||
    !isClosedPartContour(source) ||
    !hasPolylineSelfIntersections(source);
  const holesInside = Boolean(
    geometry &&
    geometry.holes.every((hole) => {
      const path = createHolePath(hole, objects);
      return Boolean(
        path &&
        path.segments.every(
          (segment) =>
            isPointInHost(segment.start, geometry.outerContour) &&
            isPointInHost(segment.end, geometry.outerContour),
        ),
      );
    }),
  );
  const materialExists =
    part.materialId !== null &&
    materials.some((material) => material.id === part.materialId);
  const thicknessValid = getEffectiveThickness(part, materials) > 0;
  const stitchesInside = Boolean(
    geometry &&
    getPartStitches(part, objects).every((stitch) => {
      const source = objects.find(
        (object) => object.id === stitch.sourceObjectId,
      );
      const path =
        source?.type === "hole"
          ? createHolePath(source, objects, stitch.offset)
          : source && isClosedPartContour(source)
            ? createPath(source, stitch.offset)
            : null;
      return generateStitch(path, stitch).holes.every((point) =>
        isPointInHost(point, geometry.outerContour),
      );
    }),
  );
  return {
    valid:
      contourExists &&
      contourClosed &&
      noSelfIntersections &&
      holesInside &&
      materialExists &&
      thicknessValid &&
      stitchesInside,
    contourExists,
    contourClosed,
    noSelfIntersections,
    holesInside,
    materialExists,
    thicknessValid,
    stitchesInside,
  };
}
