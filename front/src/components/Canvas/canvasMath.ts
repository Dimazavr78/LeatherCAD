export interface Point {
    x: number;
    y: number;
}

export interface ViewBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const INITIAL_VIEWBOX: ViewBox = {
    x: 0,
    y: 0,
    width: 1000,
    height: 700,
};

export const MIN_ZOOM = 10;
export const MAX_ZOOM = 400;

export function calculateZoomPercent(viewBox: ViewBox): number {
    return (INITIAL_VIEWBOX.width / viewBox.width) * 100;
}

export function screenToCanvasCoordinates(
    svg: SVGSVGElement,
    clientPoint: Point,
): Point | null {
    const screenMatrix = svg.getScreenCTM();

    if (!screenMatrix) {
        return null;
    }

    return new DOMPoint(clientPoint.x, clientPoint.y).matrixTransform(
        screenMatrix.inverse(),
    );
}

export function zoomViewBoxAtPoint(
    viewBox: ViewBox,
    point: Point,
    requestedZoom: number,
): ViewBox {
    const zoom = Math.min(Math.max(requestedZoom, MIN_ZOOM), MAX_ZOOM);
    const width = INITIAL_VIEWBOX.width / (zoom / 100);
    const height = INITIAL_VIEWBOX.height / (zoom / 100);
    const horizontalRatio = (point.x - viewBox.x) / viewBox.width;
    const verticalRatio = (point.y - viewBox.y) / viewBox.height;

    return {
        x: point.x - horizontalRatio * width,
        y: point.y - verticalRatio * height,
        width,
        height,
    };
}

export function panViewBox(viewBox: ViewBox, delta: Point): ViewBox {
    return {
        ...viewBox,
        x: viewBox.x - delta.x,
        y: viewBox.y - delta.y,
    };
}

export function getViewBoxCenter(viewBox: ViewBox): Point {
    return {
        x: viewBox.x + viewBox.width / 2,
        y: viewBox.y + viewBox.height / 2,
    };
}
