<div align="center">

# LeatherCAD

**A local-first parametric CAD workspace for leathercraft patterns.**

[English](README.md) · [Русский](README.ru.md)

![Version](https://img.shields.io/badge/version-0.0.11-d8b36a)
![React](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6)
![Status](https://img.shields.io/badge/status-early%20development-orange)

</div>

LeatherCAD is an open-source-oriented CAD application for designing leather patterns directly in the browser. It combines precise geometry, associative dimensions, stitching layouts, holes, layers, and an infinite SVG canvas in one focused workspace.

> [!IMPORTANT]
> LeatherCAD is in early development. Version `0.0.11` is suitable for experimentation, but project persistence, file export, and production manufacturing workflows are not implemented yet.

## Highlights

- Infinite SVG canvas with pan, cursor-centered zoom, adaptive grid, rulers, and object snapping.
- Rectangle, line, polyline, circle, arc, fillet, dimension, and measurement tools.
- Precise selection, movement, resizing, corner-radius handles, and property editing.
- Associative geometry references: dimensions and derived objects follow their source geometry.
- Circular, slot, and rounded rectangular holes attached to a host object.
- Absolute, relative, and edge-offset hole positioning.
- Parametric stitching around outer contours and holes.
- Recursive dependency handling for safe deletion and Undo/Redo.
- Layers, nested project levels, clipboard operations, and keyboard nudging.
- English and Russian interface localization.

## Quick start

Requirements:

- Node.js 22 or newer
- npm 10 or newer

```bash
git clone https://github.com/Dimazavr78/LeatherCAD.git
cd LeatherCAD
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

### Useful commands

```bash
npm run dev                         # Start the frontend
npm run dev:back                    # Start the experimental backend
npm run build                       # Build frontend and backend
npm run test --workspace=front      # Run geometry/editor tests
npm run lint --workspace=front      # Run frontend linting
npm run preview --workspace=front   # Preview the production frontend
```

## Basic workflow

1. Select a drawing tool and create the base geometry.
2. Use **Select** to move or resize the object and edit exact values in **Properties**.
3. Add associative dimensions or use the temporary selection measurements.
4. Select **Hole**, then click inside a rectangle, circle, or closed polyline.
5. Configure the hole shape and position in **Properties**.
6. Select **Stitch** and click a contour, or use **Add Stitch Around Hole**.
7. Organize the project with layers and nested levels.

### Navigation and shortcuts

| Action | Control |
|---|---|
| Pan | Middle mouse button or `Shift` + left drag |
| Zoom | Mouse wheel |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Y` |
| Copy / Paste | `Ctrl+C` / `Ctrl+V` |
| Duplicate | `Ctrl+D` |
| Delete | `Delete` or `Backspace` |
| Nudge | Arrow keys |
| Large nudge | `Shift` + arrow keys |
| Cancel operation | `Esc` |

## Associative model

LeatherCAD avoids storing derived coordinates when they can be calculated from source geometry:

```text
CAD geometry
├── geometry anchors
├── associative dimensions
├── holes
│   ├── calculated position
│   └── stitching
└── outer-contour stitching
```

`GeometryReference` identifies an object and one of its logical anchors. The same anchor provider is used by snapping and dimensions. Holes store their host and positioning rule rather than only a detached center point. Stitch points and displayed dimension values are generated from their current sources.

## Project structure

```text
LeatherCAD/
├── front/                  React, TypeScript, Vite, SVG editor
│   └── src/
│       ├── components/     Canvas and application UI
│       ├── editor/         Geometry, dimensions, holes, history, stitching
│       ├── locales/        English and Russian translations
│       └── types/          CAD domain model
├── back/                   Experimental Fastify service
├── README.md               English documentation
└── README.ru.md            Russian documentation
```

## Current limitations

- No Save/Open or `.lcad` project format.
- No DXF or PDF export.
- No boolean operations, Trim, Extend, 3D, materials, or complete Part system.
- Custom holes converted from polylines are not implemented yet.
- Hole boundary constraints for circles and polylines currently use their bounding boxes.
- Auto-dimension editing currently uses a dialog instead of an inline SVG input.

## Contributing

Keep changes focused and verify them before committing:

```bash
npm run test --workspace=front
npm run lint --workspace=front
npm run build --workspace=front
```

When a user-facing feature, command, limitation, or version changes, update both `README.md` and `README.ru.md` in the same commit. Translation files must retain matching key sets.

## Roadmap

- Native project persistence and the `.lcad` format.
- Custom hole contours and accurate host-boundary constraints.
- DXF and PDF export.
- Part and material systems.
- More direct-manipulation tools and inline parametric editing.

---

LeatherCAD is being built iteratively for makers who want accurate, editable, and reusable leather patterns.
