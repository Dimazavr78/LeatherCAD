import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { RectangleObject } from '../../types/cad';

interface PropertiesPanelProps {
    selectedObject: RectangleObject | null;
    onObjectChange: (
        id: string,
        patch: Partial<Omit<RectangleObject, 'id' | 'type'>>,
    ) => void;
}

export function PropertiesPanel({
    selectedObject,
    onObjectChange,
}: PropertiesPanelProps) {
    const { t } = useTranslation();

    return (
        <div className="properties-panel">
            <div className="properties-header">
                <span>{t('properties.title').toUpperCase()}</span>
            </div>

            {selectedObject ? (
                <RectangleProperties
                    rectangle={selectedObject}
                    onObjectChange={onObjectChange}
                />
            ) : (
                <div className="properties-empty">
                    <div className="properties-empty-icon">◇</div>
                    <div className="properties-empty-title">
                        {t('properties.nothingSelected')}
                    </div>
                    <div className="properties-empty-description">
                        {t('properties.nothingSelectedDescription')}
                    </div>
                </div>
            )}
        </div>
    );
}

interface RectanglePropertiesProps {
    rectangle: RectangleObject;
    onObjectChange: PropertiesPanelProps['onObjectChange'];
}

function RectangleProperties({
    rectangle,
    onObjectChange,
}: RectanglePropertiesProps) {
    const { t } = useTranslation();
    const updateNumber = (
        field: 'x' | 'y' | 'width' | 'height',
        value: string,
    ) => {
        const parsedValue = Number(value);

        if (!Number.isFinite(parsedValue)) {
            return;
        }

        const nextValue =
            field === 'width' || field === 'height'
                ? Math.max(0.1, parsedValue)
                : parsedValue;
        onObjectChange(rectangle.id, { [field]: nextValue });
    };

    return (
        <div className="properties-form">
            <div className="properties-object-type">
                {t('properties.rectangle.title').toUpperCase()}
            </div>
            <PropertyGroup title={t('properties.sections.position').toUpperCase()}>
                <NumericProperty
                    label={t('properties.fields.x')}
                    value={rectangle.x}
                    onChange={(value) => updateNumber('x', value)}
                />
                <NumericProperty
                    label={t('properties.fields.y')}
                    value={rectangle.y}
                    onChange={(value) => updateNumber('y', value)}
                />
            </PropertyGroup>
            <PropertyGroup title={t('properties.sections.size').toUpperCase()}>
                <NumericProperty
                    label={t('properties.fields.width')}
                    value={rectangle.width}
                    min={0.1}
                    onChange={(value) => updateNumber('width', value)}
                />
                <NumericProperty
                    label={t('properties.fields.height')}
                    value={rectangle.height}
                    min={0.1}
                    onChange={(value) => updateNumber('height', value)}
                />
            </PropertyGroup>
        </div>
    );
}

function PropertyGroup({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <section className="property-group">
            <div className="property-group-title">{title}</div>
            {children}
        </section>
    );
}

interface NumericPropertyProps {
    label: string;
    value: number;
    min?: number;
    onChange: (value: string) => void;
}

function NumericProperty({ label, value, min, onChange }: NumericPropertyProps) {
    const { t } = useTranslation();

    return (
        <label className="property-field">
            <span>{label}</span>
            <div className="property-input-wrap">
                <input
                    type="number"
                    value={value}
                    min={min}
                    step="any"
                    onChange={(event) => onChange(event.target.value)}
                />
                <span>{t('common.mm')}</span>
            </div>
        </label>
    );
}
