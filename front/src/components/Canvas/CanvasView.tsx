import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { useTranslation } from "react-i18next";
import type {
  CadObject,
  DimensionReference,
  PathObject,
  Point,
  RectangleObject,
  ResizeHandle,
  Tool,
} from "../../types/cad";
import { isPathObject } from "../../types/cad";
import { translateCadObject } from "../../editor/cadObjectUtils";
import {
  angleDegrees,
  distance,
  pointOnCircle,
} from "../../editor/geometry/geometryMath";
import { CadObjectRenderer } from "./CadObjectRenderer";
import { HorizontalRuler } from "./HorizontalRuler";
import { SelectionOverlay } from "./SelectionOverlay";
import { VerticalRuler } from "./VerticalRuler";
import {
  calculateZoomPercent,
  getGridSpacing,
  panViewBox,
  screenToCanvasCoordinates,
  snapToGrid,
  zoomViewBoxAtPoint,
  type ViewBox,
} from "./canvasMath";
import { resizeRectangle } from "./rectangleMath";
import { ZERO_CORNER_RADII } from "../../editor/geometry/rectangleGeometry";
import { normalizeRectangleCornerRadii } from "../../editor/geometry/rectangleGeometry";
import {
  getObjectAnchors,
  driveDimensionValue,
  measurePoints,
  resolveDimensionReference,
  type SnapAnchor,
} from "../../editor/dimensions/dimensionMath";
import { calculateVertexFillet } from "../../editor/geometry/pathMath";

interface Props {
  viewBox: ViewBox;
  objects: CadObject[];
  referenceObjects: CadObject[];
  lockedObjectIds: Set<string>;
  relatedObjectIds: string[];
  constructionLayerIds: string[];
  activeTool: Tool;
  selectedObjectId: string | null;
  snapEnabled: boolean;
  snapSpacing: number;
  onViewBoxChange: (update: (value: ViewBox) => ViewBox) => void;
  onCursorPositionChange: (point: Point | null) => void;
  onObjectCreate: (object: CadObject) => void;
  onObjectUpdate: (object: CadObject) => void;
  onObjectCommit: (object: CadObject) => void;
  onSelectionChange: (id: string | null) => void;
  onInteractionStart: () => void;
  onInteractionCommit: () => void;
  onInteractionCancel: () => void;
  onBusyChange: (busy: boolean) => void;
}
interface PanState {
  pointerId: number;
  clientPosition: Point;
}
interface RectangleDraft {
  pointerId: number;
  start: Point;
  current: Point;
}
interface ClickDraft {
  tool: "line" | "polyline" | "circle" | "arc";
  points: Point[];
  cursor: Point;
}
interface DimensionDraft {
  points: Point[];
  references: DimensionReference[];
  cursor: Point;
}
interface MeasureDraft {
  start: Point;
  end: Point;
  complete: boolean;
}
type EditHandle =
  | { kind: "rectangle"; handle: ResizeHandle }
  | { kind: "point"; index: number }
  | { kind: "center" }
  | { kind: "radius" }
  | { kind: "arc-start" }
  | { kind: "arc-end" }
  | {
      kind: "corner-radius";
      corner: keyof Extract<PathObject, { type: "rectangle" }>["cornerRadii"];
    };
type Interaction =
  | { type: "idle" }
  | {
      type: "move";
      pointerId: number;
      startPointer: Point;
      startObject: PathObject | Extract<CadObject, { type: "dimension" }>;
    }
  | {
      type: "handle";
      pointerId: number;
      startPointer: Point;
      startObject: PathObject;
      handle: EditHandle;
    };
const MIN_SIZE = 1;
const normalizeRectangle = (a: Point, b: Point) => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(b.x - a.x),
  height: Math.abs(b.y - a.y),
});

export function CanvasView(props: Props) {
  const { t } = useTranslation();
  const {
    viewBox,
    objects,
    activeTool,
    selectedObjectId,
    snapEnabled,
    snapSpacing,
    onViewBoxChange,
    onObjectCreate,
    onBusyChange,
  } = props;
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const panRef = useRef<PanState | null>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [panning, setPanning] = useState(false);
  const [rectangleDraft, setRectangleDraft] = useState<RectangleDraft | null>(
    null,
  );
  const [clickDraft, setClickDraft] = useState<ClickDraft | null>(null);
  const [interaction, setInteraction] = useState<Interaction>({ type: "idle" });
  const [stitchPreviewSourceId, setStitchPreviewSourceId] = useState<
    string | null
  >(null);
  const [dimensionDraft, setDimensionDraft] = useState<DimensionDraft | null>(
    null,
  );
  const [measureDraft, setMeasureDraft] = useState<MeasureDraft | null>(null);
  const [snapMarker, setSnapMarker] = useState<SnapAnchor | null>(null);
  const [editingDimensionId, setEditingDimensionId] = useState<string | null>(
    null,
  );
  const selected =
    objects.find((object) => object.id === selectedObjectId) ?? null;
  const zoom = calculateZoomPercent(viewBox);
  const spacing = getGridSpacing(zoom);
  const screenUnit = viewBox.width / Math.max(size.width, 1);
  const grid = {
    x: viewBox.x - viewBox.width,
    y: viewBox.y - viewBox.height,
    width: viewBox.width * 3,
    height: viewBox.height * 3,
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width <= 0) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
      onViewBoxChange((current) => {
        const nextHeight = (current.width * height) / width;
        return Math.abs(nextHeight - current.height) < 0.001
          ? current
          : {
              ...current,
              y: current.y + (current.height - nextHeight) / 2,
              height: nextHeight,
            };
      });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [onViewBoxChange]);

  useEffect(() => {
    onBusyChange(
      Boolean(
        rectangleDraft ||
        clickDraft ||
        dimensionDraft ||
        (measureDraft && !measureDraft.complete) ||
        interaction.type !== "idle",
      ),
    );
  }, [
    clickDraft,
    dimensionDraft,
    interaction.type,
    measureDraft,
    onBusyChange,
    rectangleDraft,
  ]);

  const release = (pointerId: number) => {
    const svg = svgRef.current;
    if (svg?.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId);
  };
  const cancel = () => {
    if (interaction.type !== "idle") {
      release(interaction.pointerId);
      props.onInteractionCancel();
    }
    setInteraction({ type: "idle" });
    setRectangleDraft(null);
    setClickDraft(null);
    setDimensionDraft(null);
    setMeasureDraft(null);
    setSnapMarker(null);
  };
  useEffect(() => {
    window.addEventListener("leathercad:cancel", cancel);
    return () => window.removeEventListener("leathercad:cancel", cancel);
  });
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && clickDraft?.tool === "polyline") {
        event.preventDefault();
        if (clickDraft.points.length >= 2)
          onObjectCreate({
            id: crypto.randomUUID(),
            type: "polyline",
            points: clickDraft.points,
            closed: false,
          });
        setClickDraft(null);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [clickDraft, onObjectCreate]);

  const canvasPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    return svg
      ? screenToCanvasCoordinates(svg, { x: clientX, y: clientY })
      : null;
  };
  const snap = (point: Point) =>
    snapEnabled
      ? {
          x: snapToGrid(point.x, snapSpacing),
          y: snapToGrid(point.y, snapSpacing),
        }
      : point;
  const resolveSnap = (point: Point) => {
    const threshold = 10 * screenUnit;
    let best: SnapAnchor | null = null;
    let bestDistance = threshold;
    for (const object of objects) {
      if (!isPathObject(object)) continue;
      for (const anchor of getObjectAnchors(object)) {
        const current = distance(point, anchor.point);
        if (current <= bestDistance) {
          best = anchor;
          bestDistance = current;
        }
      }
    }
    return best
      ? { point: best.point, reference: best.reference, marker: best }
      : {
          point: snap(point),
          reference: { anchor: "point" as const, point: snap(point) },
          marker: null,
        };
  };
  const create = (object: CadObject) => onObjectCreate(object);
  const finishPolyline = (closed: boolean) => {
    if (clickDraft?.tool !== "polyline") return;
    const points = clickDraft.points.filter(
      (point, index, values) =>
        index === 0 || distance(point, values[index - 1]) > screenUnit,
    );
    if (points.length >= 2)
      create({
        id: crypto.randomUUID(),
        type: "polyline",
        points,
        closed,
      });
    setClickDraft(null);
  };

  const addDraftPoint = (point: Point) => {
    if (!clickDraft || clickDraft.tool !== activeTool) {
      setClickDraft({
        tool: activeTool as ClickDraft["tool"],
        points: [point],
        cursor: point,
      });
      return;
    }
    if (clickDraft.tool === "line") {
      create({
        id: crypto.randomUUID(),
        type: "line",
        x1: clickDraft.points[0].x,
        y1: clickDraft.points[0].y,
        x2: point.x,
        y2: point.y,
      });
      setClickDraft(null);
      return;
    }
    if (clickDraft.tool === "circle") {
      const radius = distance(clickDraft.points[0], point);
      if (radius >= MIN_SIZE)
        create({
          id: crypto.randomUUID(),
          type: "circle",
          cx: clickDraft.points[0].x,
          cy: clickDraft.points[0].y,
          radius,
        });
      setClickDraft(null);
      return;
    }
    if (clickDraft.tool === "arc") {
      if (clickDraft.points.length === 1)
        setClickDraft({
          ...clickDraft,
          points: [...clickDraft.points, point],
          cursor: point,
        });
      else {
        const center = clickDraft.points[0];
        const start = clickDraft.points[1];
        create({
          id: crypto.randomUUID(),
          type: "arc",
          cx: center.x,
          cy: center.y,
          radius: distance(center, start),
          startAngle: angleDegrees(center, start),
          endAngle: angleDegrees(center, point),
        });
        setClickDraft(null);
      }
      return;
    }
    const closeThreshold = screenUnit * 10;
    if (
      clickDraft.points.length >= 3 &&
      distance(point, clickDraft.points[0]) <= closeThreshold
    ) {
      finishPolyline(true);
      return;
    }
    setClickDraft({
      ...clickDraft,
      points: [...clickDraft.points, point],
      cursor: point,
    });
  };

  const startMove = (event: PointerEvent<SVGElement>, object: CadObject) => {
    if (object.type === "stitch" || props.lockedObjectIds.has(object.id))
      return;
    const point = canvasPoint(event.clientX, event.clientY);
    const svg = svgRef.current;
    if (!point || !svg) return;
    event.preventDefault();
    svg.setPointerCapture(event.pointerId);
    props.onInteractionStart();
    setInteraction({
      type: "move",
      pointerId: event.pointerId,
      startPointer: point,
      startObject: object,
    });
  };
  const startHandle = (
    event: PointerEvent<SVGElement>,
    object: PathObject,
    handle: EditHandle,
  ) => {
    const svg = svgRef.current;
    const point = canvasPoint(event.clientX, event.clientY);
    if (!svg || !point || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    svg.setPointerCapture(event.pointerId);
    props.onInteractionStart();
    setInteraction({
      type: "handle",
      pointerId: event.pointerId,
      startPointer: point,
      startObject: object,
      handle,
    });
  };

  const updateHandle = (
    object: PathObject,
    handle: EditHandle,
    point: Point,
  ): PathObject => {
    if (object.type === "rectangle" && handle.kind === "corner-radius") {
      const right = object.x + object.width;
      const bottom = object.y + object.height;
      const raw =
        handle.corner === "topLeft"
          ? (point.x - object.x + (point.y - object.y)) / 2
          : handle.corner === "topRight"
            ? (right - point.x + (point.y - object.y)) / 2
            : handle.corner === "bottomRight"
              ? (right - point.x + (bottom - point.y)) / 2
              : (point.x - object.x + (bottom - point.y)) / 2;
      const radius = Math.max(0, Math.round(raw * 2) / 2);
      const requested = object.linkCorners
        ? {
            topLeft: radius,
            topRight: radius,
            bottomRight: radius,
            bottomLeft: radius,
          }
        : { ...object.cornerRadii, [handle.corner]: radius };
      return {
        ...object,
        cornerRadii: normalizeRectangleCornerRadii(
          object.width,
          object.height,
          requested,
        ),
      };
    }
    if (object.type === "rectangle" && handle.kind === "rectangle")
      return resizeRectangle(object, handle.handle, point, {
        snapEnabled,
        snapSpacing,
        preserveAspectRatio: false,
      });
    if (object.type === "line" && handle.kind === "point")
      return handle.index === 0
        ? { ...object, x1: point.x, y1: point.y }
        : { ...object, x2: point.x, y2: point.y };
    if (object.type === "polyline" && handle.kind === "point")
      return {
        ...object,
        points: object.points.map((value, index) =>
          index === handle.index ? point : value,
        ),
      };
    if (object.type === "circle") {
      const center = { x: object.cx, y: object.cy };
      if (handle.kind === "center")
        return { ...object, cx: point.x, cy: point.y };
      if (handle.kind === "radius")
        return {
          ...object,
          radius: Math.max(MIN_SIZE, distance(center, point)),
        };
    }
    if (object.type === "arc") {
      const center = { x: object.cx, y: object.cy };
      if (handle.kind === "center")
        return { ...object, cx: point.x, cy: point.y };
      if (handle.kind === "radius")
        return {
          ...object,
          radius: Math.max(MIN_SIZE, distance(center, point)),
        };
      if (handle.kind === "arc-start")
        return { ...object, startAngle: angleDegrees(center, point) };
      if (handle.kind === "arc-end")
        return { ...object, endAngle: angleDegrees(center, point) };
    }
    return object;
  };

  const pointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panRef.current = {
        pointerId: event.pointerId,
        clientPosition: { x: event.clientX, y: event.clientY },
      };
      setPanning(true);
      return;
    }
    if (event.button !== 0) return;
    const raw = canvasPoint(event.clientX, event.clientY);
    if (!raw) return;
    const snapped = resolveSnap(raw);
    const point = snapped.point;
    setSnapMarker(snapped.marker);
    if (activeTool === "fillet") {
      let targetObject: Extract<PathObject, { type: "polyline" }> | null = null;
      let targetIndex = -1;
      let nearest = 10 * screenUnit;
      for (const object of objects) {
        if (object.type !== "polyline") continue;
        for (let index = 0; index < object.points.length; index += 1) {
          const vertex = object.points[index];
          const current = distance(raw, vertex);
          if (current < nearest) {
            nearest = current;
            targetObject = object;
            targetIndex = index;
          }
        }
      }
      if (targetObject && targetIndex >= 0) {
        const object = targetObject;
        const index = targetIndex;
        if (
          !object.closed &&
          (index === 0 || index === object.points.length - 1)
        )
          return;
        const previous =
          object.points[
            (index - 1 + object.points.length) % object.points.length
          ];
        const next = object.points[(index + 1) % object.points.length];
        const calculated =
          previous && next
            ? calculateVertexFillet(previous, object.points[index], next, 5)
            : null;
        if (calculated)
          props.onObjectCommit({
            ...object,
            points: object.points.map((vertex, vertexIndex) =>
              vertexIndex === index
                ? { ...vertex, cornerRadius: calculated.radius }
                : vertex,
            ),
          });
      }
      return;
    }
    if (activeTool === "dimension") {
      if (!dimensionDraft)
        setDimensionDraft({
          points: [point],
          references: [snapped.reference],
          cursor: point,
        });
      else if (dimensionDraft.points.length === 1)
        setDimensionDraft({
          ...dimensionDraft,
          points: [...dimensionDraft.points, point],
          references: [...dimensionDraft.references, snapped.reference],
          cursor: point,
        });
      else {
        const [a, b] = dimensionDraft.points;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy) || 1;
        const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const offset =
          (point.x - midpoint.x) * (-dy / length) +
          (point.y - midpoint.y) * (dx / length);
        create({
          id: crypto.randomUUID(),
          type: "dimension",
          dimensionType: "aligned",
          referenceA: dimensionDraft.references[0],
          referenceB: dimensionDraft.references[1],
          offset,
          precision: 2,
          showUnit: true,
        });
        setDimensionDraft(null);
      }
      return;
    }
    if (activeTool === "measure") {
      if (!measureDraft || measureDraft.complete)
        setMeasureDraft({ start: point, end: point, complete: false });
      else setMeasureDraft({ ...measureDraft, end: point, complete: true });
      return;
    }
    if (activeTool === "rectangle") {
      event.currentTarget.setPointerCapture(event.pointerId);
      setRectangleDraft({
        pointerId: event.pointerId,
        start: point,
        current: point,
      });
    } else if (
      activeTool === "line" ||
      activeTool === "polyline" ||
      activeTool === "circle" ||
      activeTool === "arc"
    )
      addDraftPoint(point);
    else props.onSelectionChange(null);
  };
  const pointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const raw = canvasPoint(event.clientX, event.clientY);
    if (raw) props.onCursorPositionChange(raw);
    const snapped = raw ? resolveSnap(raw) : null;
    if (
      raw &&
      (activeTool === "dimension" ||
        activeTool === "measure" ||
        activeTool === "fillet")
    )
      setSnapMarker(snapped?.marker ?? null);
    if (snapped && dimensionDraft)
      setDimensionDraft({ ...dimensionDraft, cursor: snapped.point });
    if (snapped && measureDraft && !measureDraft.complete)
      setMeasureDraft({ ...measureDraft, end: snapped.point });
    if (raw && rectangleDraft?.pointerId === event.pointerId)
      setRectangleDraft({ ...rectangleDraft, current: snap(raw) });
    if (raw && clickDraft) setClickDraft({ ...clickDraft, cursor: snap(raw) });
    if (
      raw &&
      interaction.type !== "idle" &&
      interaction.pointerId === event.pointerId
    ) {
      const point = snap(raw);
      if (interaction.type === "move")
        if (interaction.startObject.type === "dimension") {
          const deltaX = point.x - interaction.startPointer.x;
          const deltaY = point.y - interaction.startPointer.y;
          const dimension = interaction.startObject;
          let delta = dimension.dimensionType === "vertical" ? deltaX : deltaY;
          if (dimension.dimensionType === "aligned" && dimension.referenceB) {
            const a = resolveDimensionReference(dimension.referenceA, objects);
            const b = resolveDimensionReference(dimension.referenceB, objects);
            if (a && b) {
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const length = Math.hypot(dx, dy) || 1;
              delta = deltaX * (-dy / length) + deltaY * (dx / length);
            }
          }
          props.onObjectUpdate({
            ...dimension,
            offset: dimension.offset + delta,
          });
        } else {
          props.onObjectUpdate(
            translateCadObject(
              interaction.startObject,
              point.x - interaction.startPointer.x,
              point.y - interaction.startPointer.y,
            ),
          );
        }
      else if (
        interaction.startObject.type === "rectangle" &&
        interaction.handle.kind === "corner-radius"
      ) {
        const rectangle = interaction.startObject;
        const corner = interaction.handle.corner;
        const direction = {
          topLeft: { x: 1, y: 1 },
          topRight: { x: -1, y: 1 },
          bottomRight: { x: -1, y: -1 },
          bottomLeft: { x: 1, y: -1 },
        }[corner];
        const delta =
          ((point.x - interaction.startPointer.x) * direction.x +
            (point.y - interaction.startPointer.y) * direction.y) /
          2;
        const radius = Math.max(
          0,
          Math.round((rectangle.cornerRadii[corner] + delta) * 2) / 2,
        );
        const requested = rectangle.linkCorners
          ? {
              topLeft: radius,
              topRight: radius,
              bottomRight: radius,
              bottomLeft: radius,
            }
          : { ...rectangle.cornerRadii, [corner]: radius };
        props.onObjectUpdate({
          ...rectangle,
          cornerRadii: normalizeRectangleCornerRadii(
            rectangle.width,
            rectangle.height,
            requested,
          ),
        });
      } else
        props.onObjectUpdate(
          updateHandle(interaction.startObject, interaction.handle, point),
        );
    }
    const pan = panRef.current;
    if (pan?.pointerId === event.pointerId) {
      const previous = canvasPoint(pan.clientPosition.x, pan.clientPosition.y);
      if (previous && raw)
        props.onViewBoxChange((value) =>
          panViewBox(value, { x: raw.x - previous.x, y: raw.y - previous.y }),
        );
      pan.clientPosition = { x: event.clientX, y: event.clientY };
    }
  };
  const pointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (
      interaction.type !== "idle" &&
      interaction.pointerId === event.pointerId
    ) {
      release(event.pointerId);
      setInteraction({ type: "idle" });
      props.onInteractionCommit();
      return;
    }
    if (rectangleDraft?.pointerId === event.pointerId) {
      const geometry = normalizeRectangle(
        rectangleDraft.start,
        rectangleDraft.current,
      );
      if (geometry.width >= MIN_SIZE && geometry.height >= MIN_SIZE)
        create({
          id: crypto.randomUUID(),
          type: "rectangle",
          ...geometry,
          cornerRadii: { ...ZERO_CORNER_RADII },
          linkCorners: true,
        });
      release(event.pointerId);
      setRectangleDraft(null);
      return;
    }
    if (panRef.current?.pointerId === event.pointerId) {
      release(event.pointerId);
      panRef.current = null;
      setPanning(false);
    }
  };
  const wheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const point = canvasPoint(event.clientX, event.clientY);
    if (point)
      props.onViewBoxChange((value) =>
        zoomViewBoxAtPoint(
          value,
          point,
          calculateZoomPercent(value) * (event.deltaY < 0 ? 1.1 : 1 / 1.1),
        ),
      );
  };

  const selectObject = (id: string) => {
    if (props.lockedObjectIds.has(id)) return;
    const source = objects.find((object) => object.id === id);
    if (
      activeTool === "stitch" &&
      source &&
      source.type !== "stitch" &&
      source.type !== "dimension"
    ) {
      create({
        id: crypto.randomUUID(),
        type: "stitch",
        sourceObjectId: source.id,
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
      });
      return;
    }
    props.onSelectionChange(id);
  };
  const commitDimensionValue = (
    dimensionId: string,
    requestedValue: number,
  ) => {
    setEditingDimensionId(null);
    if (!Number.isFinite(requestedValue) || requestedValue <= 0) return;
    const dimension = props.referenceObjects.find(
      (object) => object.id === dimensionId,
    );
    if (
      !dimension ||
      dimension.type !== "dimension" ||
      !dimension.referenceA.objectId
    )
      return;
    const source = props.referenceObjects.find(
      (object) => object.id === dimension.referenceA.objectId,
    );
    if (!source || source.type === "stitch" || source.type === "dimension")
      return;
    if (props.lockedObjectIds.has(source.id)) return;
    const updated = driveDimensionValue(
      dimension,
      source,
      props.referenceObjects,
      requestedValue,
    );
    if (updated) props.onObjectCommit(updated);
  };
  const previewStitch: CadObject | null =
    activeTool === "stitch" && stitchPreviewSourceId
      ? {
          id: "stitch-preview",
          type: "stitch",
          sourceObjectId: stitchPreviewSourceId,
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
        }
      : null;
  const draftPath = clickDraft ? [...clickDraft.points, clickDraft.cursor] : [];
  return (
    <div className="canvas-view">
      <div className="canvas-ruler-corner" aria-hidden="true" />
      <HorizontalRuler
        viewBox={viewBox}
        majorSpacing={spacing.major}
        width={size.width}
      />
      <VerticalRuler
        viewBox={viewBox}
        majorSpacing={spacing.major}
        height={size.height}
      />
      <div ref={stageRef} className="canvas-stage">
        <svg
          ref={svgRef}
          className={`canvas-svg canvas-svg--${activeTool} ${panning ? "canvas-svg--panning" : ""}`}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          preserveAspectRatio="none"
          onWheel={wheel}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={cancel}
          onDoubleClick={() => finishPolyline(false)}
          onContextMenu={(event) => event.preventDefault()}
        >
          <defs>
            <pattern
              id="minorGrid"
              width={spacing.minor}
              height={spacing.minor}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${spacing.minor} 0 L 0 0 0 ${spacing.minor}`}
                fill="none"
                stroke="#292c31"
                strokeWidth="0.5"
                vectorEffect="non-scaling-stroke"
              />
            </pattern>
            <pattern
              id="adaptiveGrid"
              width={spacing.major}
              height={spacing.major}
              patternUnits="userSpaceOnUse"
            >
              <rect
                width={spacing.major}
                height={spacing.major}
                fill="url(#minorGrid)"
              />
              <path
                d={`M ${spacing.major} 0 L 0 0 0 ${spacing.major}`}
                fill="none"
                stroke="#3a3e45"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </pattern>
          </defs>
          <rect {...grid} fill="#15171a" />
          <rect {...grid} fill="url(#adaptiveGrid)" />
          <line
            x1={grid.x}
            y1="0"
            x2={grid.x + grid.width}
            y2="0"
            className="canvas-origin-axis"
          />
          <line
            x1="0"
            y1={grid.y}
            x2="0"
            y2={grid.y + grid.height}
            className="canvas-origin-axis"
          />
          {objects.map((object) => (
            <CadObjectRenderer
              key={object.id}
              object={object}
              objects={props.referenceObjects}
              activeTool={activeTool}
              selected={object.id === selectedObjectId}
              related={props.relatedObjectIds.includes(object.id)}
              construction={props.constructionLayerIds.includes(
                object.layerId ?? "",
              )}
              editingDimensionId={editingDimensionId}
              onDimensionEditStart={
                props.lockedObjectIds.has(object.id)
                  ? undefined
                  : setEditingDimensionId
              }
              onDimensionEditCommit={commitDimensionValue}
              onDimensionEditCancel={() => setEditingDimensionId(null)}
              screenUnit={screenUnit}
              onSelect={selectObject}
              onMoveStart={startMove}
              onHover={
                object.type === "stitch" ? undefined : setStitchPreviewSourceId
              }
            />
          ))}
          {previewStitch && (
            <g className="stitch-preview">
              <CadObjectRenderer
                object={previewStitch}
                objects={props.referenceObjects}
                activeTool={activeTool}
                selected={false}
                related={false}
                screenUnit={screenUnit}
                onSelect={() => undefined}
                onMoveStart={() => undefined}
              />
            </g>
          )}
          {activeTool === "select" && selected?.type === "rectangle" && (
            <>
              <SelectionOverlay
                rectangle={selected}
                screenUnit={screenUnit}
                showDimensions={interaction.type === "handle"}
                onResizeStart={(event, handle) =>
                  startHandle(event, selected, { kind: "rectangle", handle })
                }
              />
              <RadiusHandles
                rectangle={selected}
                unit={screenUnit}
                activeCorner={
                  interaction.type === "handle" &&
                  interaction.handle.kind === "corner-radius"
                    ? interaction.handle.corner
                    : null
                }
                onStart={(event, corner) =>
                  startHandle(event, selected, {
                    kind: "corner-radius",
                    corner,
                  })
                }
              />
            </>
          )}
          {activeTool === "select" &&
            selected &&
            selected.type !== "rectangle" &&
            selected.type !== "stitch" &&
            selected.type !== "dimension" && (
              <ObjectHandles
                object={selected}
                unit={screenUnit}
                onStart={startHandle}
              />
            )}
          {rectangleDraft && (
            <rect
              className="cad-rectangle-draft"
              {...normalizeRectangle(
                rectangleDraft.start,
                rectangleDraft.current,
              )}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {draftPath.length > 1 && (
            <path
              className="cad-draft-path"
              d={draftPath
                .map(
                  (point, index) =>
                    `${index ? "L" : "M"} ${point.x} ${point.y}`,
                )
                .join(" ")}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {clickDraft?.tool === "circle" && (
            <circle
              className="cad-draft-path"
              cx={clickDraft.points[0].x}
              cy={clickDraft.points[0].y}
              r={distance(clickDraft.points[0], clickDraft.cursor)}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {dimensionDraft && (
            <path
              className="dimension-draft"
              d={`M ${dimensionDraft.points[0].x} ${dimensionDraft.points[0].y} L ${dimensionDraft.points[1]?.x ?? dimensionDraft.cursor.x} ${dimensionDraft.points[1]?.y ?? dimensionDraft.cursor.y}${dimensionDraft.points.length > 1 ? ` L ${dimensionDraft.cursor.x} ${dimensionDraft.cursor.y}` : ""}`}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {measureDraft && (
            <line
              className="measure-line"
              x1={measureDraft.start.x}
              y1={measureDraft.start.y}
              x2={measureDraft.end.x}
              y2={measureDraft.end.y}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {snapMarker && (
            <rect
              className={`object-snap object-snap--${snapMarker.kind}`}
              x={snapMarker.point.x - 4 * screenUnit}
              y={snapMarker.point.y - 4 * screenUnit}
              width={8 * screenUnit}
              height={8 * screenUnit}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <div className="canvas-info">
          <span>{t("canvas.title")}</span>
          <span>{Math.round(zoom)}%</span>
          <span>
            {t("canvas.objects")}: {objects.length}
          </span>
        </div>
        {measureDraft &&
          (() => {
            const measurement = measurePoints(
              measureDraft.start,
              measureDraft.end,
            );
            return (
              <div className="measure-panel">
                <strong>
                  {t("measure.distance")}: {measurement.distance.toFixed(2)}{" "}
                  {t("common.mm")}
                </strong>
                <span>ΔX: {measurement.deltaX.toFixed(2)}</span>
                <span>ΔY: {measurement.deltaY.toFixed(2)}</span>
                <span>
                  {t("measure.angle")}: {measurement.angle.toFixed(1)}°
                </span>
              </div>
            );
          })()}
      </div>
    </div>
  );
}

function RadiusHandles({
  rectangle,
  unit,
  activeCorner,
  onStart,
}: {
  rectangle: RectangleObject;
  unit: number;
  activeCorner: keyof RectangleObject["cornerRadii"] | null;
  onStart: (
    event: PointerEvent<SVGElement>,
    corner: keyof RectangleObject["cornerRadii"],
  ) => void;
}) {
  const { t } = useTranslation();
  const inset = (radius: number) => Math.max(radius, 10 * unit);
  const handles = [
    {
      corner: "topLeft" as const,
      x: rectangle.x + inset(rectangle.cornerRadii.topLeft),
      y: rectangle.y + inset(rectangle.cornerRadii.topLeft),
    },
    {
      corner: "topRight" as const,
      x: rectangle.x + rectangle.width - inset(rectangle.cornerRadii.topRight),
      y: rectangle.y + inset(rectangle.cornerRadii.topRight),
    },
    {
      corner: "bottomRight" as const,
      x:
        rectangle.x +
        rectangle.width -
        inset(rectangle.cornerRadii.bottomRight),
      y:
        rectangle.y +
        rectangle.height -
        inset(rectangle.cornerRadii.bottomRight),
    },
    {
      corner: "bottomLeft" as const,
      x: rectangle.x + inset(rectangle.cornerRadii.bottomLeft),
      y:
        rectangle.y +
        rectangle.height -
        inset(rectangle.cornerRadii.bottomLeft),
    },
  ];
  return (
    <g>
      {handles.map((handle) => (
        <g key={handle.corner}>
          <circle
            className="radius-handle"
            cx={handle.x}
            cy={handle.y}
            r={4 * unit}
            onPointerDown={(event) => onStart(event, handle.corner)}
          />
          {activeCorner === handle.corner && (
            <text
              className="radius-label"
              x={handle.x + 8 * unit}
              y={handle.y - 8 * unit}
              fontSize={11 * unit}
            >
              R {rectangle.cornerRadii[handle.corner].toFixed(2)}{" "}
              {t("common.mm")}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

function ObjectHandles({
  object,
  unit,
  onStart,
}: {
  object: PathObject;
  unit: number;
  onStart: (
    event: PointerEvent<SVGElement>,
    object: PathObject,
    handle: EditHandle,
  ) => void;
}) {
  let handles: Array<{ point: Point; handle: EditHandle }> = [];
  if (object.type === "line")
    handles = [
      {
        point: { x: object.x1, y: object.y1 },
        handle: { kind: "point", index: 0 },
      },
      {
        point: { x: object.x2, y: object.y2 },
        handle: { kind: "point", index: 1 },
      },
    ];
  if (object.type === "polyline")
    handles = object.points.map((point, index) => ({
      point,
      handle: { kind: "point", index },
    }));
  if (object.type === "circle")
    handles = [
      { point: { x: object.cx, y: object.cy }, handle: { kind: "center" } },
      {
        point: { x: object.cx + object.radius, y: object.cy },
        handle: { kind: "radius" },
      },
    ];
  if (object.type === "arc") {
    const center = { x: object.cx, y: object.cy };
    handles = [
      { point: center, handle: { kind: "center" } },
      {
        point: { x: object.cx + object.radius, y: object.cy },
        handle: { kind: "radius" },
      },
      {
        point: pointOnCircle(center, object.radius, object.startAngle),
        handle: { kind: "arc-start" },
      },
      {
        point: pointOnCircle(center, object.radius, object.endAngle),
        handle: { kind: "arc-end" },
      },
    ];
  }
  return (
    <g>
      {handles.map(({ point, handle }, index) => (
        <circle
          key={index}
          className="selection-handle"
          cx={point.x}
          cy={point.y}
          r={4 * unit}
          vectorEffect="non-scaling-stroke"
          onPointerDown={(event) => onStart(event, object, handle)}
        />
      ))}
    </g>
  );
}
