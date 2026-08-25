interface BottomBarProps {
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    onFit: () => void;
}

export function BottomBar({
                              zoom,
                              onZoomIn,
                              onZoomOut,
                              onResetZoom,
                              onFit,
                          }: BottomBarProps) {
    return (
        <footer className="bottom-bar">
            <div className="coordinates">
                <span>X: 0.00 mm</span>
                <span>Y: 0.00 mm</span>
            </div>

            <div className="zoom-controls">
                <button onClick={onFit}>Fit</button>

                <button onClick={onZoomOut} aria-label="Zoom out">
                    −
                </button>

                <button className="zoom-value" onClick={onResetZoom}>
                    {zoom}%
                </button>

                <button onClick={onZoomIn} aria-label="Zoom in">
                    +
                </button>
            </div>
        </footer>
    );
}