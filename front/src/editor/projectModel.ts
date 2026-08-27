import type { CadLayer, CadObject, EditorLevel } from "../types/cad";

export const DEFAULT_LAYER_IDS = {
  geometry: "layer-geometry",
  holes: "layer-holes",
  stitch: "layer-stitch",
  dimensions: "layer-dimensions",
  construction: "layer-construction",
} as const;
export const DEFAULT_LAYER_TRANSLATION_KEYS: Record<string, string> = {
  [DEFAULT_LAYER_IDS.geometry]: "layers.defaults.geometry",
  [DEFAULT_LAYER_IDS.holes]: "layers.defaults.holes",
  [DEFAULT_LAYER_IDS.stitch]: "layers.defaults.stitch",
  [DEFAULT_LAYER_IDS.dimensions]: "layers.defaults.dimensions",
  [DEFAULT_LAYER_IDS.construction]: "layers.defaults.construction",
};
export const ROOT_LEVEL_ID = "level-root";

export const DEFAULT_LAYERS: CadLayer[] = [
  {
    id: DEFAULT_LAYER_IDS.geometry,
    name: "Geometry",
    visible: true,
    locked: false,
    order: 0,
    type: "normal",
  },
  {
    id: DEFAULT_LAYER_IDS.holes,
    name: "Holes",
    visible: true,
    locked: false,
    order: 1,
    type: "normal",
  },
  {
    id: DEFAULT_LAYER_IDS.stitch,
    name: "Stitch",
    visible: true,
    locked: false,
    order: 2,
    type: "normal",
  },
  {
    id: DEFAULT_LAYER_IDS.dimensions,
    name: "Dimensions",
    visible: true,
    locked: false,
    order: 3,
    type: "annotation",
  },
  {
    id: DEFAULT_LAYER_IDS.construction,
    name: "Construction",
    visible: true,
    locked: false,
    order: 4,
    type: "construction",
  },
];
export const ROOT_LEVEL: EditorLevel = {
  id: ROOT_LEVEL_ID,
  name: "Project",
  parentId: null,
};

export function getAutomaticLayerId(
  object: CadObject,
  activeLayerId: string,
): string {
  if (object.type === "stitch") return DEFAULT_LAYER_IDS.stitch;
  if (object.type === "hole") return DEFAULT_LAYER_IDS.holes;
  if (object.type === "dimension") return DEFAULT_LAYER_IDS.dimensions;
  return activeLayerId;
}

export function getLevelPath(
  levels: EditorLevel[],
  currentId: string,
): EditorLevel[] {
  const path: EditorLevel[] = [];
  let current = levels.find((level) => level.id === currentId);
  while (current) {
    path.unshift(current);
    current = current.parentId
      ? levels.find((level) => level.id === current!.parentId)
      : undefined;
  }
  return path;
}
