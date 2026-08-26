import type { Tool } from '../../types/cad';

interface ToolDefinition {
    icon: string;
    name: string;
    tool?: Tool;
}

const drawingTools: ToolDefinition[] = [
    { icon: '↖', name: 'Select', tool: 'select' },
    { icon: '╱', name: 'Line' },
    { icon: '□', name: 'Rectangle', tool: 'rectangle' },
    { icon: '○', name: 'Circle' },
    { icon: '⌒', name: 'Arc' },
];

const leatherTools: ToolDefinition[] = [
    { icon: '◇', name: 'Part' },
    { icon: '⌁', name: 'Stitch' },
    { icon: '○', name: 'Holes' },
    { icon: '◆', name: 'Hardware' },
    { icon: '⌞', name: 'Fold' },
];

interface LeftToolbarProps {
    activeTool: Tool;
    onToolChange: (tool: Tool) => void;
}

export function LeftToolbar({ activeTool, onToolChange }: LeftToolbarProps) {
    return (
        <div className="left-toolbar">
            <ToolSection
                title="TOOLS"
                tools={drawingTools}
                activeTool={activeTool}
                onToolChange={onToolChange}
            />
            <ToolSection
                title="LEATHER"
                tools={leatherTools}
                activeTool={activeTool}
                onToolChange={onToolChange}
            />
        </div>
    );
}

interface ToolSectionProps extends LeftToolbarProps {
    title: string;
    tools: ToolDefinition[];
}

function ToolSection({
    title,
    tools,
    activeTool,
    onToolChange,
}: ToolSectionProps) {
    return (
        <section className="tool-section">
            <div className="section-title">{title}</div>
            <div className="tool-list">
                {tools.map((tool) => (
                    <button
                        type="button"
                        className={`tool-button ${
                            tool.tool === activeTool ? 'tool-button--active' : ''
                        }`}
                        key={tool.name}
                        disabled={!tool.tool}
                        onClick={() => tool.tool && onToolChange(tool.tool)}
                    >
                        <span className="tool-icon">{tool.icon}</span>
                        <span>{tool.name}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}
