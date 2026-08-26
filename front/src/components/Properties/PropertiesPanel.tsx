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
    return (
        <div className="properties-panel">
            <div className="properties-header">
                <span>PROPERTIES</span>
            </div>

            {selectedObject ? (
                <RectangleProperties
                    rectangle={selectedObject}
                    onObjectChange={onObjectChange}
                />
            ) : (
                <div className="properties-empty">
                    <div className="properties-empty-icon">◇</div>
                    <div className="properties-empty-title">Nothing selected</div>
                    <div className="properties-empty-description">
                        Select an object on the canvas to see its properties.
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
            <div className="properties-object-type">RECTANGLE</div>
            <PropertyGroup title="POSITION">
                <NumericProperty
                    label="X"
                    value={rectangle.x}
                    onChange={(value) => updateNumber('x', value)}
                />
                <NumericProperty
                    label="Y"
                    value={rectangle.y}
                    onChange={(value) => updateNumber('y', value)}
                />
            </PropertyGroup>
            <PropertyGroup title="SIZE">
                <NumericProperty
                    label="Width"
                    value={rectangle.width}
                    min={0.1}
                    onChange={(value) => updateNumber('width', value)}
                />
                <NumericProperty
                    label="Height"
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
    children: React.ReactNode;
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
                <span>mm</span>
            </div>
        </label>
    );
}
