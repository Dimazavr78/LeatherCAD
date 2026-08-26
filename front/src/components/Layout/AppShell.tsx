import { useCallback, useState } from 'react';
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
import type { CadObject, RectangleObject, Tool } from '../../types/cad';

export function AppShell() {
    const [objects, setObjects] = useState<CadObject[]>([]);
    const [activeTool, setActiveTool] = useState<Tool>('select');
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [viewBox, setViewBox] = useState<ViewBox>(INITIAL_VIEWBOX);
    const [cursorPosition, setCursorPosition] = useState<Point | null>(null);
    const [snapEnabled, setSnapEnabled] = useState(true);
    const [leftCollapsed, setLeftCollapsed] = useState(false);
    const [rightCollapsed, setRightCollapsed] = useState(false);
    const zoom = Math.round(calculateZoomPercent(viewBox));
    const gridSpacing = getGridSpacing(zoom);
    const selectedObject =
        objects.find((object) => object.id === selectedObjectId) ?? null;

    const addObject = (object: RectangleObject) => {
        setObjects((currentObjects) => [...currentObjects, object]);
        setSelectedObjectId(object.id);
    };

    const updateObject = useCallback((
        id: string,
        patch: Partial<Omit<RectangleObject, 'id' | 'type'>>,
    ) => {
        setObjects((currentObjects) =>
            currentObjects.map((object) =>
                object.id === id ? { ...object, ...patch } : object,
            ),
        );
    }, []);

    const replaceObject = useCallback((updatedObject: RectangleObject) => {
        setObjects((currentObjects) =>
            currentObjects.map((object) =>
                object.id === updatedObject.id ? updatedObject : object,
            ),
        );
    }, []);

    const deleteObject = useCallback((id: string) => {
        setObjects((currentObjects) =>
            currentObjects.filter((object) => object.id !== id),
        );
        setSelectedObjectId(null);
    }, []);

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
                    {!leftCollapsed && (
                        <LeftToolbar
                            activeTool={activeTool}
                            onToolChange={setActiveTool}
                        />
                    )}

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
                        objects={objects}
                        activeTool={activeTool}
                        selectedObjectId={selectedObjectId}
                        snapEnabled={snapEnabled}
                        snapSpacing={gridSpacing.minor}
                        onViewBoxChange={setViewBox}
                        onCursorPositionChange={setCursorPosition}
                        onObjectCreate={addObject}
                        onObjectUpdate={replaceObject}
                        onObjectDelete={deleteObject}
                        onSelectionChange={setSelectedObjectId}
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

                    {!rightCollapsed && (
                        <PropertiesPanel
                            selectedObject={selectedObject}
                            onObjectChange={updateObject}
                        />
                    )}
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
