import { useTranslation } from "react-i18next";
import type { CadLayer, EditorLevel } from "../../types/cad";
import { getLevelPath } from "../../editor/projectModel";

interface Props {
  layers: CadLayer[];
  levels: EditorLevel[];
  activeLayerId: string;
  currentLevelId: string;
  onLayersChange: (layers: CadLayer[]) => void;
  onActiveLayerChange: (id: string) => void;
  onLevelsChange: (levels: EditorLevel[]) => void;
  onCurrentLevelChange: (id: string) => void;
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
  const updateLayer = (id: string, patch: Partial<CadLayer>) =>
    props.onLayersChange(
      props.layers.map((layer) =>
        layer.id === id ? { ...layer, ...patch } : layer,
      ),
    );
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
                const name = window.prompt(t("layers.rename"), layer.name);
                if (name?.trim()) updateLayer(layer.id, { name: name.trim() });
              }}
            >
              {layer.name}
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
              {level.name}
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
            .map((level) => level.name)
            .join(" › ")}
        </div>
      </section>
    </div>
  );
}
