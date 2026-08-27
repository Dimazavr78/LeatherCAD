import type { RectangleCornerRadii, RectangleObject } from "../../types/cad";

export const ZERO_CORNER_RADII: RectangleCornerRadii = {
  topLeft: 0,
  topRight: 0,
  bottomRight: 0,
  bottomLeft: 0,
};

export function normalizeRectangleCornerRadii(
  width: number,
  height: number,
  input: RectangleCornerRadii,
): RectangleCornerRadii {
  const radii = {
    topLeft: Math.max(0, input.topLeft),
    topRight: Math.max(0, input.topRight),
    bottomRight: Math.max(0, input.bottomRight),
    bottomLeft: Math.max(0, input.bottomLeft),
  };
  const ratios = [
    width / Math.max(radii.topLeft + radii.topRight, 1e-9),
    width / Math.max(radii.bottomLeft + radii.bottomRight, 1e-9),
    height / Math.max(radii.topLeft + radii.bottomLeft, 1e-9),
    height / Math.max(radii.topRight + radii.bottomRight, 1e-9),
  ];
  const scale = Math.min(1, ...ratios);
  return {
    topLeft: radii.topLeft * scale,
    topRight: radii.topRight * scale,
    bottomRight: radii.bottomRight * scale,
    bottomLeft: radii.bottomLeft * scale,
  };
}

export function normalizedRectangle(
  rectangle: RectangleObject,
): RectangleObject {
  return {
    ...rectangle,
    cornerRadii: normalizeRectangleCornerRadii(
      rectangle.width,
      rectangle.height,
      rectangle.cornerRadii,
    ),
  };
}

export function getRectanglePerimeter(rectangle: RectangleObject): number {
  const radii = normalizeRectangleCornerRadii(
    rectangle.width,
    rectangle.height,
    rectangle.cornerRadii,
  );
  const radiusSum =
    radii.topLeft + radii.topRight + radii.bottomRight + radii.bottomLeft;
  return (
    2 * (rectangle.width + rectangle.height) -
    2 * radiusSum +
    (Math.PI / 2) * radiusSum
  );
}
