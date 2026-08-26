import type { Point } from '../Canvas/canvasMath';

interface BottomBarProps {
    zoom: number;
    cursorPosition: Point | null;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    onFit: () => void;
}

export function BottomBar({
                              zoom,
                              cursorPosition,
                              onZoomIn,
                              onZoomOut,
                              onResetZoom,
                              onFit,
                          }: BottomBarProps) {
    return (
        <footer className="bottom-bar">
            <div className="coordinates">
                <span>
                    X: {cursorPosition ? `${cursorPosition.x.toFixed(2)} mm` : '—'}
                </span>
                <span>
                    Y: {cursorPosition ? `${cursorPosition.y.toFixed(2)} mm` : '—'}
                </span>
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
