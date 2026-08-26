import { useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import {
    calculateZoomPercent,
    panViewBox,
    screenToCanvasCoordinates,
    zoomViewBoxAtPoint,
    type Point,
    type ViewBox,
} from './canvasMath';

interface CanvasViewProps {
    viewBox: ViewBox;
    onViewBoxChange: (update: (viewBox: ViewBox) => ViewBox) => void;
    onCursorPositionChange: (position: Point | null) => void;
}

interface PanState {
    pointerId: number;
    clientPosition: Point;
}

export function CanvasView({
    viewBox,
    onViewBoxChange,
    onCursorPositionChange,
}: CanvasViewProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const panStateRef = useRef<PanState | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const zoom = Math.round(calculateZoomPercent(viewBox));

    const getCanvasPoint = (clientX: number, clientY: number) => {
        const svg = svgRef.current;

        return svg
            ? screenToCanvasCoordinates(svg, { x: clientX, y: clientY })
            : null;
    };

    const updateCursorPosition = (clientX: number, clientY: number) => {
        onCursorPositionChange(getCanvasPoint(clientX, clientY));
    };

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

        if (!shouldPan) {
            return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        panStateRef.current = {
            pointerId: event.pointerId,
            clientPosition: { x: event.clientX, y: event.clientY },
        };
        setIsPanning(true);
    };

    const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
        const panState = panStateRef.current;

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

    return (
        <div className="canvas-view">
            <svg
                ref={svgRef}
                className={`canvas-svg ${
                    isPanning ? 'canvas-svg--panning' : ''
                }`}
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                preserveAspectRatio="xMidYMid meet"
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={stopPanning}
                onPointerCancel={stopPanning}
                onPointerLeave={() => {
                    if (!panStateRef.current) {
                        onCursorPositionChange(null);
                    }
                }}
                onContextMenu={(event) => event.preventDefault()}
            >
                <defs>
                    {/* Мелкая сетка — 10 мм */}
                    <pattern
                        id="smallGrid"
                        width="10"
                        height="10"
                        patternUnits="userSpaceOnUse"
                    >
                        <path
                            d="M 10 0 L 0 0 0 10"
                            fill="none"
                            stroke="#292c31"
                            strokeWidth="0.5"
                        />
                    </pattern>

                    {/* Крупная сетка — 50 мм */}
                    <pattern
                        id="largeGrid"
                        width="50"
                        height="50"
                        patternUnits="userSpaceOnUse"
                    >
                        <rect
                            width="50"
                            height="50"
                            fill="url(#smallGrid)"
                        />

                        <path
                            d="M 50 0 L 0 0 0 50"
                            fill="none"
                            stroke="#363a41"
                            strokeWidth="1"
                        />
                    </pattern>
                </defs>

                {/* Фон рабочей области */}
                <rect
                    x="0"
                    y="0"
                    width="1000"
                    height="700"
                    fill="#15171a"
                />

                {/* Сетка */}
                <rect
                    x="0"
                    y="0"
                    width="1000"
                    height="700"
                    fill="url(#largeGrid)"
                />

                {/* Центральная ось X */}
                <line
                    x1="0"
                    y1="350"
                    x2="1000"
                    y2="350"
                    stroke="#41464e"
                    strokeWidth="1"
                />

                {/* Центральная ось Y */}
                <line
                    x1="500"
                    y1="0"
                    x2="500"
                    y2="700"
                    stroke="#41464e"
                    strokeWidth="1"
                />

                {/* Тестовая кожаная деталь 100 × 70 мм */}
                <rect
                    x="450"
                    y="315"
                    width="100"
                    height="70"
                    fill="#25282d"
                    stroke="#b8bdc5"
                    strokeWidth="1"
                />

                {/* Размер по горизонтали */}
                <text
                    x="500"
                    y="405"
                    textAnchor="middle"
                    fill="#8e949d"
                    fontSize="10"
                >
                    100 mm
                </text>

                {/* Размер по вертикали */}
                <text
                    x="565"
                    y="350"
                    textAnchor="middle"
                    fill="#8e949d"
                    fontSize="10"
                    transform="rotate(90 565 350)"
                >
                    70 mm
                </text>

                {/* Подпись масштаба */}
                <text
                    x="20"
                    y="30"
                    fill="#666b73"
                    fontSize="11"
                >
                    1 grid = 10 mm
                </text>
            </svg>

            <div className="canvas-info">
                <span>Canvas</span>
                <span>{zoom}%</span>
            </div>
        </div>
    );
}
