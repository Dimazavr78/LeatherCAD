import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type {
  CadLayer,
  CadObject,
  DimensionObject,
  EditorLevel,
  HoleObject,
  Material,
  PartObject,
  PathObject,
  StitchObject,
  RenderMode,
} from "../../types/cad";
import { distance, normalizeSweep } from "../../editor/geometry/geometryMath";
import {
  calculateVertexFillet,
  createPath,
} from "../../editor/geometry/pathMath";
import { generateStitch } from "../../editor/stitch/stitchMath";
import { getDimensionValue } from "../../editor/dimensions/dimensionMath";
import { normalizeRectangleCornerRadii } from "../../editor/geometry/rectangleGeometry";
import { DEFAULT_LAYER_TRANSLATION_KEYS } from "../../editor/projectModel";
import {
  createHolePath,
  getObjectBounds,
  isPointInHost,
  resolveHoleCenter,
} from "../../editor/holes/holeGeometry";
import {
  getPartArea,
  getPartDimensions,
  getPartGeometry,
  getPartOuterPerimeter,
  getPartStitches,
  getPartTotalCutLength,
  isClosedPartContour,
  validatePart,
} from "../../editor/parts/partGeometry";
import { getEffectiveThickness } from "../../editor/materials";

interface Props {
  selectedObject: CadObject | null;
  objects: CadObject[];
  layers: CadLayer[];
  levels: EditorLevel[];
  materials: Material[];
  renderMode: RenderMode;
  readOnly: boolean;
  onObjectChange: (id: string, patch: Partial<CadObject>) => void;
  onObjectCreate: (object: CadObject) => void;
  onSelectionChange: (id: string) => void;
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
        <fieldset className="properties-fieldset" disabled={props.readOnly}>
          <ObjectProperties {...props} selectedObject={props.selectedObject} />
        </fieldset>
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
  layers,
  levels,
  onObjectChange,
  onObjectCreate,
  materials,
  renderMode: _renderMode,
  onSelectionChange,
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
  if (object.type === "rectangle") {
    const setRadius = (
      field: keyof typeof object.cornerRadii,
      value: string,
    ) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return;
      const requested = object.linkCorners
        ? {
            topLeft: parsed,
            topRight: parsed,
            bottomRight: parsed,
            bottomLeft: parsed,
          }
        : { ...object.cornerRadii, [field]: parsed };
      onObjectChange(object.id, {
        cornerRadii: normalizeRectangleCornerRadii(
          object.width,
          object.height,
          requested,
        ),
      });
    };
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
        <Group title={t("properties.sections.corners")}>
          <Check
            label={t("properties.fields.linkCorners")}
            checked={object.linkCorners}
            onChange={(checked) =>
              onObjectChange(object.id, { linkCorners: checked })
            }
            {...events}
          />
          {object.linkCorners ? (
            <NumericProperty
              label={t("properties.fields.radius")}
              value={object.cornerRadii.topLeft}
              min={0}
              onChange={(value) => setRadius("topLeft", value)}
              {...events}
            />
          ) : (
            <>
              <NumericProperty
                label={t("properties.fields.topLeft")}
                value={object.cornerRadii.topLeft}
                min={0}
                onChange={(value) => setRadius("topLeft", value)}
                {...events}
              />
              <NumericProperty
                label={t("properties.fields.topRight")}
                value={object.cornerRadii.topRight}
                min={0}
                onChange={(value) => setRadius("topRight", value)}
                {...events}
              />
              <NumericProperty
                label={t("properties.fields.bottomRight")}
                value={object.cornerRadii.bottomRight}
                min={0}
                onChange={(value) => setRadius("bottomRight", value)}
                {...events}
              />
              <NumericProperty
                label={t("properties.fields.bottomLeft")}
                value={object.cornerRadii.bottomLeft}
                min={0}
                onChange={(value) => setRadius("bottomLeft", value)}
                {...events}
              />
            </>
          )}
        </Group>
      </>
    );
  } else if (object.type === "line") {
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
        <Group title={t("properties.sections.corners")}>
          {object.points.map((point, index) => (
            <NumericProperty
              key={index}
              label={`${t("properties.fields.vertex")} ${index + 1}`}
              value={point.cornerRadius ?? 0}
              min={0}
              onChange={(value) => {
                const radius = Number(value);
                const previous =
                  object.points[
                    (index - 1 + object.points.length) % object.points.length
                  ];
                const next = object.points[(index + 1) % object.points.length];
                const calculated =
                  Number.isFinite(radius) &&
                  previous &&
                  next &&
                  (object.closed ||
                    (index > 0 && index < object.points.length - 1))
                    ? calculateVertexFillet(
                        previous,
                        point,
                        next,
                        Math.max(0, radius),
                      )
                    : null;
                if (Number.isFinite(radius))
                  onObjectChange(object.id, {
                    points: object.points.map((item, pointIndex) =>
                      pointIndex === index
                        ? { ...item, cornerRadius: calculated?.radius ?? 0 }
                        : item,
                    ),
                  });
              }}
              {...events}
            />
          ))}
        </Group>
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
  } else if (object.type === "part")
    body = (
      <PartProperties
        part={object}
        objects={objects}
        materials={materials}
        onChange={onObjectChange}
        onSelectionChange={onSelectionChange}
        {...events}
      />
    );
  else if (object.type === "hole")
    body = (
      <HoleProperties
        hole={object}
        objects={objects}
        onChange={onObjectChange}
        onCreate={onObjectCreate}
        {...events}
      />
    );
  else if (object.type === "stitch")
    body = (
      <StitchProperties
        stitch={object}
        objects={objects}
        onChange={onObjectChange}
        {...events}
      />
    );
  else
    body = (
      <DimensionProperties
        dimension={object}
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
      <Group title={t("properties.sections.organization")}>
        <label className="property-field">
          <span>{t("layers.layer")}</span>
          <select
            className="property-select"
            value={object.layerId ?? ""}
            onFocus={events.onEditStart}
            onChange={(event) =>
              onObjectChange(object.id, { layerId: event.target.value })
            }
            onBlur={events.onEditCommit}
          >
            {layers.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {DEFAULT_LAYER_TRANSLATION_KEYS[layer.id]
                  ? t(DEFAULT_LAYER_TRANSLATION_KEYS[layer.id])
                  : layer.name}
              </option>
            ))}
          </select>
        </label>
        <label className="property-field">
          <span>{t("levels.level")}</span>
          <select
            className="property-select"
            value={object.levelId ?? ""}
            onFocus={events.onEditStart}
            onChange={(event) =>
              onObjectChange(object.id, { levelId: event.target.value })
            }
            onBlur={events.onEditCommit}
          >
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.id === "level-root" ? t("levels.root") : level.name}
              </option>
            ))}
          </select>
        </label>
      </Group>
      {body}
      {isClosedPartContour(object) &&
        !objects.some(
          (candidate) =>
            candidate.type === "part" &&
            candidate.contourSourceId === object.id,
        ) && (
          <button
            type="button"
            className="property-action"
            onClick={() =>
              onObjectCreate({
                id: crypto.randomUUID(),
                type: "part",
                name: `${t("parts.defaultName")} ${objects.filter((candidate) => candidate.type === "part").length + 1}`,
                contourSourceId: object.id,
                materialId: "material-default",
                manufacturing: {},
                exportSettings: {
                  exportOuterContour: true,
                  exportHoles: true,
                  exportStitch: true,
                },
              })
            }
          >
            {t("parts.convert")}
          </button>
        )}
    </div>
  );
}

function PartProperties({
  part,
  objects,
  materials,
  onChange,
  onSelectionChange,
  ...events
}: {
  part: PartObject;
  objects: CadObject[];
  materials: Material[];
  onChange: Change;
  onSelectionChange: (id: string) => void;
  onEditStart: () => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
}) {
  const { t } = useTranslation();
  const geometry = getPartGeometry(part, objects);
  const stitches = getPartStitches(part, objects);
  const dimensions = getPartDimensions(part, objects);
  const validation = validatePart(part, objects, materials);
  const effectiveThickness = getEffectiveThickness(part, materials);
  const selectedMaterial = materials.find(
    (material) => material.id === part.materialId,
  );
  const status = (valid: boolean, key: string) => (
    <div className={valid ? "validation-ok" : "property-warning"}>
      {valid ? "✓" : "✕"} {t(key)}
    </div>
  );
  return (
    <>
      <Group title={t("parts.titleSingle")}>
        <label className="property-field">
          <span>{t("parts.name")}</span>
          <input
            value={part.name}
            onFocus={events.onEditStart}
            onChange={(event) =>
              onChange(part.id, { name: event.target.value })
            }
            onBlur={events.onEditCommit}
          />
        </label>
        <div className="property-field property-read">
          <span>{t("parts.contour")}</span>
          <strong>
            {geometry
              ? `${t(`properties.${geometry.outerContour.type}.title`)} #${geometry.outerContour.id.slice(0, 6)}`
              : t("properties.warnings.missingSource")}
          </strong>
        </div>
        <button
          type="button"
          className="property-action"
          onClick={() => onSelectionChange(part.contourSourceId)}
        >
          {t("parts.editContour")}
        </button>
      </Group>
      <Group title={t("materials.titleSingle")}>
        <label className="property-field">
          <span>{t("parts.material")}</span>
          <select
            className="property-select"
            value={part.materialId ?? ""}
            onFocus={events.onEditStart}
            onChange={(event) =>
              onChange(part.id, { materialId: event.target.value || null })
            }
            onBlur={events.onEditCommit}
          >
            <option value="">{t("materials.none")}</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.presetKey ? t(material.presetKey) : material.name}
              </option>
            ))}
          </select>
        </label>
        <Check
          label={t("parts.overrideThickness")}
          checked={part.thicknessOverride !== undefined}
          onChange={(checked) =>
            onChange(part.id, {
              thicknessOverride: checked
                ? (selectedMaterial?.thickness ?? 1.5)
                : undefined,
            })
          }
          {...events}
        />
        {part.thicknessOverride !== undefined ? (
          <NumericProperty
            label={t("parts.thickness")}
            value={part.thicknessOverride}
            min={0.1}
            onChange={(value) =>
              onChange(part.id, {
                thicknessOverride: Math.max(0.1, Number(value)),
              })
            }
            {...events}
          />
        ) : (
          <Read
            label={t("parts.effectiveThickness")}
            value={effectiveThickness}
          />
        )}
      </Group>
      <Group title={t("parts.calculated")}>
        <Read
          label={t("parts.area")}
          value={getPartArea(part, objects)}
          suffix={` ${t("common.mm2")}`}
        />
        <Read
          label={t("parts.outerPerimeter")}
          value={getPartOuterPerimeter(part, objects)}
        />
        <Read
          label={t("parts.totalCutLength")}
          value={getPartTotalCutLength(part, objects)}
        />
        <Read
          label={t("parts.holes")}
          value={geometry?.holes.length ?? 0}
          suffix=""
        />
        <Read label={t("parts.stitches")} value={stitches.length} suffix="" />
        <Read
          label={t("parts.dimensions")}
          value={dimensions.length}
          suffix=""
        />
      </Group>
      <Group title={t("parts.validation")}>
        {status(
          validation.contourExists,
          "parts.validationItems.contourExists",
        )}
        {status(
          validation.contourClosed,
          "parts.validationItems.closedContour",
        )}
        {status(
          validation.noSelfIntersections,
          "parts.validationItems.noSelfIntersections",
        )}
        {status(validation.holesInside, "parts.validationItems.holesInside")}
        {status(
          validation.materialExists,
          "parts.validationItems.materialExists",
        )}
        {status(
          validation.thicknessValid,
          "parts.validationItems.thicknessValid",
        )}
        {status(
          validation.stitchesInside,
          "parts.validationItems.stitchesInside",
        )}
      </Group>
    </>
  );
}

function HoleProperties({
  hole,
  objects,
  onChange,
  onCreate,
  ...events
}: {
  hole: HoleObject;
  objects: CadObject[];
  onChange: Change;
  onCreate: (object: CadObject) => void;
  onEditStart: () => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
}) {
  const { t } = useTranslation();
  const host = objects.find(
    (object): object is PathObject =>
      object.id === hole.hostObjectId &&
      object.type !== "stitch" &&
      object.type !== "dimension" &&
      object.type !== "hole",
  );
  const bounds = host ? getObjectBounds(host) : null;
  const center = resolveHoleCenter(hole, objects);
  const changePositionMode = (mode: HoleObject["position"]["mode"]) => {
    if (!center || !bounds) return;
    if (mode === "absolute")
      onChange(hole.id, { position: { mode, x: center.x, y: center.y } });
    else if (mode === "relative")
      onChange(hole.id, {
        position: {
          mode,
          xRatio: (center.x - bounds.x) / bounds.width,
          yRatio: (center.y - bounds.y) / bounds.height,
        },
      });
    else
      onChange(hole.id, {
        position: {
          mode,
          fromX: "left",
          fromY: "top",
          offsetX: center.x - bounds.x,
          offsetY: center.y - bounds.y,
        },
      });
  };
  const position = hole.position;
  return (
    <>
      <Group title={t("properties.sections.hole")}>
        <div className="property-field property-read">
          <span>{t("properties.fields.host")}</span>
          <strong>
            {host
              ? `${host.type} #${host.id.slice(0, 6)}`
              : t("properties.warnings.missingSource")}
          </strong>
        </div>
        <Select
          label={t("properties.fields.shape")}
          value={hole.shape}
          values={["circle", "slot", "rectangle"]}
          onChange={(value) =>
            onChange(hole.id, { shape: value as HoleObject["shape"] })
          }
          {...events}
        />
        {hole.shape === "circle" ? (
          <NumericProperty
            label={t("properties.fields.diameter")}
            value={hole.radius * 2}
            min={0.2}
            onChange={(value) =>
              onChange(hole.id, { radius: Math.max(0.1, Number(value) / 2) })
            }
            {...events}
          />
        ) : (
          <>
            <NumericProperty
              label={t("properties.fields.length")}
              value={hole.width}
              min={0.2}
              onChange={(value) =>
                onChange(hole.id, { width: Math.max(0.2, Number(value)) })
              }
              {...events}
            />
            <NumericProperty
              label={t("properties.fields.width")}
              value={hole.height}
              min={0.2}
              onChange={(value) =>
                onChange(hole.id, { height: Math.max(0.2, Number(value)) })
              }
              {...events}
            />
            {hole.shape === "rectangle" && (
              <NumericProperty
                label={t("properties.fields.radius")}
                value={hole.cornerRadius}
                min={0}
                onChange={(value) =>
                  onChange(hole.id, {
                    cornerRadius: Math.max(0, Number(value)),
                  })
                }
                {...events}
              />
            )}
          </>
        )}
        <NumericProperty
          label={t("properties.fields.rotation")}
          value={hole.rotation}
          unit="°"
          onChange={(value) =>
            onChange(hole.id, { rotation: Number(value) || 0 })
          }
          {...events}
        />
      </Group>
      <Group title={t("properties.sections.position")}>
        <Select
          label={t("properties.fields.positionMode")}
          value={position.mode}
          values={["absolute", "relative", "offset"]}
          onChange={(value) =>
            changePositionMode(value as HoleObject["position"]["mode"])
          }
          {...events}
        />
        {position.mode === "absolute" && (
          <>
            <NumericProperty
              label="X"
              value={position.x}
              onChange={(value) =>
                onChange(hole.id, {
                  position: { ...position, x: Number(value) },
                })
              }
              {...events}
            />
            <NumericProperty
              label="Y"
              value={position.y}
              onChange={(value) =>
                onChange(hole.id, {
                  position: { ...position, y: Number(value) },
                })
              }
              {...events}
            />
          </>
        )}
        {position.mode === "relative" && (
          <>
            <NumericProperty
              label={t("properties.fields.xRatio")}
              value={position.xRatio}
              min={0}
              unit=""
              onChange={(value) =>
                onChange(hole.id, {
                  position: {
                    ...position,
                    xRatio: Math.min(1, Math.max(0, Number(value))),
                  },
                })
              }
              {...events}
            />
            <NumericProperty
              label={t("properties.fields.yRatio")}
              value={position.yRatio}
              min={0}
              unit=""
              onChange={(value) =>
                onChange(hole.id, {
                  position: {
                    ...position,
                    yRatio: Math.min(1, Math.max(0, Number(value))),
                  },
                })
              }
              {...events}
            />
          </>
        )}
        {position.mode === "offset" && (
          <>
            <Select
              label={t("properties.fields.horizontalEdge")}
              value={position.fromX}
              values={["left", "right"]}
              onChange={(value) =>
                onChange(hole.id, {
                  position: {
                    ...position,
                    fromX: value as "left" | "right",
                  },
                })
              }
              {...events}
            />
            <Select
              label={t("properties.fields.verticalEdge")}
              value={position.fromY}
              values={["top", "bottom"]}
              onChange={(value) =>
                onChange(hole.id, {
                  position: {
                    ...position,
                    fromY: value as "top" | "bottom",
                  },
                })
              }
              {...events}
            />
            <NumericProperty
              label={t("properties.fields.offsetX")}
              value={position.offsetX}
              min={0}
              onChange={(value) =>
                onChange(hole.id, {
                  position: {
                    ...position,
                    offsetX: Math.max(0, Number(value)),
                  },
                })
              }
              {...events}
            />
            <NumericProperty
              label={t("properties.fields.offsetY")}
              value={position.offsetY}
              min={0}
              onChange={(value) =>
                onChange(hole.id, {
                  position: {
                    ...position,
                    offsetY: Math.max(0, Number(value)),
                  },
                })
              }
              {...events}
            />
          </>
        )}
        <Check
          label={t("properties.fields.constrainToHost")}
          checked={hole.constrainToHost}
          onChange={(checked) =>
            onChange(hole.id, { constrainToHost: checked })
          }
          {...events}
        />
      </Group>
      <button
        type="button"
        className="property-action"
        onClick={() =>
          onCreate({
            id: crypto.randomUUID(),
            type: "stitch",
            sourceObjectId: hole.id,
            offset: 3,
            spacing: 3,
            holeSize: 1,
            holeShape: "diamond",
            holeAngle: "follow-path",
            mode: "adaptive",
            alignment: "corners",
            cornerMode: "adaptive",
            maxSpacingDeviation: 5,
            showLine: true,
            showHoles: true,
          })
        }
      >
        {t("properties.actions.addStitchAroundHole")}
      </button>
    </>
  );
}

function DimensionProperties({
  dimension,
  objects,
  onChange,
  ...events
}: {
  dimension: DimensionObject;
  objects: CadObject[];
  onChange: Change;
  onEditStart: () => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
}) {
  const { t } = useTranslation();
  const value = getDimensionValue(dimension, objects);
  return (
    <>
      <Select
        label={t("properties.fields.dimensionType")}
        value={dimension.dimensionType}
        values={[
          "aligned",
          "horizontal",
          "vertical",
          "radius",
          "diameter",
          "arc-length",
        ]}
        onChange={(next) =>
          onChange(dimension.id, {
            dimensionType: next as DimensionObject["dimensionType"],
          })
        }
        {...events}
      />
      <Read label={t("properties.fields.value")} value={value} />
      <NumericProperty
        label={t("properties.fields.precision")}
        value={dimension.precision}
        min={0}
        unit=""
        onChange={(next) =>
          onChange(dimension.id, {
            precision: Math.min(3, Math.max(0, Math.round(Number(next)))),
          })
        }
        {...events}
      />
      <NumericProperty
        label={t("properties.fields.offset")}
        value={dimension.offset}
        onChange={(next) =>
          onChange(dimension.id, { offset: Number(next) || 0 })
        }
        {...events}
      />
      <Check
        label={t("properties.fields.showUnit")}
        checked={dimension.showUnit}
        onChange={(checked) => onChange(dimension.id, { showUnit: checked })}
        {...events}
      />
    </>
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
    (object): object is PathObject | HoleObject =>
      object.id === stitch.sourceObjectId &&
      object.type !== "stitch" &&
      object.type !== "dimension",
  );
  const generated = generateStitch(
    source
      ? source.type === "hole"
        ? createHolePath(source, objects, stitch.offset)
        : createPath(source, stitch.offset)
      : null,
    stitch,
  );
  const stitchOutsideHost =
    source?.type === "hole" &&
    (() => {
      const host = objects.find((object) => object.id === source.hostObjectId);
      return (
        !host || generated.holes.some((point) => !isPointInHost(point, host))
      );
    })();
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
            ? `${t(`properties.${source.type}.title`)} #${source.id.slice(0, 6)}`
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
          <option value={2.5}>{t("properties.presets.fine")} — 2.5 mm</option>
          <option value={3}>{t("properties.presets.small")} — 3.0 mm</option>
          <option value={3.38}>
            {t("properties.presets.medium")} — 3.38 mm
          </option>
          <option value={4}>{t("properties.presets.large")} — 4.0 mm</option>
          <option value={5}>{t("properties.presets.heavy")} — 5.0 mm</option>
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
      {stitchOutsideHost && (
        <div className="property-warning">
          ⚠ {t("properties.warnings.stitch-too-close-edge")}
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
