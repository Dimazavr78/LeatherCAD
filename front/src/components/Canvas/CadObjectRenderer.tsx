import type { PointerEvent } from "react";
import type {
  CadObject,
  PathObject,
  StitchObject,
  Tool,
} from "../../types/cad";
import { arcPathData } from "../../editor/geometry/geometryMath";
import { createPath } from "../../editor/geometry/pathMath";
import { generateStitch } from "../../editor/stitch/stitchMath";

interface Props {
  object: CadObject;
  objects: CadObject[];
  activeTool: Tool;
  selected: boolean;
  screenUnit: number;
  onSelect: (id: string) => void;
  onMoveStart: (event: PointerEvent<SVGElement>, object: CadObject) => void;
  onHover?: (id: string | null) => void;
}

function pathData(object: PathObject): string {
  if (object.type === "line")
    return `M ${object.x1} ${object.y1} L ${object.x2} ${object.y2}`;
  if (object.type === "polyline")
    return `${object.points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ")}${object.closed ? " Z" : ""}`;
  if (object.type === "arc") return arcPathData(object);
  return "";
}

export function CadObjectRenderer({
  object,
  objects,
  activeTool,
  selected,
  screenUnit,
  onSelect,
  onMoveStart,
  onHover,
}: Props) {
  const pointerDown = (event: PointerEvent<SVGElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (activeTool === "stitch" || activeTool === "select") onSelect(object.id);
    if (activeTool === "select" && object.type !== "stitch")
      onMoveStart(event, object);
  };
  const className = `cad-object cad-object--${object.type}${selected ? " cad-object--selected" : ""}`;
  if (object.type === "stitch")
    return (
      <StitchRenderer
        stitch={object}
        objects={objects}
        className={className}
        onPointerDown={pointerDown}
      />
    );
  const hover = {
    onPointerEnter: () => onHover?.(object.id),
    onPointerLeave: () => onHover?.(null),
  };
  if (object.type === "rectangle")
    return (
      <rect
        className={className}
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
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
    (candidate): candidate is PathObject =>
      candidate.id === stitch.sourceObjectId && candidate.type !== "stitch",
  );
  if (!source) return null;
  const path = createPath(source, stitch.offset);
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
