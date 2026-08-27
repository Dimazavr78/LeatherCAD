import { useTranslation } from 'react-i18next';
import type { Point } from '../Canvas/canvasMath';

interface BottomBarProps {
    zoom: number;
    cursorPosition: Point | null;
    gridSpacing: number;
    snapEnabled: boolean;
    onSnapToggle: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    onFit: () => void;
}

export function BottomBar({
                              zoom,
                              cursorPosition,
                              gridSpacing,
                              snapEnabled,
                              onSnapToggle,
                              onZoomIn,
                              onZoomOut,
                              onResetZoom,
                              onFit,
                          }: BottomBarProps) {
    const { t } = useTranslation();
    const unit = t('common.mm');

    return (
        <footer className="bottom-bar">
            <div className="coordinates">
                <span>
                    X: {cursorPosition ? `${cursorPosition.x.toFixed(2)} ${unit}` : '—'}
                </span>
                <span>
                    Y: {cursorPosition ? `${cursorPosition.y.toFixed(2)} ${unit}` : '—'}
                </span>
                <span>
                    {t('canvas.grid')}: {gridSpacing} {unit}
                </span>
                <button
                    className={`snap-toggle ${snapEnabled ? 'snap-toggle--active' : ''}`}
                    onClick={onSnapToggle}
                    aria-pressed={snapEnabled}
                >
                    {t('canvas.snap')}:{' '}
                    {snapEnabled ? t('common.on') : t('common.off')}
                </button>
            </div>

            <div className="zoom-controls">
                <button onClick={onFit}>{t('zoom.fit')}</button>

                <button onClick={onZoomOut} aria-label={t('zoom.out')}>
                    −
                </button>

                <button className="zoom-value" onClick={onResetZoom}>
                    {zoom}%
                </button>

                <button onClick={onZoomIn} aria-label={t('zoom.in')}>
                    +
                </button>
            </div>
        </footer>
    );
}
