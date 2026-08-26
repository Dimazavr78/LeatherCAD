import {
    useEffect,
    useRef,
    useState,
    type PointerEvent,
    type WheelEvent,
} from 'react';
import { HorizontalRuler } from './HorizontalRuler';
import { RectangleRenderer } from './RectangleRenderer';
import { VerticalRuler } from './VerticalRuler';
import {
    calculateZoomPercent,
    getGridSpacing,
    panViewBox,
    screenToCanvasCoordinates,
    snapToGrid,
    zoomViewBoxAtPoint,
    type Point,
    type ViewBox,
} from './canvasMath';
import type { CadObject, RectangleObject, Tool } from '../../types/cad';

interface CanvasViewProps {
    viewBox: ViewBox;
    objects: CadObject[];
    activeTool: Tool;
    selectedObjectId: string | null;
    snapEnabled: boolean;
    snapSpacing: number;
    onViewBoxChange: (update: (viewBox: ViewBox) => ViewBox) => void;
    onCursorPositionChange: (position: Point | null) => void;
    onObjectCreate: (object: RectangleObject) => void;
    onSelectionChange: (id: string | null) => void;
}

interface PanState {
    pointerId: number;
    clientPosition: Point;
}

interface CanvasSize {
    width: number;
    height: number;
}

interface RectangleDraft {
    pointerId: number;
    start: Point;
    current: Point;
}

const MIN_RECTANGLE_SIZE = 1;

function normalizeRectangle(start: Point, current: Point) {
    return {
        x: Math.min(start.x, current.x),
        y: Math.min(start.y, current.y),
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y),
    };
}

export function CanvasView({
    viewBox,
    objects,
    activeTool,
    selectedObjectId,
    snapEnabled,
    snapSpacing,
    onViewBoxChange,
    onCursorPositionChange,
    onObjectCreate,
    onSelectionChange,
}: CanvasViewProps) {
    const stageRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const panStateRef = useRef<PanState | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [rectangleDraft, setRectangleDraft] = useState<RectangleDraft | null>(null);
    const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 1, height: 1 });
    const zoom = calculateZoomPercent(viewBox);
    const gridSpacing = getGridSpacing(zoom);
    const gridX = viewBox.x - viewBox.width;
    const gridY = viewBox.y - viewBox.height;
    const gridWidth = viewBox.width * 3;
    const gridHeight = viewBox.height * 3;

    useEffect(() => {
        const stage = stageRef.current;

        if (!stage) {
            return;
        }

        const resizeObserver = new ResizeObserver(([entry]) => {
            if (!entry) {
                return;
            }

            const { width, height } = entry.contentRect;

            if (width <= 0 || height <= 0) {
                return;
            }

            setCanvasSize({ width, height });
            onViewBoxChange((currentViewBox) => {
                const nextHeight = currentViewBox.width * (height / width);

                if (Math.abs(nextHeight - currentViewBox.height) < 0.001) {
                    return currentViewBox;
                }

                const centerY = currentViewBox.y + currentViewBox.height / 2;

                return {
                    ...currentViewBox,
                    y: centerY - nextHeight / 2,
                    height: nextHeight,
                };
            });
        });

        resizeObserver.observe(stage);

        return () => resizeObserver.disconnect();
    }, [onViewBoxChange]);

    useEffect(() => {
        const cancelDraft = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || !rectangleDraft) {
                return;
            }

            const svg = svgRef.current;

            if (svg?.hasPointerCapture(rectangleDraft.pointerId)) {
                svg.releasePointerCapture(rectangleDraft.pointerId);
            }

            setRectangleDraft(null);
        };

        window.addEventListener('keydown', cancelDraft);
        return () => window.removeEventListener('keydown', cancelDraft);
    }, [rectangleDraft]);

    const getCanvasPoint = (clientX: number, clientY: number) => {
        const svg = svgRef.current;

        return svg
            ? screenToCanvasCoordinates(svg, { x: clientX, y: clientY })
            : null;
    };

    const updateCursorPosition = (clientX: number, clientY: number) => {
        onCursorPositionChange(getCanvasPoint(clientX, clientY));
    };

    const applySnap = (point: Point): Point =>
        snapEnabled
            ? {
                  x: snapToGrid(point.x, snapSpacing),
                  y: snapToGrid(point.y, snapSpacing),
              }
            : point;

    const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
        event.preventDefault();
        const point = getCanvasPoint(event.clientX, event.clientY);

        if (!point) {
            return;
        }

        const zoomFactor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
        onViewBoxChange((currentViewBox) =>
            zoomViewBoxAtPoint(
                currentViewBox,
                point,
                calculateZoomPercent(currentViewBox) * zoomFactor,
            ),
        );
        onCursorPositionChange(point);
    };

    const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
        const shouldPan =
            event.button === 1 || (event.button === 0 && event.shiftKey);

        if (shouldPan) {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            panStateRef.current = {
                pointerId: event.pointerId,
                clientPosition: { x: event.clientX, y: event.clientY },
            };
            setIsPanning(true);
            return;
        }

        if (event.button !== 0) {
            return;
        }

        if (activeTool === 'rectangle') {
            const point = getCanvasPoint(event.clientX, event.clientY);

            if (!point) {
                return;
            }

            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            const snappedPoint = applySnap(point);
            setRectangleDraft({
                pointerId: event.pointerId,
                start: snappedPoint,
                current: snappedPoint,
            });
        } else {
            onSelectionChange(null);
        }
    };

    const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
        const panState = panStateRef.current;

        if (rectangleDraft?.pointerId === event.pointerId) {
            const point = getCanvasPoint(event.clientX, event.clientY);

            if (point) {
                setRectangleDraft({
                    ...rectangleDraft,
                    current: applySnap(point),
                });
            }
        }

        if (panState?.pointerId === event.pointerId) {
            const previousPoint = getCanvasPoint(
                panState.clientPosition.x,
                panState.clientPosition.y,
            );
            const currentPoint = getCanvasPoint(event.clientX, event.clientY);

            if (previousPoint && currentPoint) {
                onViewBoxChange((currentViewBox) =>
                    panViewBox(currentViewBox, {
                        x: currentPoint.x - previousPoint.x,
                        y: currentPoint.y - previousPoint.y,
                    }),
                );
            }

            panState.clientPosition = { x: event.clientX, y: event.clientY };
        }

        updateCursorPosition(event.clientX, event.clientY);
    };

    const stopPanning = (event: PointerEvent<SVGSVGElement>) => {
        if (panStateRef.current?.pointerId !== event.pointerId) {
            return;
        }

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        panStateRef.current = null;
        setIsPanning(false);
    };

    const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
        if (rectangleDraft?.pointerId === event.pointerId) {
            const pointerPosition = getCanvasPoint(event.clientX, event.clientY);
            const endPoint = pointerPosition
                ? applySnap(pointerPosition)
                : rectangleDraft.current;
            const geometry = normalizeRectangle(
                rectangleDraft.start,
                endPoint,
            );

            if (
                geometry.width >= MIN_RECTANGLE_SIZE &&
                geometry.height >= MIN_RECTANGLE_SIZE
            ) {
                onObjectCreate({
                    id: crypto.randomUUID(),
                    type: 'rectangle',
                    ...geometry,
                });
            }

            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }

            setRectangleDraft(null);
            return;
        }

        stopPanning(event);
    };

    const draftGeometry = rectangleDraft
        ? normalizeRectangle(rectangleDraft.start, rectangleDraft.current)
        : null;

    return (
        <div className="canvas-view">
            <div className="canvas-ruler-corner" aria-hidden="true" />
            <HorizontalRuler
                viewBox={viewBox}
                majorSpacing={gridSpacing.major}
                width={canvasSize.width}
            />
            <VerticalRuler
                viewBox={viewBox}
                majorSpacing={gridSpacing.major}
                height={canvasSize.height}
            />

            <div ref={stageRef} className="canvas-stage">
                <svg
                    ref={svgRef}
                    className={`canvas-svg canvas-svg--${activeTool} ${
                        isPanning ? 'canvas-svg--panning' : ''
                    }`}
                    viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                    preserveAspectRatio="none"
                    onWheel={handleWheel}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={(event) => {
                        setRectangleDraft(null);
                        stopPanning(event);
                    }}
                    onPointerLeave={() => {
                        if (!panStateRef.current) {
                            onCursorPositionChange(null);
                        }
                    }}
                    onContextMenu={(event) => event.preventDefault()}
                >
                    <defs>
                        <pattern
                            id="minorGrid"
                            width={gridSpacing.minor}
                            height={gridSpacing.minor}
                            patternUnits="userSpaceOnUse"
                        >
                            <path
                                d={`M ${gridSpacing.minor} 0 L 0 0 0 ${gridSpacing.minor}`}
                                fill="none"
                                stroke="#292c31"
                                strokeWidth="0.5"
                                vectorEffect="non-scaling-stroke"
                            />
                        </pattern>
                        <pattern
                            id="adaptiveGrid"
                            width={gridSpacing.major}
                            height={gridSpacing.major}
                            patternUnits="userSpaceOnUse"
                        >
                            <rect
                                width={gridSpacing.major}
                                height={gridSpacing.major}
                                fill="url(#minorGrid)"
                            />
                            <path
                                d={`M ${gridSpacing.major} 0 L 0 0 0 ${gridSpacing.major}`}
                                fill="none"
                                stroke="#3a3e45"
                                strokeWidth="1"
                                vectorEffect="non-scaling-stroke"
                            />
                        </pattern>
                    </defs>

                    <rect x={gridX} y={gridY} width={gridWidth} height={gridHeight} fill="#15171a" />
                    <rect
                        x={gridX}
                        y={gridY}
                        width={gridWidth}
                        height={gridHeight}
                        fill="url(#adaptiveGrid)"
                    />
                    <line
                        x1={gridX}
                        y1="0"
                        x2={gridX + gridWidth}
                        y2="0"
                        className="canvas-origin-axis"
                    />
                    <line
                        x1="0"
                        y1={gridY}
                        x2="0"
                        y2={gridY + gridHeight}
                        className="canvas-origin-axis"
                    />
                    <circle cx="0" cy="0" r="3" className="canvas-origin-mark" />

                    {objects.map((object) => (
                        <RectangleRenderer
                            key={object.id}
                            rectangle={object}
                            activeTool={activeTool}
                            selected={object.id === selectedObjectId}
                            onSelect={onSelectionChange}
                        />
                    ))}

                    {draftGeometry && (
                        <rect
                            className="cad-rectangle-draft"
                            {...draftGeometry}
                            vectorEffect="non-scaling-stroke"
                        />
                    )}
                </svg>

                <div className="canvas-info">
                    <span>Canvas</span>
                    <span>{Math.round(zoom)}%</span>
                    <span>Objects: {objects.length}</span>
                </div>
            </div>
        </div>
    );
}
