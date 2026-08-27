import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CanvasView } from '../Canvas/CanvasView';
import {
    calculateZoomPercent,
    getGridSpacing,
    getViewBoxCenter,
    INITIAL_VIEWBOX,
    zoomViewBoxAtPoint,
    type Point,
    type ViewBox,
} from '../Canvas/canvasMath';
import { PropertiesPanel } from '../Properties/PropertiesPanel';
import { LeftToolbar } from '../Toolbar/LeftToolbar';
import {
    cloneCadObject,
    cloneCadObjectWithOffset,
    translateCadObject,
} from '../../editor/cadObjectUtils';
import { useEditorHistory } from '../../editor/history/useEditorHistory';
import {
    useEditorShortcuts,
    type NudgeDirection,
} from '../../editor/useEditorShortcuts';
import type { CadObject, RectangleObject, Tool } from '../../types/cad';
import { BottomBar } from './BottomBar';
import { TopBar } from './TopBar';

const PASTE_OFFSET = 10;
const NUDGE_SMALL = 1;
const NUDGE_LARGE = 10;

export function AppShell() {
    const { t } = useTranslation();
    const {
        state,
        canUndo,
        canRedo,
        commitState,
        updateLiveState,
        beginTransaction,
        commitTransaction,
        cancelTransaction,
        undo,
        redo,
    } = useEditorHistory({ objects: [] });
    const objects = state.objects;
    const [activeTool, setActiveTool] = useState<Tool>('select');
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [clipboard, setClipboard] = useState<CadObject[]>([]);
    const [canvasBusy, setCanvasBusy] = useState(false);
    const [viewBox, setViewBox] = useState<ViewBox>(INITIAL_VIEWBOX);
    const [cursorPosition, setCursorPosition] = useState<Point | null>(null);
    const [snapEnabled, setSnapEnabled] = useState(true);
    const [leftCollapsed, setLeftCollapsed] = useState(false);
    const [rightCollapsed, setRightCollapsed] = useState(false);
    const pasteCountRef = useRef(0);
    const zoom = Math.round(calculateZoomPercent(viewBox));
    const gridSpacing = getGridSpacing(zoom);
    const selectedObject =
        objects.find((object) => object.id === selectedObjectId) ?? null;

    const requestCancel = useCallback(() => {
        window.dispatchEvent(new Event('leathercad:cancel'));
    }, []);

    const addObject = useCallback(
        (object: RectangleObject) => {
            commitState((document) => ({
                objects: [...document.objects, object],
            }));
            setSelectedObjectId(object.id);
        },
        [commitState],
    );

    const updateObject = useCallback(
        (
            id: string,
            patch: Partial<Omit<RectangleObject, 'id' | 'type'>>,
        ) => {
            updateLiveState((document) => ({
                objects: document.objects.map((object) =>
                    object.id === id ? { ...object, ...patch } : object,
                ),
            }));
        },
        [updateLiveState],
    );

    const replaceObject = useCallback(
        (updatedObject: RectangleObject) => {
            updateLiveState((document) => ({
                objects: document.objects.map((object) =>
                    object.id === updatedObject.id ? updatedObject : object,
                ),
            }));
        },
        [updateLiveState],
    );

    const deleteSelected = useCallback(() => {
        if (canvasBusy) {
            requestCancel();
            return;
        }

        if (!selectedObjectId) {
            return;
        }

        commitState((document) => ({
            objects: document.objects.filter(
                (object) => object.id !== selectedObjectId,
            ),
        }));
        setSelectedObjectId(null);
    }, [canvasBusy, commitState, requestCancel, selectedObjectId]);

    const undoAction = useCallback(() => {
        if (canvasBusy) {
            requestCancel();
            return;
        }

        undo();
        setSelectedObjectId(null);
    }, [canvasBusy, requestCancel, undo]);

    const redoAction = useCallback(() => {
        if (canvasBusy) {
            requestCancel();
            return;
        }

        redo();
        setSelectedObjectId(null);
    }, [canvasBusy, redo, requestCancel]);

    const copySelected = useCallback(() => {
        if (!selectedObject) {
            return;
        }

        setClipboard([cloneCadObject(selectedObject)]);
        pasteCountRef.current = 0;
    }, [selectedObject]);

    const paste = useCallback(() => {
        if (clipboard.length === 0) {
            return;
        }

        pasteCountRef.current += 1;
        const offset = PASTE_OFFSET * pasteCountRef.current;
        const pastedObjects = clipboard.map((object) =>
            cloneCadObjectWithOffset(object, offset),
        );

        commitState((document) => ({
            objects: [...document.objects, ...pastedObjects],
        }));
        setSelectedObjectId(pastedObjects.at(-1)?.id ?? null);
    }, [clipboard, commitState]);

    const duplicate = useCallback(() => {
        if (!selectedObject) {
            return;
        }

        const duplicateObject = cloneCadObjectWithOffset(
            selectedObject,
            PASTE_OFFSET,
        );
        commitState((document) => ({
            objects: [...document.objects, duplicateObject],
        }));
        setSelectedObjectId(duplicateObject.id);
    }, [commitState, selectedObject]);

    const nudge = useCallback(
        (direction: NudgeDirection, largeStep: boolean) => {
            if (activeTool !== 'select' || !selectedObject) {
                return;
            }

            const step = largeStep ? NUDGE_LARGE : NUDGE_SMALL;
            const deltaX =
                direction === 'left' ? -step : direction === 'right' ? step : 0;
            const deltaY =
                direction === 'up' ? -step : direction === 'down' ? step : 0;
            const movedObject = translateCadObject(
                selectedObject,
                deltaX,
                deltaY,
            );

            commitState((document) => ({
                objects: document.objects.map((object) =>
                    object.id === movedObject.id ? movedObject : object,
                ),
            }));
        },
        [activeTool, commitState, selectedObject],
    );

    const shortcutActions = useMemo(
        () => ({
            undo: undoAction,
            redo: redoAction,
            copy: copySelected,
            paste,
            duplicate,
            deleteSelected,
            nudge,
            cancel: requestCancel,
        }),
        [
            copySelected,
            deleteSelected,
            duplicate,
            nudge,
            paste,
            redoAction,
            requestCancel,
            undoAction,
        ],
    );
    useEditorShortcuts(shortcutActions);

    const setZoomAroundCenter = (requestedZoom: number) => {
        setViewBox((currentViewBox) =>
            zoomViewBoxAtPoint(
                currentViewBox,
                getViewBoxCenter(currentViewBox),
                requestedZoom,
            ),
        );
    };

    return (
        <div className="app-shell">
            <TopBar
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undoAction}
                onRedo={redoAction}
            />

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
                        title={
                            leftCollapsed
                                ? t('panels.expand')
                                : t('panels.collapse')
                        }
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
                        onSelectionChange={setSelectedObjectId}
                        onInteractionStart={beginTransaction}
                        onInteractionCommit={commitTransaction}
                        onInteractionCancel={cancelTransaction}
                        onBusyChange={setCanvasBusy}
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
                        title={
                            rightCollapsed
                                ? t('panels.expand')
                                : t('panels.collapse')
                        }
                    >
                        {rightCollapsed ? '‹' : '›'}
                    </button>
                    {!rightCollapsed && (
                        <PropertiesPanel
                            selectedObject={selectedObject}
                            onObjectChange={updateObject}
                            onEditStart={beginTransaction}
                            onEditCommit={commitTransaction}
                            onEditCancel={cancelTransaction}
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
                onZoomIn={() => setZoomAroundCenter(zoom + 10)}
                onZoomOut={() => setZoomAroundCenter(zoom - 10)}
                onResetZoom={() => setZoomAroundCenter(100)}
                onFit={() => setViewBox(INITIAL_VIEWBOX)}
            />
        </div>
    );
}
