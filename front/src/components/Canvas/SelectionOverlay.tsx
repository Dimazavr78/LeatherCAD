import type { PointerEvent } from 'react';
import type { RectangleObject, ResizeHandle } from '../../types/cad';

const HANDLE_POSITIONS: Array<{
    handle: ResizeHandle;
    x: number;
    y: number;
}> = [
    { handle: 'nw', x: 0, y: 0 },
    { handle: 'n', x: 0.5, y: 0 },
    { handle: 'ne', x: 1, y: 0 },
    { handle: 'e', x: 1, y: 0.5 },
    { handle: 'se', x: 1, y: 1 },
    { handle: 's', x: 0.5, y: 1 },
    { handle: 'sw', x: 0, y: 1 },
    { handle: 'w', x: 0, y: 0.5 },
];

interface SelectionOverlayProps {
    rectangle: RectangleObject;
    screenUnit: number;
    showDimensions: boolean;
    onResizeStart: (
        event: PointerEvent<SVGRectElement>,
        handle: ResizeHandle,
    ) => void;
}

export function SelectionOverlay({
    rectangle,
    screenUnit,
    showDimensions,
    onResizeStart,
}: SelectionOverlayProps) {
    const handleSize = 8 * screenUnit;
    const tooltipWidth = 132 * screenUnit;
    const tooltipHeight = 22 * screenUnit;
    const tooltipX = rectangle.x + rectangle.width - tooltipWidth;
    const tooltipY = rectangle.y + rectangle.height + 10 * screenUnit;

    return (
        <g className="selection-overlay">
            <rect
                className="selection-outline"
                x={rectangle.x}
                y={rectangle.y}
                width={rectangle.width}
                height={rectangle.height}
                vectorEffect="non-scaling-stroke"
            />

            {HANDLE_POSITIONS.map(({ handle, x, y }) => {
                const centerX = rectangle.x + rectangle.width * x;
                const centerY = rectangle.y + rectangle.height * y;

                return (
                    <rect
                        key={handle}
                        className={`selection-handle selection-handle--${handle}`}
                        x={centerX - handleSize / 2}
                        y={centerY - handleSize / 2}
                        width={handleSize}
                        height={handleSize}
                        vectorEffect="non-scaling-stroke"
                        onPointerDown={(event) => onResizeStart(event, handle)}
                    />
                );
            })}

            {showDimensions && (
                <g className="selection-dimensions" pointerEvents="none">
                    <rect
                        x={tooltipX}
                        y={tooltipY}
                        width={tooltipWidth}
                        height={tooltipHeight}
                        rx={3 * screenUnit}
                    />
                    <text
                        x={tooltipX + tooltipWidth / 2}
                        y={tooltipY + 15 * screenUnit}
                        textAnchor="middle"
                        fontSize={11 * screenUnit}
                    >
                        {rectangle.width.toFixed(1)} × {rectangle.height.toFixed(1)} mm
                    </text>
                </g>
            )}
        </g>
    );
}
