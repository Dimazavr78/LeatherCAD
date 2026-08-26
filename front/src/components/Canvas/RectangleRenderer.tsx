import type { PointerEvent } from 'react';
import type { RectangleObject, Tool } from '../../types/cad';

interface RectangleRendererProps {
    rectangle: RectangleObject;
    activeTool: Tool;
    selected: boolean;
    onSelect: (id: string) => void;
}

export function RectangleRenderer({
    rectangle,
    activeTool,
    selected,
    onSelect,
}: RectangleRendererProps) {
    const handlePointerDown = (event: PointerEvent<SVGRectElement>) => {
        const isSelectionClick =
            activeTool === 'select' && event.button === 0 && !event.shiftKey;

        if (!isSelectionClick) {
            return;
        }

        event.stopPropagation();
        onSelect(rectangle.id);
    };

    return (
        <rect
            className={`cad-rectangle ${selected ? 'cad-rectangle--selected' : ''}`}
            x={rectangle.x}
            y={rectangle.y}
            width={rectangle.width}
            height={rectangle.height}
            vectorEffect="non-scaling-stroke"
            onPointerDown={handlePointerDown}
        />
    );
}
