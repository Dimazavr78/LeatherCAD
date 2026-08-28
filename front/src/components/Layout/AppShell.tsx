import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CanvasView } from "../Canvas/CanvasView";
import {
  calculateZoomPercent,
  getGridSpacing,
  getViewBoxCenter,
  INITIAL_VIEWBOX,
  zoomViewBoxAtPoint,
  type Point,
  type ViewBox,
} from "../Canvas/canvasMath";
import { PropertiesPanel } from "../Properties/PropertiesPanel";
import { LeftToolbar } from "../Toolbar/LeftToolbar";
import {
  cloneCadObject,
  cloneCadObjectWithOffset,
  translateCadObject,
} from "../../editor/cadObjectUtils";
import { useEditorHistory } from "../../editor/history/useEditorHistory";
import {
  useEditorShortcuts,
  type NudgeDirection,
} from "../../editor/useEditorShortcuts";
import type { CadLayer, CadObject, EditorLevel, Tool } from "../../types/cad";
import { normalizedRectangle } from "../../editor/geometry/rectangleGeometry";
import {
  dependsOnObject,
  getDependentObjectIds,
} from "../../editor/dependencies";
import { BottomBar } from "./BottomBar";
import { TopBar } from "./TopBar";
import {
  DEFAULT_LAYERS,
  ROOT_LEVEL,
  ROOT_LEVEL_ID,
  getAutomaticLayerId,
  getLevelPath,
} from "../../editor/projectModel";
import { ProjectPanel } from "../Project/ProjectPanel";
import { DEFAULT_MATERIALS } from "../../editor/materials";
import {
  getPartDimensions,
  getPartGeometry,
  getPartStitches,
} from "../../editor/parts/partGeometry";

const PASTE_OFFSET = 10;
const NUDGE_SMALL = 1;
const NUDGE_LARGE = 10;

export function AppShell() {
  const { t } = useTranslation();
  const {
    state,
    canUndo,
    canRedo,
    commitState,
    updateLiveState,
    beginTransaction,
    commitTransaction,
    cancelTransaction,
    undo,
    redo,
  } = useEditorHistory({
    objects: [],
    layers: DEFAULT_LAYERS,
    levels: [ROOT_LEVEL],
    activeLayerId: DEFAULT_LAYERS[0].id,
    currentLevelId: ROOT_LEVEL.id,
    materials: DEFAULT_MATERIALS,
    renderMode: "wireframe",
  });
  const objects = state.objects;
  const layers = state.layers;
  const levels = state.levels;
  const materials = state.materials;
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<CadObject[]>([]);
  const [canvasBusy, setCanvasBusy] = useState(false);
  const [viewBox, setViewBox] = useState<ViewBox>(INITIAL_VIEWBOX);
  const [cursorPosition, setCursorPosition] = useState<Point | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const pasteCountRef = useRef(0);
  const zoom = Math.round(calculateZoomPercent(viewBox));
  const gridSpacing = getGridSpacing(zoom);
  const selectedObject =
    objects.find((object) => object.id === selectedObjectId) ?? null;
  const layerById = useMemo(
    () => new Map(layers.map((layer) => [layer.id, layer])),
    [layers],
  );
  const visibleObjects = objects
    .filter(
      (object) =>
        object.type !== "part" &&
        object.levelId === state.currentLevelId &&
        (layerById.get(object.layerId ?? "")?.visible ?? true),
    )
    .sort(
      (a, b) =>
        (layerById.get(a.layerId ?? "")?.order ?? 0) -
        (layerById.get(b.layerId ?? "")?.order ?? 0),
    );
  const lockedObjectIds = useMemo(
    () =>
      new Set(
        objects
          .filter((object) => layerById.get(object.layerId ?? "")?.locked)
          .map((object) => object.id),
      ),
    [layerById, objects],
  );
  const selectedLocked = selectedObject
    ? lockedObjectIds.has(selectedObject.id)
    : false;
  const relatedObjectIds = selectedObject
    ? selectedObject.type === "part"
      ? [
          selectedObject.contourSourceId,
          ...(getPartGeometry(selectedObject, objects)?.holes.map(
            (hole) => hole.id,
          ) ?? []),
          ...getPartStitches(selectedObject, objects).map(
            (stitch) => stitch.id,
          ),
          ...getPartDimensions(selectedObject, objects).map(
            (dimension) => dimension.id,
          ),
        ]
      : objects
          .filter(
            (object) =>
              dependsOnObject(object, selectedObject.id) ||
              dependsOnObject(selectedObject, object.id),
          )
          .map((object) => object.id)
    : [];

  const requestCancel = useCallback(() => {
    window.dispatchEvent(new Event("leathercad:cancel"));
  }, []);

  const addObject = useCallback(
    (object: CadObject) => {
      const assignedObject = {
        ...object,
        layerId: getAutomaticLayerId(object, state.activeLayerId),
        levelId: state.currentLevelId,
      } as CadObject;
      commitState((document) => ({
        ...document,
        objects: [...document.objects, assignedObject],
      }));
      setSelectedObjectId(assignedObject.id);
    },
    [commitState, state.activeLayerId, state.currentLevelId],
  );

  const updateObject = useCallback(
    (id: string, patch: Partial<CadObject>) => {
      updateLiveState((document) => ({
        ...document,
        objects: document.objects.map((object) => {
          if (object.id !== id) return object;
          const updated = { ...object, ...patch } as CadObject;
          return updated.type === "rectangle"
            ? normalizedRectangle(updated)
            : updated;
        }),
      }));
    },
    [updateLiveState],
  );

  const replaceObject = useCallback(
    (updatedObject: CadObject) => {
      updateLiveState((document) => ({
        ...document,
        objects: document.objects.map((object) =>
          object.id === updatedObject.id ? updatedObject : object,
        ),
      }));
    },
    [updateLiveState],
  );

  const commitObject = useCallback(
    (updatedObject: CadObject) => {
      commitState((document) => ({
        ...document,
        objects: document.objects.map((object) =>
          object.id === updatedObject.id ? updatedObject : object,
        ),
      }));
    },
    [commitState],
  );

  const deleteSelected = useCallback(() => {
    if (canvasBusy) {
      requestCancel();
      return;
    }

    if (!selectedObjectId || lockedObjectIds.has(selectedObjectId)) {
      return;
    }

    const sourcePart = objects.find(
      (object) =>
        object.type === "part" && object.contourSourceId === selectedObjectId,
    );
    if (sourcePart?.type === "part") {
      window.alert(t("parts.warnings.sourceInUse", { name: sourcePart.name }));
      return;
    }

    commitState((document) => {
      const selected = document.objects.find(
        (object) => object.id === selectedObjectId,
      );
      if (selected?.type === "part")
        return {
          ...document,
          objects: document.objects.filter(
            (object) => object.id !== selectedObjectId,
          ),
        };
      const dependentIds = getDependentObjectIds(
        selectedObjectId,
        document.objects,
      );
      return {
        ...document,
        objects: document.objects.filter(
          (object) =>
            object.id !== selectedObjectId && !dependentIds.has(object.id),
        ),
      };
    });
    setSelectedObjectId(null);
  }, [
    canvasBusy,
    commitState,
    lockedObjectIds,
    requestCancel,
    selectedObjectId,
    objects,
    t,
  ]);

  const undoAction = useCallback(() => {
    if (canvasBusy) {
      requestCancel();
      return;
    }

    undo();
    setSelectedObjectId(null);
  }, [canvasBusy, requestCancel, undo]);

  const redoAction = useCallback(() => {
    if (canvasBusy) {
      requestCancel();
      return;
    }

    redo();
    setSelectedObjectId(null);
  }, [canvasBusy, redo, requestCancel]);

  const copySelected = useCallback(() => {
    if (!selectedObject || selectedObject.type === "part") {
      return;
    }

    setClipboard([cloneCadObject(selectedObject)]);
    pasteCountRef.current = 0;
  }, [selectedObject]);

  const paste = useCallback(() => {
    if (clipboard.length === 0) {
      return;
    }

    pasteCountRef.current += 1;
    const offset = PASTE_OFFSET * pasteCountRef.current;
    const pastedObjects = clipboard.map((object) => ({
      ...cloneCadObjectWithOffset(object, offset),
      levelId: state.currentLevelId,
    }));

    commitState((document) => ({
      ...document,
      objects: [...document.objects, ...pastedObjects],
    }));
    setSelectedObjectId(pastedObjects.at(-1)?.id ?? null);
  }, [clipboard, commitState, state.currentLevelId]);

  const duplicate = useCallback(() => {
    if (!selectedObject || selectedLocked || selectedObject.type === "part") {
      return;
    }

    const duplicateObject = cloneCadObjectWithOffset(
      selectedObject,
      PASTE_OFFSET,
    );
    commitState((document) => ({
      ...document,
      objects: [...document.objects, duplicateObject],
    }));
    setSelectedObjectId(duplicateObject.id);
  }, [commitState, selectedLocked, selectedObject]);

  const nudge = useCallback(
    (direction: NudgeDirection, largeStep: boolean) => {
      if (activeTool !== "select" || !selectedObject || selectedLocked) {
        return;
      }

      const step = largeStep ? NUDGE_LARGE : NUDGE_SMALL;
      const deltaX =
        direction === "left" ? -step : direction === "right" ? step : 0;
      const deltaY =
        direction === "up" ? -step : direction === "down" ? step : 0;
      const movedObject = translateCadObject(selectedObject, deltaX, deltaY);

      commitState((document) => ({
        ...document,
        objects: document.objects.map((object) =>
          object.id === movedObject.id ? movedObject : object,
        ),
      }));
    },
    [activeTool, commitState, selectedLocked, selectedObject],
  );

  const shortcutActions = useMemo(
    () => ({
      undo: undoAction,
      redo: redoAction,
      copy: copySelected,
      paste,
      duplicate,
      deleteSelected,
      nudge,
      cancel: requestCancel,
    }),
    [
      copySelected,
      deleteSelected,
      duplicate,
      nudge,
      paste,
      redoAction,
      requestCancel,
      undoAction,
    ],
  );
  useEditorShortcuts(shortcutActions);

  const setZoomAroundCenter = (requestedZoom: number) => {
    setViewBox((currentViewBox) =>
      zoomViewBoxAtPoint(
        currentViewBox,
        getViewBoxCenter(currentViewBox),
        requestedZoom,
      ),
    );
  };

  const setLayers = (nextLayers: CadLayer[]) => {
    commitState((document) => ({ ...document, layers: nextLayers }));
    if (
      selectedObject &&
      !nextLayers.find((layer) => layer.id === selectedObject.layerId)?.visible
    )
      setSelectedObjectId(null);
  };
  const setLevels = (nextLevels: EditorLevel[]) =>
    commitState((document) => ({ ...document, levels: nextLevels }));
  const setActiveLayer = (activeLayerId: string) =>
    commitState((document) => ({ ...document, activeLayerId }));
  const setCurrentLevel = (currentLevelId: string) => {
    commitState((document) => ({ ...document, currentLevelId }));
    setSelectedObjectId(null);
  };
  const levelPath = getLevelPath(levels, state.currentLevelId);

  return (
    <div className="app-shell">
      <TopBar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undoAction}
        onRedo={redoAction}
      />

      <div className="workspace">
        <aside
          className={`left-panel ${
            leftCollapsed ? "left-panel--collapsed" : ""
          }`}
        >
          {!leftCollapsed && (
            <>
              <LeftToolbar
                activeTool={activeTool}
                onToolChange={setActiveTool}
              />
              <ProjectPanel
                layers={layers}
                levels={levels}
                activeLayerId={state.activeLayerId}
                currentLevelId={state.currentLevelId}
                onLayersChange={setLayers}
                onActiveLayerChange={setActiveLayer}
                onLevelsChange={setLevels}
                onCurrentLevelChange={setCurrentLevel}
                objects={objects}
                materials={materials}
                selectedObjectId={selectedObjectId}
                renderMode={state.renderMode}
                onSelectionChange={setSelectedObjectId}
                onMaterialsChange={(nextMaterials) =>
                  commitState((document) => ({
                    ...document,
                    materials: nextMaterials,
                  }))
                }
                onRenderModeChange={(renderMode) =>
                  commitState((document) => ({ ...document, renderMode }))
                }
              />
            </>
          )}
          <button
            className="panel-collapse-button panel-collapse-button--left"
            onClick={() => setLeftCollapsed((value) => !value)}
            title={leftCollapsed ? t("panels.expand") : t("panels.collapse")}
          >
            {leftCollapsed ? "›" : "‹"}
          </button>
        </aside>

        <main className="canvas-area">
          <nav className="level-breadcrumbs">
            {levelPath.map((level, index) => (
              <button key={level.id} onClick={() => setCurrentLevel(level.id)}>
                {index > 0 && "› "}
                {level.id === ROOT_LEVEL_ID ? t("levels.root") : level.name}
              </button>
            ))}
          </nav>
          <CanvasView
            viewBox={viewBox}
            objects={visibleObjects}
            referenceObjects={objects.filter(
              (object) => object.levelId === state.currentLevelId,
            )}
            lockedObjectIds={lockedObjectIds}
            relatedObjectIds={relatedObjectIds}
            constructionLayerIds={layers
              .filter((layer) => layer.type === "construction")
              .map((layer) => layer.id)}
            activeTool={activeTool}
            selectedObjectId={selectedObjectId}
            snapEnabled={snapEnabled}
            snapSpacing={gridSpacing.minor}
            onViewBoxChange={setViewBox}
            onCursorPositionChange={setCursorPosition}
            onObjectCreate={addObject}
            materials={materials}
            renderMode={state.renderMode}
            onObjectUpdate={replaceObject}
            onObjectCommit={commitObject}
            onSelectionChange={setSelectedObjectId}
            onInteractionStart={beginTransaction}
            onInteractionCommit={commitTransaction}
            onInteractionCancel={cancelTransaction}
            onBusyChange={setCanvasBusy}
          />
        </main>

        <aside
          className={`right-panel ${
            rightCollapsed ? "right-panel--collapsed" : ""
          }`}
        >
          <button
            className="panel-collapse-button panel-collapse-button--right"
            onClick={() => setRightCollapsed((value) => !value)}
            title={rightCollapsed ? t("panels.expand") : t("panels.collapse")}
          >
            {rightCollapsed ? "‹" : "›"}
          </button>
          {!rightCollapsed && (
            <PropertiesPanel
              selectedObject={selectedObject}
              objects={objects}
              layers={layers}
              levels={levels}
              materials={materials}
              renderMode={state.renderMode}
              onSelectionChange={setSelectedObjectId}
              readOnly={selectedLocked}
              onObjectChange={updateObject}
              onObjectCreate={addObject}
              onEditStart={beginTransaction}
              onEditCommit={commitTransaction}
              onEditCancel={cancelTransaction}
            />
          )}
        </aside>
      </div>

      <BottomBar
        zoom={zoom}
        cursorPosition={cursorPosition}
        gridSpacing={gridSpacing.minor}
        snapEnabled={snapEnabled}
        onSnapToggle={() => setSnapEnabled((enabled) => !enabled)}
        onZoomIn={() => setZoomAroundCenter(zoom + 10)}
        onZoomOut={() => setZoomAroundCenter(zoom - 10)}
        onResetZoom={() => setZoomAroundCenter(100)}
        onFit={() => setViewBox(INITIAL_VIEWBOX)}
      />
    </div>
  );
}
