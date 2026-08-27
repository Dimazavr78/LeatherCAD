import { useTranslation } from 'react-i18next';
import menusJson from '../../config/menus.json';
import { changeLanguage } from '../../i18n';
import type { MenuConfig, SupportedLanguage } from '../../i18n/types';

const menus = menusJson as MenuConfig[];

interface TopBarProps {
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
}

export function TopBar({ canUndo, canRedo, onUndo, onRedo }: TopBarProps) {
    const { t, i18n } = useTranslation();
    const currentLanguage: SupportedLanguage =
        i18n.resolvedLanguage === 'ru' ? 'ru' : 'en';

    return (
        <header className="top-bar">
            <div className="brand">
                <div className="brand-mark">L</div>
                <span className="brand-name">{t('app.name')}</span>
            </div>

            <nav className="menu">
                {menus.map((menu) => {
                    const label =
                        menu.localization.enabled && menu.localization.label
                            ? t(menu.localization.label)
                            : (menu.label ?? menu.id);

                    return <button key={menu.id}>{label}</button>;
                })}
            </nav>

            <div className="history-controls">
                <button
                    type="button"
                    onClick={onUndo}
                    disabled={!canUndo}
                    title={`${t('actions.undo')} (Ctrl+Z)`}
                    aria-label={t('actions.undo')}
                >
                    ↶
                </button>
                <button
                    type="button"
                    onClick={onRedo}
                    disabled={!canRedo}
                    title={`${t('actions.redo')} (Ctrl+Y)`}
                    aria-label={t('actions.redo')}
                >
                    ↷
                </button>
            </div>

            <div className="language-control">
                <label htmlFor="language-select">{t('language.title')}</label>
                <select
                    id="language-select"
                    value={currentLanguage}
                    onChange={(event) =>
                        void changeLanguage(
                            event.target.value as SupportedLanguage,
                        )
                    }
                >
                    <option value="en">EN</option>
                    <option value="ru">RU</option>
                </select>
            </div>

            <div className="local-status">
                <span className="status-dot" />
                {t('app.local')}
            </div>
        </header>
    );
}
