import type { StitchObject } from "../../types/cad";
import {
  getCornerDistances,
  getPathLength,
  getPointAtDistance,
  type CadPath,
} from "../geometry/pathMath";
export interface StitchHole {
  x: number;
  y: number;
  angle: number;
  distanceAlongPath: number;
  corner?: boolean;
}
export type StitchWarning =
  "spacing-deviation" | "too-small-path" | "offset-failed";
export interface GeneratedStitch {
  holes: StitchHole[];
  desiredSpacing: number;
  actualSpacing: number;
  pathLength: number;
  warnings: StitchWarning[];
}
export function generateStitch(
  path: CadPath | null,
  p: StitchObject,
): GeneratedStitch {
  if (!path)
    return {
      holes: [],
      desiredSpacing: p.spacing,
      actualSpacing: 0,
      pathLength: 0,
      warnings: ["offset-failed"],
    };
  const pathLength = getPathLength(path);
  if (pathLength <= 0 || p.spacing <= 0)
    return {
      holes: [],
      desiredSpacing: p.spacing,
      actualSpacing: 0,
      pathLength,
      warnings: ["too-small-path"],
    };
  let actualSpacing = p.spacing;
  const distances: number[] = [];
  if (p.alignment === "corners" || p.cornerMode !== "continuous") {
    const corners = getCornerDistances(path);
    if (corners.length > 1) {
      for (let i = 0; i < corners.length; i += 1) {
        const start = corners[i];
        const end = corners[i + 1] ?? pathLength;
        const count = Math.max(1, Math.round((end - start) / p.spacing));
        const step = (end - start) / count;
        for (let n = 0; n < count; n += 1) distances.push(start + n * step);
        if (!path.closed && i === corners.length - 1) distances.push(end);
      }
      actualSpacing =
        distances.length > 1
          ? pathLength / (path.closed ? distances.length : distances.length - 1)
          : pathLength;
    }
  }
  if (!distances.length) {
    const intervals =
      p.mode === "fixed-spacing"
        ? Math.max(1, Math.floor(pathLength / p.spacing))
        : Math.max(1, Math.round(pathLength / p.spacing));
    actualSpacing =
      p.mode === "fixed-spacing" ? p.spacing : pathLength / intervals;
    const count = path.closed ? intervals : intervals + 1;
    const used = path.closed
      ? count * actualSpacing
      : (count - 1) * actualSpacing;
    const start =
      p.alignment === "center" ? Math.max(0, (pathLength - used) / 2) : 0;
    for (let i = 0; i < count; i += 1)
      distances.push(start + i * actualSpacing);
  }
  const corners = getCornerDistances(path);
  const holes = distances.map((distanceAlongPath) => {
    const sample = getPointAtDistance(path, distanceAlongPath);
    const tangent =
      (Math.atan2(sample.tangent.y, sample.tangent.x) * 180) / Math.PI;
    return {
      x: sample.point.x,
      y: sample.point.y,
      angle: p.holeAngle === "follow-path" ? tangent + 45 : p.holeAngle,
      distanceAlongPath,
      corner: corners.some(
        (value) => Math.abs(value - distanceAlongPath) < 1e-4,
      ),
    };
  });
  const deviation = Math.abs(actualSpacing - p.spacing) / p.spacing;
  return {
    holes,
    desiredSpacing: p.spacing,
    actualSpacing,
    pathLength,
    warnings:
      deviation > p.maxSpacingDeviation / 100 ? ["spacing-deviation"] : [],
  };
}
