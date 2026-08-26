import type { Point } from '../Canvas/canvasMath';

interface BottomBarProps {
    zoom: number;
    cursorPosition: Point | null;
    gridSpacing: number;
    snapEnabled: boolean;
    onSnapToggle: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    onFit: () => void;
}

export function BottomBar({
                              zoom,
                              cursorPosition,
                              gridSpacing,
                              snapEnabled,
                              onSnapToggle,
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
                <span>Grid: {gridSpacing} mm</span>
                <button
                    className={`snap-toggle ${snapEnabled ? 'snap-toggle--active' : ''}`}
                    onClick={onSnapToggle}
                    aria-pressed={snapEnabled}
                >
                    Snap: {snapEnabled ? 'ON' : 'OFF'}
                </button>
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
