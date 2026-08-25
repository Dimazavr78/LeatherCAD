const drawingTools = [
    { icon: '↖', name: 'Select' },
    { icon: '╱', name: 'Line' },
    { icon: '□', name: 'Rectangle' },
    { icon: '○', name: 'Circle' },
    { icon: '⌒', name: 'Arc' },
];

const leatherTools = [
    { icon: '◇', name: 'Part' },
    { icon: '⌁', name: 'Stitch' },
    { icon: '○', name: 'Holes' },
    { icon: '◆', name: 'Hardware' },
    { icon: '⌞', name: 'Fold' },
];

export function LeftToolbar() {
    return (
        <div className="left-toolbar">
            <ToolSection title="TOOLS" tools={drawingTools} />

            <ToolSection title="LEATHER" tools={leatherTools} />
        </div>
    );
}

function ToolSection({
                         title,
                         tools,
                     }: {
    title: string;
    tools: { icon: string; name: string }[];
}) {
    return (
        <section className="tool-section">
            <div className="section-title">{title}</div>

            <div className="tool-list">
                {tools.map((tool) => (
                    <button className="tool-button" key={tool.name}>
                        <span className="tool-icon">{tool.icon}</span>
                        <span>{tool.name}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}