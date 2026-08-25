import { useState } from 'react';
import { TopBar } from './TopBar';
import { BottomBar } from './BottomBar';
import { LeftToolbar } from '../Toolbar/LeftToolbar';
import { CanvasView } from '../Canvas/CanvasView';
import { PropertiesPanel } from '../Properties/PropertiesPanel';

export function AppShell() {
    const [zoom, setZoom] = useState(100);
    const [leftCollapsed, setLeftCollapsed] = useState(false);
    const [rightCollapsed, setRightCollapsed] = useState(false);

    const zoomIn = () => {
        setZoom((value) => Math.min(value + 10, 400));
    };

    const zoomOut = () => {
        setZoom((value) => Math.max(value - 10, 10));
    };

    const resetZoom = () => {
        setZoom(100);
    };

    const fitCanvas = () => {
        // Пока просто возвращаем масштаб к 100%.
        // Позже здесь будет настоящий Fit to Content.
        setZoom(100);
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
                    <CanvasView zoom={zoom} />
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
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onResetZoom={resetZoom}
                onFit={fitCanvas}
            />
        </div>
    );
}