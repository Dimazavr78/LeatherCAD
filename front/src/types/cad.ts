export interface Point {
  x: number;
  y: number;
}

export interface RectangleCornerRadii {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export interface RectangleObject {
  id: string;
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadii: RectangleCornerRadii;
  linkCorners: boolean;
}

export interface LineObject {
  id: string;
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface PolylineVertex extends Point {
  cornerRadius?: number;
}

export interface PolylineObject {
  id: string;
  type: "polyline";
  points: PolylineVertex[];
  closed: boolean;
}
export interface CircleObject {
  id: string;
  type: "circle";
  cx: number;
  cy: number;
  radius: number;
}
export interface ArcObject {
  id: string;
  type: "arc";
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
}
export type HoleShape = "round" | "diamond" | "slit";
export type StitchMode = "fixed-spacing" | "fit-evenly" | "adaptive";
export type StitchAlignment = "start" | "center" | "corners";
export type StitchCornerMode = "continuous" | "corner-first" | "adaptive";
export interface StitchObject {
  id: string;
  type: "stitch";
  sourceObjectId: string;
  offset: number;
  spacing: number;
  holeSize: number;
  holeShape: HoleShape;
  holeAngle: number | "follow-path";
  mode: StitchMode;
  alignment: StitchAlignment;
  cornerMode: StitchCornerMode;
  maxSpacingDeviation: number;
  showLine: boolean;
  showHoles: boolean;
}

export type DimensionType =
  "aligned" | "horizontal" | "vertical" | "radius" | "diameter" | "arc-length";
export type DimensionAnchor =
  | "point"
  | "start"
  | "end"
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";
export interface DimensionReference {
  objectId?: string;
  anchor: DimensionAnchor;
  vertexIndex?: number;
  point?: Point;
}
export interface DimensionObject {
  id: string;
  type: "dimension";
  dimensionType: DimensionType;
  referenceA: DimensionReference;
  referenceB?: DimensionReference;
  offset: number;
  precision: number;
  showUnit: boolean;
}
export type PathObject =
  RectangleObject | LineObject | PolylineObject | CircleObject | ArcObject;
export type CadObject = PathObject | StitchObject | DimensionObject;
export type CadObjectType = CadObject["type"];
export type Tool =
  | "select"
  | "line"
  | "polyline"
  | "rectangle"
  | "circle"
  | "arc"
  | "stitch"
  | "fillet"
  | "dimension"
  | "measure";

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export function isPathObject(object: CadObject): object is PathObject {
  return (
    object.type === "rectangle" ||
    object.type === "line" ||
    object.type === "polyline" ||
    object.type === "circle" ||
    object.type === "arc"
  );
}
