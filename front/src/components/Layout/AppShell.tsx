import { useState } from 'react';
import { TopBar } from './TopBar';
import { BottomBar } from './BottomBar';
import { LeftToolbar } from '../Toolbar/LeftToolbar';
import { CanvasView } from '../Canvas/CanvasView';
import { PropertiesPanel } from '../Properties/PropertiesPanel';
import {
    calculateZoomPercent,
    getGridSpacing,
    getViewBoxCenter,
    INITIAL_VIEWBOX,
    zoomViewBoxAtPoint,
    type Point,
    type ViewBox,
} from '../Canvas/canvasMath';

export function AppShell() {
    const [viewBox, setViewBox] = useState<ViewBox>(INITIAL_VIEWBOX);
    const [cursorPosition, setCursorPosition] = useState<Point | null>(null);
    const [snapEnabled, setSnapEnabled] = useState(true);
    const [leftCollapsed, setLeftCollapsed] = useState(false);
    const [rightCollapsed, setRightCollapsed] = useState(false);
    const zoom = Math.round(calculateZoomPercent(viewBox));
    const gridSpacing = getGridSpacing(zoom);

    const setZoomAroundCenter = (requestedZoom: number) => {
        setViewBox((currentViewBox) =>
            zoomViewBoxAtPoint(
                currentViewBox,
                getViewBoxCenter(currentViewBox),
                requestedZoom,
            ),
        );
    };

    const zoomIn = () => {
        setZoomAroundCenter(zoom + 10);
    };

    const zoomOut = () => {
        setZoomAroundCenter(zoom - 10);
    };

    const resetZoom = () => {
        setZoomAroundCenter(100);
    };

    const fitCanvas = () => {
        setViewBox(INITIAL_VIEWBOX);
    };

    return (
        <div className="app-shell">
            <TopBar />

            <div className="workspace">
                <aside
                    className={`left-panel ${
                        leftCollapsed ? 'left-panel--collapsed' : ''
                    }`}
                >
                    {!leftCollapsed && <LeftToolbar />}

                    <button
                        className="panel-collapse-button panel-collapse-button--left"
                        onClick={() => setLeftCollapsed((value) => !value)}
                        title={leftCollapsed ? 'Развернуть' : 'Свернуть'}
                    >
                        {leftCollapsed ? '›' : '‹'}
                    </button>
                </aside>

                <main className="canvas-area">
                    <CanvasView
                        viewBox={viewBox}
                        onViewBoxChange={setViewBox}
                        onCursorPositionChange={setCursorPosition}
                    />
                </main>

                <aside
                    className={`right-panel ${
                        rightCollapsed ? 'right-panel--collapsed' : ''
                    }`}
                >
                    <button
                        className="panel-collapse-button panel-collapse-button--right"
                        onClick={() => setRightCollapsed((value) => !value)}
                        title={rightCollapsed ? 'Развернуть' : 'Свернуть'}
                    >
                        {rightCollapsed ? '‹' : '›'}
                    </button>

                    {!rightCollapsed && <PropertiesPanel />}
                </aside>
            </div>

            <BottomBar
                zoom={zoom}
                cursorPosition={cursorPosition}
                gridSpacing={gridSpacing.minor}
                snapEnabled={snapEnabled}
                onSnapToggle={() => setSnapEnabled((enabled) => !enabled)}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onResetZoom={resetZoom}
                onFit={fitCanvas}
            />
        </div>
    );
}
