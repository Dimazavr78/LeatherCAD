import { useTranslation } from "react-i18next";
import type {
  CadLayer,
  CadObject,
  EditorLevel,
  Material,
  RenderMode,
} from "../../types/cad";
import {
  DEFAULT_LAYER_TRANSLATION_KEYS,
  getLevelPath,
  ROOT_LEVEL_ID,
} from "../../editor/projectModel";
import {
  getPartDimensions,
  getPartGeometry,
  getPartStitches,
} from "../../editor/parts/partGeometry";
import { analyzeSeamPair } from "../../editor/seams/seamMatch";

interface Props {
  layers: CadLayer[];
  levels: EditorLevel[];
  activeLayerId: string;
  currentLevelId: string;
  onLayersChange: (layers: CadLayer[]) => void;
  onActiveLayerChange: (id: string) => void;
  onLevelsChange: (levels: EditorLevel[]) => void;
  onCurrentLevelChange: (id: string) => void;
  objects: CadObject[];
  materials: Material[];
  selectedObjectId: string | null;
  renderMode: RenderMode;
  onSelectionChange: (id: string) => void;
  onMaterialsChange: (materials: Material[]) => void;
  onRenderModeChange: (mode: RenderMode) => void;
}

export function ProjectPanel(props: Props) {
  const { t } = useTranslation();
  const ordered = [...props.layers].sort((a, b) => b.order - a.order);
  const children = props.levels.filter(
    (level) => level.parentId === props.currentLevelId,
  );
  const current = props.levels.find(
    (level) => level.id === props.currentLevelId,
  );
  const parts = props.objects.filter((object) => object.type === "part");
  const seams = props.objects.filter((object) => object.type === "seamPair");
  const updateLayer = (id: string, patch: Partial<CadLayer>) =>
    props.onLayersChange(
      props.layers.map((layer) =>
        layer.id === id ? { ...layer, ...patch } : layer,
      ),
    );
  const layerName = (layer: CadLayer) =>
    DEFAULT_LAYER_TRANSLATION_KEYS[layer.id]
      ? t(DEFAULT_LAYER_TRANSLATION_KEYS[layer.id])
      : layer.name;
  const levelName = (level: EditorLevel) =>
    level.id === ROOT_LEVEL_ID ? t("levels.root") : level.name;
  const moveLayer = (id: string, delta: number) => {
    const sorted = [...props.layers].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((layer) => layer.id === id);
    const target = index + delta;
    if (target < 0 || target >= sorted.length) return;
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    props.onLayersChange(sorted.map((layer, order) => ({ ...layer, order })));
  };
  return (
    <div className="project-panel">
      <section>
        <div className="section-title">{t("layers.title").toUpperCase()}</div>
        {ordered.map((layer) => (
          <div
            key={layer.id}
            className={`project-row ${layer.id === props.activeLayerId ? "project-row--active" : ""}`}
          >
            <button
              onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
            >
              {layer.visible ? "◉" : "○"}
            </button>
            <button
              onClick={() => updateLayer(layer.id, { locked: !layer.locked })}
            >
              {layer.locked ? "🔒" : "◇"}
            </button>
            <button
              className="project-row-name"
              onClick={() => props.onActiveLayerChange(layer.id)}
              onDoubleClick={() => {
                const name = window.prompt(
                  t("layers.rename"),
                  layerName(layer),
                );
                if (name?.trim()) updateLayer(layer.id, { name: name.trim() });
              }}
            >
              {layerName(layer)}
            </button>
            <button onClick={() => moveLayer(layer.id, 1)}>↑</button>
            <button onClick={() => moveLayer(layer.id, -1)}>↓</button>
          </div>
        ))}
        <button
          className="project-add"
          onClick={() =>
            props.onLayersChange([
              ...props.layers,
              {
                id: crypto.randomUUID(),
                name: `${t("layers.layer")} ${props.layers.length + 1}`,
                visible: true,
                locked: false,
                order: props.layers.length,
                type: "normal",
              },
            ])
          }
        >
          + {t("layers.layer")}
        </button>
      </section>
      <section>
        <div className="section-title">{t("seams.title").toUpperCase()}</div>
        {seams.length === 0 && (
          <div className="project-empty">{t("seams.empty")}</div>
        )}
        {seams.map((seam) => {
          const result = analyzeSeamPair(seam, props.objects);
          return (
            <button
              key={seam.id}
              className={`project-row-name seam-tree-row ${props.selectedObjectId === seam.id ? "project-row--active" : ""}`}
              onClick={() => props.onSelectionChange(seam.id)}
            >
              <span>{result.compatible ? "✓" : result.valid ? "⚠" : "✕"}</span>
              <span>{seam.name}</span>
              <small>
                {result.holeCountA} ↔ {result.holeCountB}
              </small>
            </button>
          );
        })}
      </section>
      <section>
        <div className="section-title">{t("levels.title").toUpperCase()}</div>
        {current?.parentId && (
          <button
            className="project-add"
            onClick={() => props.onCurrentLevelChange(current.parentId!)}
          >
            ← {t("levels.back")}
          </button>
        )}
        {children.map((level) => (
          <div className="project-row" key={level.id}>
            <button
              className="project-row-name"
              onDoubleClick={() => props.onCurrentLevelChange(level.id)}
            >
              {levelName(level)}
            </button>
            <button
              onClick={() => {
                const name = window.prompt(t("levels.rename"), level.name);
                if (name?.trim())
                  props.onLevelsChange(
                    props.levels.map((item) =>
                      item.id === level.id
                        ? { ...item, name: name.trim() }
                        : item,
                    ),
                  );
              }}
            >
              ✎
            </button>
            <button onClick={() => props.onCurrentLevelChange(level.id)}>
              ›
            </button>
          </div>
        ))}
        <button
          className="project-add"
          onClick={() =>
            props.onLevelsChange([
              ...props.levels,
              {
                id: crypto.randomUUID(),
                name: `${t("levels.level")} ${props.levels.length}`,
                parentId: props.currentLevelId,
              },
            ])
          }
        >
          + {t("levels.new")}
        </button>
        <div className="level-path-small">
          {getLevelPath(props.levels, props.currentLevelId)
            .map(levelName)
            .join(" › ")}
        </div>
      </section>
      <section>
        <div className="section-title">{t("parts.title").toUpperCase()}</div>
        {parts.length === 0 && (
          <div className="project-empty">{t("parts.empty")}</div>
        )}
        {parts.map((part) => {
          const geometry = getPartGeometry(part, props.objects);
          const stitches = getPartStitches(part, props.objects);
          const dimensions = getPartDimensions(part, props.objects);
          const children = [
            ...(geometry?.holes ?? []),
            ...stitches,
            ...dimensions,
          ];
          return (
            <div className="part-tree" key={part.id}>
              <button
                className={`project-row-name part-tree-root ${props.selectedObjectId === part.id ? "project-row--active" : ""}`}
                onClick={() => props.onSelectionChange(part.id)}
              >
                {part.locked ? "🔒" : "🔓"} ◇ {part.name}
              </button>
              <button
                className="part-tree-child"
                onClick={() => props.onSelectionChange(part.contourSourceId)}
              >
                ├─ {t("parts.outerContour")}
              </button>
              {children.map((child, index) => (
                <button
                  key={child.id}
                  className="part-tree-child"
                  onClick={() => props.onSelectionChange(child.id)}
                >
                  {index === children.length - 1 ? "└─" : "├─"}{" "}
                  {t(`properties.${child.type}.title`)} #{child.id.slice(0, 6)}
                </button>
              ))}
            </div>
          );
        })}
      </section>
      <section>
        <div className="section-title">
          {t("materials.title").toUpperCase()}
        </div>
        <label className="project-select-label">
          {t("materials.renderMode")}
          <select
            className="property-select"
            value={props.renderMode}
            onChange={(event) =>
              props.onRenderModeChange(event.target.value as RenderMode)
            }
          >
            <option value="wireframe">{t("materials.wireframe")}</option>
            <option value="material">{t("materials.preview")}</option>
          </select>
        </label>
        {props.materials.map((material) => (
          <div className="project-row" key={material.id}>
            <span
              className="material-swatch"
              style={{ backgroundColor: material.color ?? "transparent" }}
            />
            <button
              className="project-row-name"
              onDoubleClick={() => {
                const name = window.prompt(
                  t("materials.rename"),
                  material.presetKey ? t(material.presetKey) : material.name,
                );
                if (name?.trim())
                  props.onMaterialsChange(
                    props.materials.map((item) =>
                      item.id === material.id
                        ? {
                            ...item,
                            name: name.trim(),
                            presetKey: undefined,
                            builtIn: false,
                          }
                        : item,
                    ),
                  );
              }}
            >
              {material.presetKey ? t(material.presetKey) : material.name} ·{" "}
              {material.thickness} {t("common.mm")}
            </button>
            <button
              title={t("materials.edit")}
              onClick={() => {
                const thickness = Number(
                  window.prompt(
                    t("materials.thickness"),
                    String(material.thickness),
                  ),
                );
                if (!(thickness > 0)) return;
                const color =
                  window.prompt(
                    t("materials.color"),
                    material.color ?? "#8c6548",
                  ) ?? material.color;
                const notes =
                  window.prompt(t("materials.notes"), material.notes ?? "") ??
                  material.notes;
                props.onMaterialsChange(
                  props.materials.map((item) =>
                    item.id === material.id
                      ? { ...item, thickness, color, notes }
                      : item,
                  ),
                );
              }}
            >
              ✎
            </button>
            <button
              disabled={props.objects.some(
                (object) =>
                  object.type === "part" && object.materialId === material.id,
              )}
              title={t("materials.delete")}
              onClick={() =>
                props.onMaterialsChange(
                  props.materials.filter((item) => item.id !== material.id),
                )
              }
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="project-add"
          onClick={() =>
            props.onMaterialsChange([
              ...props.materials,
              {
                id: crypto.randomUUID(),
                name: `${t("materials.custom")} ${props.materials.length + 1}`,
                category: "leather",
                thickness: 1.5,
                color: "#8c6548",
              },
            ])
          }
        >
          + {t("materials.add")}
        </button>
      </section>
    </div>
  );
}
