import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { CadObject, PathObject, StitchObject } from "../../types/cad";
import { distance, normalizeSweep } from "../../editor/geometry/geometryMath";
import { createPath } from "../../editor/geometry/pathMath";
import { generateStitch } from "../../editor/stitch/stitchMath";

interface Props {
  selectedObject: CadObject | null;
  objects: CadObject[];
  onObjectChange: (id: string, patch: Partial<CadObject>) => void;
  onEditStart: () => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
}
type Change = Props["onObjectChange"];
export function PropertiesPanel(props: Props) {
  const { t } = useTranslation();
  return (
    <div className="properties-panel">
      <div className="properties-header">
        <span>{t("properties.title").toUpperCase()}</span>
      </div>
      {props.selectedObject ? (
        <ObjectProperties {...props} selectedObject={props.selectedObject} />
      ) : (
        <div className="properties-empty">
          <div className="properties-empty-icon">◇</div>
          <div className="properties-empty-title">
            {t("properties.nothingSelected")}
          </div>
          <div className="properties-empty-description">
            {t("properties.nothingSelectedDescription")}
          </div>
        </div>
      )}
    </div>
  );
}

function ObjectProperties({
  selectedObject: object,
  objects,
  onObjectChange,
  ...events
}: Props & { selectedObject: CadObject }) {
  const { t } = useTranslation();
  const number = (field: string, min?: number) => (value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed))
      onObjectChange(object.id, {
        [field]: min === undefined ? parsed : Math.max(min, parsed),
      } as Partial<CadObject>);
  };
  const input = (label: string, value: number, field: string, min?: number) => (
    <NumericProperty
      label={label}
      value={value}
      min={min}
      onChange={number(field, min)}
      {...events}
    />
  );
  let body: ReactNode;
  if (object.type === "rectangle")
    body = (
      <>
        <Group title={t("properties.sections.position")}>
          {input("X", object.x, "x")}
          {input("Y", object.y, "y")}
        </Group>
        <Group title={t("properties.sections.size")}>
          {input(t("properties.fields.width"), object.width, "width", 0.1)}
          {input(t("properties.fields.height"), object.height, "height", 0.1)}
        </Group>
      </>
    );
  else if (object.type === "line") {
    const length = distance(
      { x: object.x1, y: object.y1 },
      { x: object.x2, y: object.y2 },
    );
    const angle =
      (Math.atan2(object.y2 - object.y1, object.x2 - object.x1) * 180) /
      Math.PI;
    body = (
      <>
        <Group title={t("properties.sections.start")}>
          {input("X1", object.x1, "x1")}
          {input("Y1", object.y1, "y1")}
        </Group>
        <Group title={t("properties.sections.end")}>
          {input("X2", object.x2, "x2")}
          {input("Y2", object.y2, "y2")}
        </Group>
        <Read label={t("properties.fields.length")} value={length} />
        <Read label={t("properties.fields.angle")} value={angle} suffix="°" />
      </>
    );
  } else if (object.type === "polyline")
    body = (
      <>
        <Read
          label={t("properties.fields.vertices")}
          value={object.points.length}
          suffix=""
        />
        <label className="property-check">
          <input
            type="checkbox"
            checked={object.closed}
            onFocus={events.onEditStart}
            onChange={(event) =>
              onObjectChange(object.id, { closed: event.target.checked })
            }
            onBlur={events.onEditCommit}
          />
          {t("properties.fields.closed")}
        </label>
      </>
    );
  else if (object.type === "circle")
    body = (
      <>
        <Group title={t("properties.sections.center")}>
          {input("X", object.cx, "cx")}
          {input("Y", object.cy, "cy")}
        </Group>
        <Group title={t("properties.sections.size")}>
          {input(t("properties.fields.radius"), object.radius, "radius", 0.1)}
          <NumericProperty
            label={t("properties.fields.diameter")}
            value={object.radius * 2}
            min={0.2}
            onChange={(value) => {
              const parsed = Number(value);
              if (Number.isFinite(parsed))
                onObjectChange(object.id, {
                  radius: Math.max(0.1, parsed / 2),
                });
            }}
            {...events}
          />
        </Group>
        <Read
          label={t("properties.fields.circumference")}
          value={2 * Math.PI * object.radius}
        />
      </>
    );
  else if (object.type === "arc") {
    const sweep = normalizeSweep(object.startAngle, object.endAngle);
    body = (
      <>
        <Group title={t("properties.sections.center")}>
          {input("X", object.cx, "cx")}
          {input("Y", object.cy, "cy")}
        </Group>
        <Group title={t("properties.sections.geometry")}>
          {input(t("properties.fields.radius"), object.radius, "radius", 0.1)}
          <NumericProperty
            label={t("properties.fields.startAngle")}
            value={object.startAngle}
            unit="°"
            onChange={number("startAngle")}
            {...events}
          />
          <NumericProperty
            label={t("properties.fields.endAngle")}
            value={object.endAngle}
            unit="°"
            onChange={number("endAngle")}
            {...events}
          />
        </Group>
        <Read
          label={t("properties.fields.sweepAngle")}
          value={sweep}
          suffix="°"
        />
        <Read
          label={t("properties.fields.arcLength")}
          value={(object.radius * sweep * Math.PI) / 180}
        />
      </>
    );
  } else
    body = (
      <StitchProperties
        stitch={object}
        objects={objects}
        onChange={onObjectChange}
        {...events}
      />
    );
  return (
    <div className="properties-form">
      <div className="properties-object-type">
        {t(`properties.${object.type}.title`).toUpperCase()}
      </div>
      {body}
    </div>
  );
}

function StitchProperties({
  stitch,
  objects,
  onChange,
  ...events
}: {
  stitch: StitchObject;
  objects: CadObject[];
  onChange: Change;
  onEditStart: () => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
}) {
  const { t } = useTranslation();
  const source = objects.find(
    (object): object is PathObject =>
      object.id === stitch.sourceObjectId && object.type !== "stitch",
  );
  const generated = generateStitch(
    source ? createPath(source, stitch.offset) : null,
    stitch,
  );
  const updateNumber =
    (field: keyof StitchObject, min: number) => (value: string) => {
      const parsed = Number(value);
      if (Number.isFinite(parsed))
        onChange(stitch.id, { [field]: Math.max(min, parsed) });
    };
  return (
    <>
      <div className="property-field property-read">
        <span>{t("properties.fields.source")}</span>
        <strong>
          {source
            ? `${source.type} #${source.id.slice(0, 6)}`
            : t("properties.warnings.missingSource")}
        </strong>
      </div>
      <Group title={t("properties.sections.stitch")}>
        <NumericProperty
          label={t("properties.fields.offset")}
          value={stitch.offset}
          min={0}
          onChange={updateNumber("offset", 0)}
          {...events}
        />
        <NumericProperty
          label={t("properties.fields.spacing")}
          value={stitch.spacing}
          min={0.1}
          onChange={updateNumber("spacing", 0.1)}
          {...events}
        />
        <select
          className="property-select"
          value={stitch.spacing}
          onFocus={events.onEditStart}
          onChange={(event) =>
            onChange(stitch.id, { spacing: Number(event.target.value) })
          }
          onBlur={events.onEditCommit}
        >
          <option value={2.5}>Fine — 2.5 mm</option>
          <option value={3}>Small — 3.0 mm</option>
          <option value={3.38}>Medium — 3.38 mm</option>
          <option value={4}>Large — 4.0 mm</option>
          <option value={5}>Heavy — 5.0 mm</option>
        </select>
        <Select
          label={t("properties.fields.mode")}
          value={stitch.mode}
          values={["fixed-spacing", "fit-evenly", "adaptive"]}
          onChange={(value) =>
            onChange(stitch.id, { mode: value as StitchObject["mode"] })
          }
          {...events}
        />
        <Select
          label={t("properties.fields.alignment")}
          value={stitch.alignment}
          values={["start", "center", "corners"]}
          onChange={(value) =>
            onChange(stitch.id, {
              alignment: value as StitchObject["alignment"],
            })
          }
          {...events}
        />
      </Group>
      <Group title={t("properties.sections.holes")}>
        <Select
          label={t("properties.fields.holeShape")}
          value={stitch.holeShape}
          values={["round", "diamond", "slit"]}
          onChange={(value) =>
            onChange(stitch.id, {
              holeShape: value as StitchObject["holeShape"],
            })
          }
          {...events}
        />
        <NumericProperty
          label={t("properties.fields.holeSize")}
          value={stitch.holeSize}
          min={0.1}
          onChange={updateNumber("holeSize", 0.1)}
          {...events}
        />
        <Select
          label={t("properties.fields.holeAngle")}
          value={String(stitch.holeAngle)}
          values={["follow-path", "45"]}
          onChange={(value) =>
            onChange(stitch.id, {
              holeAngle: value === "follow-path" ? value : Number(value),
            })
          }
          {...events}
        />
      </Group>
      <Group title={t("properties.sections.display")}>
        <Check
          label={t("properties.fields.showLine")}
          checked={stitch.showLine}
          onChange={(checked) => onChange(stitch.id, { showLine: checked })}
          {...events}
        />
        <Check
          label={t("properties.fields.showHoles")}
          checked={stitch.showHoles}
          onChange={(checked) => onChange(stitch.id, { showHoles: checked })}
          {...events}
        />
      </Group>
      <Read
        label={t("properties.fields.actualSpacing")}
        value={generated.actualSpacing}
      />
      <Read
        label={t("properties.fields.holes")}
        value={generated.holes.length}
        suffix=""
      />
      {generated.warnings.length > 0 && (
        <div className="property-warning">
          ⚠ {t(`properties.warnings.${generated.warnings[0]}`)}
        </div>
      )}
    </>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="property-group">
      <div className="property-group-title">{title.toUpperCase()}</div>
      {children}
    </section>
  );
}
function Read({
  label,
  value,
  suffix = " mm",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="property-field property-read">
      <span>{label}</span>
      <strong>
        {Number.isInteger(value) ? value : value.toFixed(2)}
        {suffix}
      </strong>
    </div>
  );
}
interface InputEvents {
  onEditStart: () => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
}
function NumericProperty({
  label,
  value,
  min,
  unit,
  onChange,
  ...events
}: {
  label: string;
  value: number;
  min?: number;
  unit?: string;
  onChange: (value: string) => void;
} & InputEvents) {
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
          onFocus={events.onEditStart}
          onBlur={events.onEditCommit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            else if (event.key === "Escape") {
              event.preventDefault();
              events.onEditCancel();
              event.currentTarget.blur();
            }
          }}
        />
        <span>{unit ?? t("common.mm")}</span>
      </div>
    </label>
  );
}
function Select({
  label,
  value,
  values,
  onChange,
  ...events
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
} & InputEvents) {
  const { t } = useTranslation();
  return (
    <label className="property-field">
      <span>{label}</span>
      <select
        className="property-select"
        value={value}
        onFocus={events.onEditStart}
        onChange={(event) => onChange(event.target.value)}
        onBlur={events.onEditCommit}
      >
        {values.map((item) => (
          <option key={item} value={item}>
            {t(`properties.options.${item}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
function Check({
  label,
  checked,
  onChange,
  ...events
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
} & InputEvents) {
  return (
    <label className="property-check">
      <input
        type="checkbox"
        checked={checked}
        onFocus={events.onEditStart}
        onChange={(event) => onChange(event.target.checked)}
        onBlur={events.onEditCommit}
      />
      {label}
    </label>
  );
}
