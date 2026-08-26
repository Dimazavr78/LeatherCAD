import { getVisibleTicks, type ViewBox } from './canvasMath';

interface HorizontalRulerProps {
    viewBox: ViewBox;
    majorSpacing: number;
    width: number;
}

export function HorizontalRuler({
    viewBox,
    majorSpacing,
    width,
}: HorizontalRulerProps) {
    const ticks = getVisibleTicks(
        viewBox.x,
        viewBox.x + viewBox.width,
        majorSpacing,
    );

    return (
        <svg
            className="canvas-ruler-horizontal"
            viewBox={`0 0 ${Math.max(width, 1)} 24`}
            preserveAspectRatio="none"
            aria-label="Horizontal ruler"
        >
            {ticks.map((tick) => {
                const x = ((tick - viewBox.x) / viewBox.width) * width;

                return (
                    <g key={tick}>
                        <line x1={x} y1="15" x2={x} y2="24" />
                        <text x={x + 3} y="11">
                            {tick}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
