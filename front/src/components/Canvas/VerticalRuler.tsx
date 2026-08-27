import { useTranslation } from 'react-i18next';
import { getVisibleTicks, type ViewBox } from './canvasMath';

interface VerticalRulerProps {
    viewBox: ViewBox;
    majorSpacing: number;
    height: number;
}

export function VerticalRuler({
    viewBox,
    majorSpacing,
    height,
}: VerticalRulerProps) {
    const { t } = useTranslation();
    const ticks = getVisibleTicks(
        viewBox.y,
        viewBox.y + viewBox.height,
        majorSpacing,
    );

    return (
        <svg
            className="canvas-ruler-vertical"
            viewBox={`0 0 42 ${Math.max(height, 1)}`}
            preserveAspectRatio="none"
            aria-label={t('ruler.vertical')}
        >
            {ticks.map((tick) => {
                const y = ((tick - viewBox.y) / viewBox.height) * height;

                return (
                    <g key={tick}>
                        <line x1="32" y1={y} x2="42" y2={y} />
                        <text x="29" y={y - 3} textAnchor="end">
                            {tick}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
