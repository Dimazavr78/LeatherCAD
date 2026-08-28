import type {
  CadObject,
  HoleObject,
  PathObject,
  SeamPairObject,
  StitchObject,
} from "../../types/cad";
import { createPath } from "../geometry/pathMath";
import { createHolePath } from "../holes/holeGeometry";
import {
  generateStitch,
  type GeneratedStitch,
  type StitchHole,
} from "../stitch/stitchMath";

export type HoleMatchStatus = "match" | "warning" | "error";
export interface OrderedStitchHole extends StitchHole {
  sourceIndex: number;
  normalizedPosition: number;
}
export interface HoleMatchResult {
  holeA: OrderedStitchHole;
  holeB: OrderedStitchHole;
  deltaNormalized: number;
  deltaMm: number;
  status: HoleMatchStatus;
}
export interface SeamMatchResult {
  compatible: boolean;
  valid: boolean;
  errors: string[];
  holeCountA: number;
  holeCountB: number;
  lengthA: number;
  lengthB: number;
  difference: number;
  differencePercent: number;
  maxDeviation: number;
  averageDeviation: number;
  matches: HoleMatchResult[];
}

export function getGeneratedStitch(
  stitch: StitchObject | undefined,
  objects: CadObject[],
): GeneratedStitch | null {
  if (!stitch) return null;
  const source = objects.find(
    (candidate) => candidate.id === stitch.sourceObjectId,
  );
  if (!source) return null;
  const path =
    source.type === "hole"
      ? createHolePath(source as HoleObject, objects, stitch.offset)
      : ["rectangle", "line", "polyline", "circle", "arc"].includes(source.type)
        ? createPath(source as PathObject, stitch.offset)
        : null;
  return generateStitch(path, stitch);
}

export function orderStitchHoles(
  generated: GeneratedStitch,
  startHoleIndex: number,
  direction: "forward" | "reverse",
): OrderedStitchHole[] {
  const count = generated.holes.length;
  if (!count) return [];
  const start = ((Math.trunc(startHoleIndex) % count) + count) % count;
  return Array.from({ length: count }, (_, position) => {
    const sourceIndex =
      direction === "forward"
        ? (start + position) % count
        : (start - position + count) % count;
    return {
      ...generated.holes[sourceIndex],
      sourceIndex,
      normalizedPosition: count <= 1 ? 0 : position / (count - 1),
    };
  });
}

function alignedSlice<T>(
  values: T[],
  count: number,
  alignment: SeamPairObject["alignment"],
  manualStart: number,
): T[] {
  if (count >= values.length) return values;
  const start =
    alignment === "end"
      ? values.length - count
      : alignment === "center"
        ? Math.floor((values.length - count) / 2)
        : alignment === "manual"
          ? Math.max(0, Math.min(values.length - count, manualStart))
          : 0;
  return values.slice(start, start + count);
}

export function analyzeSeamPair(
  seam: SeamPairObject,
  objects: CadObject[],
): SeamMatchResult {
  const stitchA = objects.find(
    (object): object is StitchObject =>
      object.id === seam.stitchAId && object.type === "stitch",
  );
  const stitchB = objects.find(
    (object): object is StitchObject =>
      object.id === seam.stitchBId && object.type === "stitch",
  );
  const generatedA = getGeneratedStitch(stitchA, objects);
  const generatedB = getGeneratedStitch(stitchB, objects);
  const errors: string[] = [];
  if (!stitchA) errors.push("missing-stitch-a");
  if (!stitchB) errors.push("missing-stitch-b");
  if (seam.stitchAId === seam.stitchBId) errors.push("same-stitch");
  if (!(seam.tolerance > 0)) errors.push("invalid-tolerance");
  if (generatedA && generatedA.holes.length === 0)
    errors.push("empty-stitch-a");
  if (generatedB && generatedB.holes.length === 0)
    errors.push("empty-stitch-b");

  const holesA = generatedA
    ? orderStitchHoles(
        generatedA,
        stitchA?.startHoleIndex ?? 0,
        seam.directionA,
      )
    : [];
  const holesB = generatedB
    ? orderStitchHoles(
        generatedB,
        stitchB?.startHoleIndex ?? 0,
        seam.directionB,
      )
    : [];
  const matchCount = Math.min(holesA.length, holesB.length);
  const alignedA = alignedSlice(
    holesA,
    matchCount,
    seam.alignment,
    seam.startHoleA,
  );
  const alignedB = alignedSlice(
    holesB,
    matchCount,
    seam.alignment,
    seam.startHoleB,
  );
  const meanLength =
    ((generatedA?.pathLength ?? 0) + (generatedB?.pathLength ?? 0)) / 2;
  const matches = alignedA.map((holeA, index): HoleMatchResult => {
    const holeB = alignedB[index];
    const deltaNormalized = Math.abs(
      holeA.normalizedPosition - holeB.normalizedPosition,
    );
    const deltaMm = deltaNormalized * meanLength;
    return {
      holeA,
      holeB,
      deltaNormalized,
      deltaMm,
      status:
        deltaMm > seam.tolerance
          ? "error"
          : deltaMm > seam.tolerance / 2
            ? "warning"
            : "match",
    };
  });
  const deviations = matches.map((match) => match.deltaMm);
  const lengthA = generatedA?.pathLength ?? 0;
  const lengthB = generatedB?.pathLength ?? 0;
  const difference = Math.abs(lengthA - lengthB);
  return {
    valid: errors.length === 0,
    compatible:
      errors.length === 0 &&
      holesA.length === holesB.length &&
      matches.every((match) => match.status !== "error"),
    errors,
    holeCountA: holesA.length,
    holeCountB: holesB.length,
    lengthA,
    lengthB,
    difference,
    differencePercent: Math.max(lengthA, lengthB)
      ? (difference / Math.max(lengthA, lengthB)) * 100
      : 0,
    maxDeviation: deviations.length ? Math.max(...deviations) : 0,
    averageDeviation: deviations.length
      ? deviations.reduce((sum, value) => sum + value, 0) / deviations.length
      : 0,
    matches,
  };
}

export interface BestFitResult {
  holeCount: number;
  spacingA: number;
  spacingB: number;
  maxDeviationPercent: number;
}
export function findBestFitHoleCount(
  lengthA: number,
  lengthB: number,
  desiredSpacingA: number,
  desiredSpacingB: number,
  closedA = true,
  closedB = true,
): BestFitResult {
  const estimate = Math.max(
    2,
    Math.round((lengthA / desiredSpacingA + lengthB / desiredSpacingB) / 2),
  );
  let best: BestFitResult | null = null;
  for (
    let count = Math.max(2, estimate - 5);
    count <= estimate + 5;
    count += 1
  ) {
    const spacingA = lengthA / (closedA ? count : count - 1);
    const spacingB = lengthB / (closedB ? count : count - 1);
    const maxDeviationPercent =
      Math.max(
        Math.abs(spacingA - desiredSpacingA) / desiredSpacingA,
        Math.abs(spacingB - desiredSpacingB) / desiredSpacingB,
      ) * 100;
    if (!best || maxDeviationPercent < best.maxDeviationPercent)
      best = { holeCount: count, spacingA, spacingB, maxDeviationPercent };
  }
  return best!;
}
