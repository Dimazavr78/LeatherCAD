import type { ArcObject, Point } from "../../types/cad";
export const EPSILON = 1e-6;
export const distance = (a: Point, b: Point) =>
  Math.hypot(b.x - a.x, b.y - a.y);
export const angleDegrees = (center: Point, point: Point) =>
  (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
export function pointOnCircle(
  center: Point,
  radius: number,
  angle: number,
): Point {
  const radians = (angle * Math.PI) / 180;
  return {
    x: center.x + Math.cos(radians) * radius,
    y: center.y + Math.sin(radians) * radius,
  };
}
export const normalizeSweep = (start: number, end: number) =>
  (((end - start) % 360) + 360) % 360;
export function arcPathData(arc: ArcObject): string {
  const center = { x: arc.cx, y: arc.cy };
  const start = pointOnCircle(center, arc.radius, arc.startAngle);
  const end = pointOnCircle(center, arc.radius, arc.endAngle);
  const sweep = normalizeSweep(arc.startAngle, arc.endAngle);
  return `M ${start.x} ${start.y} A ${arc.radius} ${arc.radius} 0 ${sweep > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
}
