import type { CadObject } from "../types/cad";

export function cloneCadObject(object: CadObject): CadObject {
  return object.type === "polyline"
    ? { ...object, points: object.points.map((point) => ({ ...point })) }
    : { ...object };
}

export function translateCadObject(
  object: CadObject,
  deltaX: number,
  deltaY: number,
): CadObject {
  if (object.type === "rectangle")
    return { ...object, x: object.x + deltaX, y: object.y + deltaY };
  if (object.type === "line")
    return {
      ...object,
      x1: object.x1 + deltaX,
      y1: object.y1 + deltaY,
      x2: object.x2 + deltaX,
      y2: object.y2 + deltaY,
    };
  if (object.type === "polyline")
    return {
      ...object,
      points: object.points.map((point) => ({
        x: point.x + deltaX,
        y: point.y + deltaY,
      })),
    };
  if (object.type === "circle" || object.type === "arc")
    return { ...object, cx: object.cx + deltaX, cy: object.cy + deltaY };
  return object;
}

export function cloneCadObjectWithOffset(
  object: CadObject,
  offset: number,
): CadObject {
  return {
    ...translateCadObject(object, offset, offset),
    id: crypto.randomUUID(),
  };
}
