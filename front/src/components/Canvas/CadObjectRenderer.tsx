import type { PointerEvent } from "react";
import type {
  CadObject,
  HoleObject,
  PathObject,
  StitchObject,
  Tool,
} from "../../types/cad";
import { buildPathData, createPath } from "../../editor/geometry/pathMath";
import { generateStitch } from "../../editor/stitch/stitchMath";
import {
  getDimensionValue,
  getRadialEnd,
  resolveDimensionReference,
} from "../../editor/dimensions/dimensionMath";
import {
  createHolePath,
  resolveHoleCenter,
} from "../../editor/holes/holeGeometry";

interface Props {
  object: CadObject;
  objects: CadObject[];
  activeTool: Tool;
  selected: boolean;
  related: boolean;
  construction?: boolean;
  screenUnit: number;
  onSelect: (id: string) => void;
  onMoveStart: (event: PointerEvent<SVGElement>, object: CadObject) => void;
  onHover?: (id: string | null) => void;
  editingDimensionId?: string | null;
  onDimensionEditStart?: (id: string) => void;
  onDimensionEditCommit?: (id: string, value: number) => void;
  onDimensionEditCancel?: () => void;
}

function pathData(object: PathObject): string {
  return buildPathData(createPath(object) ?? { segments: [], closed: false });
}

export function CadObjectRenderer({
  object,
  objects,
  activeTool,
  selected,
  related,
  construction,
  screenUnit,
  onSelect,
  onMoveStart,
  onHover,
  editingDimensionId,
  onDimensionEditStart,
  onDimensionEditCommit,
  onDimensionEditCancel,
}: Props) {
  const pointerDown = (event: PointerEvent<SVGElement>) => {
    if (event.button !== 0) return;
    if (
      activeTool === "dimension" ||
      activeTool === "measure" ||
      activeTool === "fillet"
    )
      return;
    event.stopPropagation();
    if (activeTool === "stitch" || activeTool === "select") onSelect(object.id);
    if (activeTool === "select" && object.type !== "stitch")
      onMoveStart(event, object);
  };
  const className = `cad-object cad-object--${object.type}${selected ? " cad-object--selected" : ""}${related ? " cad-object--related" : ""}${construction ? " cad-object--construction" : ""}`;
  if (object.type === "stitch")
    return (
      <StitchRenderer
        stitch={object}
        objects={objects}
        className={className}
        onPointerDown={pointerDown}
      />
    );
  if (object.type === "hole") {
    const center = resolveHoleCenter(object, objects);
    const path = createHolePath(object, objects);
    if (!center || !path) return null;
    return (
      <g className={className} onPointerDown={pointerDown}>
        <path
          className="hole-cutout"
          d={buildPathData(path)}
          vectorEffect="non-scaling-stroke"
          transform={
            object.rotation
              ? `rotate(${object.rotation} ${center.x} ${center.y})`
              : undefined
          }
        />
        <circle
          className="hole-center"
          cx={center.x}
          cy={center.y}
          r={screenUnit * 2}
        />
      </g>
    );
  }
  if (object.type === "dimension")
    return (
      <DimensionRenderer
        dimension={object}
        objects={objects}
        screenUnit={screenUnit}
        className={className}
        onPointerDown={pointerDown}
        editing={editingDimensionId === object.id}
        onEditStart={onDimensionEditStart}
        onEditCommit={onDimensionEditCommit}
        onEditCancel={onDimensionEditCancel}
      />
    );
  const hover = {
    onPointerEnter: () => onHover?.(object.id),
    onPointerLeave: () => onHover?.(null),
  };
  if (object.type === "rectangle")
    return (
      <path
        className={className}
        d={pathData(object)}
        vectorEffect="non-scaling-stroke"
        onPointerDown={pointerDown}
        {...hover}
      />
    );
  if (object.type === "circle")
    return (
      <circle
        className={className}
        cx={object.cx}
        cy={object.cy}
        r={object.radius}
        vectorEffect="non-scaling-stroke"
        onPointerDown={pointerDown}
        {...hover}
      />
    );
  return (
    <path
      className={className}
      d={pathData(object)}
      fill={
        object.type === "polyline" && object.closed
          ? "rgba(126, 167, 209, 0.04)"
          : "none"
      }
      strokeWidth={Math.max(screenUnit * 8, 1)}
      vectorEffect="non-scaling-stroke"
      onPointerDown={pointerDown}
      {...hover}
    />
  );
}

function DimensionRenderer({
  dimension,
  objects,
  screenUnit,
  className,
  onPointerDown,
  editing,
  onEditStart,
  onEditCommit,
  onEditCancel,
}: {
  dimension: Extract<CadObject, { type: "dimension" }>;
  objects: CadObject[];
  screenUnit: number;
  className: string;
  onPointerDown: (event: PointerEvent<SVGElement>) => void;
  editing: boolean;
  onEditStart?: (id: string) => void;
  onEditCommit?: (id: string, value: number) => void;
  onEditCancel?: () => void;
}) {
  const a = resolveDimensionReference(dimension.referenceA, objects);
  const radial = getRadialEnd(dimension, objects);
  const b =
    radial ??
    (dimension.referenceB
      ? resolveDimensionReference(dimension.referenceB, objects)
      : null);
  if (!a || !b) return null;
  let lineA = a;
  let lineB = b;
  if (dimension.dimensionType === "horizontal") {
    const y = (a.y + b.y) / 2 + dimension.offset;
    lineA = { x: a.x, y };
    lineB = { x: b.x, y };
  } else if (dimension.dimensionType === "vertical") {
    const x = (a.x + b.x) / 2 + dimension.offset;
    lineA = { x, y: a.y };
    lineB = { x, y: b.y };
  } else {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / length, y: dx / length };
    lineA = {
      x: a.x + normal.x * dimension.offset,
      y: a.y + normal.y * dimension.offset,
    };
    lineB = {
      x: b.x + normal.x * dimension.offset,
      y: b.y + normal.y * dimension.offset,
    };
  }
  const value = getDimensionValue(dimension, objects).toFixed(
    dimension.precision,
  );
  const prefix =
    dimension.dimensionType === "radius"
      ? "R "
      : dimension.dimensionType === "diameter"
        ? "Ø "
        : dimension.dimensionType === "arc-length"
          ? "⌒ "
          : "";
  const label = `${prefix}${value}${dimension.showUnit ? " mm" : ""}`;
  const mid = { x: (lineA.x + lineB.x) / 2, y: (lineA.y + lineB.y) / 2 };
  const arrow = 5 * screenUnit;
  return (
    <g className={className} onPointerDown={onPointerDown}>
      {!radial && (
        <>
          <line
            className="dimension-extension"
            x1={a.x}
            y1={a.y}
            x2={lineA.x}
            y2={lineA.y}
          />
          <line
            className="dimension-extension"
            x1={b.x}
            y1={b.y}
            x2={lineB.x}
            y2={lineB.y}
          />
        </>
      )}
      <line
        className="dimension-line"
        x1={lineA.x}
        y1={lineA.y}
        x2={lineB.x}
        y2={lineB.y}
      />
      <circle
        className="dimension-arrow"
        cx={lineA.x}
        cy={lineA.y}
        r={arrow / 2}
      />
      <circle
        className="dimension-arrow"
        cx={lineB.x}
        cy={lineB.y}
        r={arrow / 2}
      />
      {editing ? (
        <foreignObject
          x={mid.x - 45 * screenUnit}
          y={mid.y - 25 * screenUnit}
          width={90 * screenUnit}
          height={24 * screenUnit}
        >
          <input
            autoFocus
            className="dimension-inline-input"
            defaultValue={value}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter")
                onEditCommit?.(dimension.id, Number(event.currentTarget.value));
              else if (event.key === "Escape") onEditCancel?.();
            }}
            onBlur={(event) =>
              onEditCommit?.(dimension.id, Number(event.currentTarget.value))
            }
          />
        </foreignObject>
      ) : (
        <text
          className="dimension-text"
          x={mid.x}
          y={mid.y - 6 * screenUnit}
          fontSize={11 * screenUnit}
          textAnchor="middle"
          onDoubleClick={(event) => {
            event.stopPropagation();
            onEditStart?.(dimension.id);
          }}
        >
          {label}
        </text>
      )}
    </g>
  );
}

function StitchRenderer({
  stitch,
  objects,
  className,
  onPointerDown,
}: {
  stitch: StitchObject;
  objects: CadObject[];
  className: string;
  onPointerDown: (event: PointerEvent<SVGElement>) => void;
}) {
  const source = objects.find(
    (candidate): candidate is PathObject | HoleObject =>
      candidate.id === stitch.sourceObjectId &&
      candidate.type !== "stitch" &&
      candidate.type !== "dimension",
  );
  if (!source) return null;
  const path =
    source.type === "hole"
      ? createHolePath(source, objects, stitch.offset)
      : createPath(source, stitch.offset);
  const generated = generateStitch(path, stitch);
  const guideline =
    generated.holes
      .map((hole, index) => `${index ? "L" : "M"} ${hole.x} ${hole.y}`)
      .join(" ") + (path?.closed ? " Z" : "");
  return (
    <g className={className} onPointerDown={onPointerDown}>
      {stitch.showLine && (
        <path
          className="stitch-guideline"
          d={guideline}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {stitch.showHoles &&
        generated.holes.map((hole, index) => {
          const transform = `rotate(${hole.angle} ${hole.x} ${hole.y})`;
          if (stitch.holeShape === "round")
            return (
              <circle
                key={index}
                className="stitch-hole"
                cx={hole.x}
                cy={hole.y}
                r={stitch.holeSize / 2}
              />
            );
          if (stitch.holeShape === "slit")
            return (
              <line
                key={index}
                className="stitch-hole"
                x1={hole.x - stitch.holeSize / 2}
                y1={hole.y}
                x2={hole.x + stitch.holeSize / 2}
                y2={hole.y}
                transform={transform}
              />
            );
          return (
            <rect
              key={index}
              className="stitch-hole"
              x={hole.x - stitch.holeSize / 2}
              y={hole.y - stitch.holeSize / 2}
              width={stitch.holeSize}
              height={stitch.holeSize}
              transform={transform}
            />
          );
        })}
    </g>
  );
}
