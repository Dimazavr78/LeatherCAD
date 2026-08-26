import type { Point } from './canvasMath';
import { snapToGrid } from './canvasMath';
import type { RectangleObject, ResizeHandle } from '../../types/cad';

export const MIN_RECTANGLE_SIZE = 0.1;

interface SnapOptions {
    snapEnabled: boolean;
    snapSpacing: number;
}

interface ResizeOptions extends SnapOptions {
    preserveAspectRatio: boolean;
}

export function moveRectangle(
    rectangle: RectangleObject,
    startPointer: Point,
    currentPointer: Point,
    options: SnapOptions,
): RectangleObject {
    const rawX = rectangle.x + currentPointer.x - startPointer.x;
    const rawY = rectangle.y + currentPointer.y - startPointer.y;

    return {
        ...rectangle,
        x: options.snapEnabled
            ? snapToGrid(rawX, options.snapSpacing)
            : rawX,
        y: options.snapEnabled
            ? snapToGrid(rawY, options.snapSpacing)
            : rawY,
    };
}

export function resizeRectangle(
    rectangle: RectangleObject,
    handle: ResizeHandle,
    pointer: Point,
    options: ResizeOptions,
): RectangleObject {
    const movesWest = handle.includes('w');
    const movesEast = handle.includes('e');
    const movesNorth = handle.includes('n');
    const movesSouth = handle.includes('s');
    const isCorner = (movesWest || movesEast) && (movesNorth || movesSouth);
    const snappedPointer = {
        x: options.snapEnabled
            ? snapToGrid(pointer.x, options.snapSpacing)
            : pointer.x,
        y: options.snapEnabled
            ? snapToGrid(pointer.y, options.snapSpacing)
            : pointer.y,
    };
    let left = rectangle.x;
    let top = rectangle.y;
    let right = rectangle.x + rectangle.width;
    let bottom = rectangle.y + rectangle.height;

    if (isCorner && options.preserveAspectRatio) {
        const fixedX = movesWest ? right : left;
        const fixedY = movesNorth ? bottom : top;
        const rawWidth = Math.max(
            MIN_RECTANGLE_SIZE,
            Math.abs(snappedPointer.x - fixedX),
        );
        const rawHeight = Math.max(
            MIN_RECTANGLE_SIZE,
            Math.abs(snappedPointer.y - fixedY),
        );
        const aspectRatio = rectangle.width / rectangle.height;
        const widthScale = rawWidth / rectangle.width;
        const heightScale = rawHeight / rectangle.height;
        const width =
            widthScale >= heightScale ? rawWidth : rawHeight * aspectRatio;
        const height = width / aspectRatio;

        left = movesWest ? fixedX - width : fixedX;
        right = movesEast ? fixedX + width : fixedX;
        top = movesNorth ? fixedY - height : fixedY;
        bottom = movesSouth ? fixedY + height : fixedY;
    } else {
        if (movesWest) {
            left = Math.min(snappedPointer.x, right - MIN_RECTANGLE_SIZE);
        }

        if (movesEast) {
            right = Math.max(snappedPointer.x, left + MIN_RECTANGLE_SIZE);
        }

        if (movesNorth) {
            top = Math.min(snappedPointer.y, bottom - MIN_RECTANGLE_SIZE);
        }

        if (movesSouth) {
            bottom = Math.max(snappedPointer.y, top + MIN_RECTANGLE_SIZE);
        }
    }

    return {
        ...rectangle,
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    };
}
