interface CanvasViewProps {
    zoom: number;
}

export function CanvasView({ zoom }: CanvasViewProps) {
    return (
        <div className="canvas-view">
            <div className="canvas-info">
                <span>Canvas</span>
                <span>{zoom}%</span>
            </div>

            <div
                className="canvas-content"
                style={{
                    transform: `scale(${zoom / 100})`,
                }}
            >
                <div className="empty-canvas">
                    <div className="empty-canvas-icon">◇</div>
                    <div className="empty-canvas-title">New project</div>
                    <div className="empty-canvas-description">
                        Select a tool to start designing
                    </div>
                </div>
            </div>
        </div>
    );
}