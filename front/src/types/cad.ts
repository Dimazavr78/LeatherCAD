export interface Point {
  x: number;
  y: number;
}

export interface CadObjectMetadata {
  layerId?: string;
  levelId?: string;
}

export interface RectangleCornerRadii {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export interface RectangleObject extends CadObjectMetadata {
  id: string;
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadii: RectangleCornerRadii;
  linkCorners: boolean;
}

export interface LineObject extends CadObjectMetadata {
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

export interface PolylineObject extends CadObjectMetadata {
  id: string;
  type: "polyline";
  points: PolylineVertex[];
  closed: boolean;
}
export interface CircleObject extends CadObjectMetadata {
  id: string;
  type: "circle";
  cx: number;
  cy: number;
  radius: number;
}
export interface ArcObject extends CadObjectMetadata {
  id: string;
  type: "arc";
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
}
export type StitchHoleShape = "round" | "diamond" | "slit";
export type StitchMode = "fixed-spacing" | "fit-evenly" | "adaptive";
export type StitchAlignment = "start" | "center" | "corners";
export type StitchCornerMode = "continuous" | "corner-first" | "adaptive";
export interface StitchObject extends CadObjectMetadata {
  id: string;
  type: "stitch";
  sourceObjectId: string;
  offset: number;
  spacing: number;
  holeSize: number;
  holeShape: StitchHoleShape;
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
export type GeometryAnchor =
  | "point"
  | "start"
  | "end"
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "vertex"
  | "edge"
  | "radius"
  | "diameter";
export interface GeometryReference {
  objectId?: string;
  anchor: GeometryAnchor;
  index?: number;
  vertexIndex?: number;
  point?: Point;
}
export type DimensionReference = GeometryReference;
export interface DimensionObject extends CadObjectMetadata {
  id: string;
  type: "dimension";
  dimensionType: DimensionType;
  referenceA: DimensionReference;
  referenceB?: DimensionReference;
  offset: number;
  precision: number;
  showUnit: boolean;
}

export interface CadLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
  type: "normal" | "construction" | "annotation";
}

export interface EditorLevel {
  id: string;
  name: string;
  parentId: string | null;
}
export type HoleShape = "circle" | "slot" | "rectangle" | "custom";
export type HolePosition =
  | { mode: "absolute"; x: number; y: number }
  | { mode: "relative"; xRatio: number; yRatio: number }
  | {
      mode: "offset";
      fromX: "left" | "right";
      fromY: "top" | "bottom";
      offsetX: number;
      offsetY: number;
    };
export interface HoleObject extends CadObjectMetadata {
  id: string;
  type: "hole";
  hostObjectId: string;
  shape: HoleShape;
  position: HolePosition;
  width: number;
  height: number;
  radius: number;
  cornerRadius: number;
  rotation: number;
  constrainToHost: boolean;
  customSourceObjectId?: string;
}
export interface PartManufacturingSettings {
  edgeAllowance?: number;
  skivingAllowance?: number;
}
export interface PartExportSettings {
  exportOuterContour: boolean;
  exportHoles: boolean;
  exportStitch: boolean;
}
export interface PartObject extends CadObjectMetadata {
  id: string;
  type: "part";
  name: string;
  contourSourceId: string;
  materialId: string | null;
  thicknessOverride?: number;
  manufacturing: PartManufacturingSettings;
  exportSettings: PartExportSettings;
}
export interface Material {
  id: string;
  name: string;
  category: "leather";
  thickness: number;
  color?: string;
  notes?: string;
  presetKey?: string;
  builtIn?: boolean;
}
export type RenderMode = "wireframe" | "material";
export type PathObject =
  RectangleObject | LineObject | PolylineObject | CircleObject | ArcObject;
export type CadObject =
  PathObject | HoleObject | PartObject | StitchObject | DimensionObject;
export type CadObjectType = CadObject["type"];
export type Tool =
  | "select"
  | "line"
  | "polyline"
  | "rectangle"
  | "circle"
  | "arc"
  | "stitch"
  | "hole"
  | "part"
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
