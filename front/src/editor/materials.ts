import presetsJson from "../config/material-presets.json";
import type { Material, PartObject } from "../types/cad";

interface MaterialPreset {
  id: string;
  labelKey: string;
  thickness: number;
  color: string;
}

export const DEFAULT_MATERIALS: Material[] = (
  presetsJson as MaterialPreset[]
).map((preset) => ({
  id: preset.id,
  name: preset.labelKey,
  presetKey: preset.labelKey,
  category: "leather",
  thickness: preset.thickness,
  color: preset.color,
  builtIn: true,
}));

export function getEffectiveThickness(
  part: PartObject,
  materials: Material[],
): number {
  return (
    part.thicknessOverride ??
    materials.find((material) => material.id === part.materialId)?.thickness ??
    0
  );
}
