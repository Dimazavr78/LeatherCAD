import { useTranslation } from "react-i18next";
import toolsJson from "../../config/tools.json";
import type { ToolConfig } from "../../i18n/types";
import type { Tool } from "../../types/cad";

const tools = toolsJson as ToolConfig[];

interface LeftToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
}

function getToolId(tool: ToolConfig): Tool | null {
  return [
    "select",
    "line",
    "polyline",
    "rectangle",
    "circle",
    "arc",
    "stitch",
  ].includes(tool.id)
    ? (tool.id as Tool)
    : null;
}

export function LeftToolbar({ activeTool, onToolChange }: LeftToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="left-toolbar">
      {(["tools", "leather"] as const).map((category) => (
        <section className="tool-section" key={category}>
          <div className="section-title">
            {t(`toolbar.sections.${category}`).toUpperCase()}
          </div>
          <div className="tool-list">
            {tools
              .filter((tool) => tool.category === category)
              .map((tool) => {
                const toolId = getToolId(tool);
                const label =
                  tool.localization.enabled && tool.localization.label
                    ? t(tool.localization.label)
                    : (tool.label ?? tool.id);
                const tooltip =
                  tool.localization.enabled && tool.localization.tooltip
                    ? t(tool.localization.tooltip)
                    : label;

                return (
                  <button
                    type="button"
                    className={`tool-button ${
                      toolId === activeTool ? "tool-button--active" : ""
                    }`}
                    key={tool.id}
                    title={tooltip}
                    disabled={!tool.enabled || !toolId}
                    onClick={() => toolId && onToolChange(toolId)}
                  >
                    <span className="tool-icon">{tool.icon}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
