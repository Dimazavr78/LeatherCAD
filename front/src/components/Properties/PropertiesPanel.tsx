export function PropertiesPanel() {
    return (
        <div className="properties-panel">
            <div className="properties-header">
                <span>PROPERTIES</span>
            </div>

            <div className="properties-empty">
                <div className="properties-empty-icon">◇</div>

                <div className="properties-empty-title">
                    Nothing selected
                </div>

                <div className="properties-empty-description">
                    Select an object on the canvas to see its properties.
                </div>
            </div>
        </div>
    );
}