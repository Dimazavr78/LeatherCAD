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

export interface GridSpacing {
    minor: number;
    major: number;
}

export const INITIAL_VIEWBOX: ViewBox = {
    x: -500,
    y: -350,
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
    const height = viewBox.height * (width / viewBox.width);
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

export function getGridSpacing(zoom: number): GridSpacing {
    if (zoom < 25) {
        return { minor: 100, major: 500 };
    }

    if (zoom < 50) {
        return { minor: 50, major: 250 };
    }

    if (zoom <= 100) {
        return { minor: 10, major: 50 };
    }

    if (zoom < 200) {
        return { minor: 5, major: 25 };
    }

    if (zoom < 400) {
        return { minor: 2, major: 10 };
    }

    return { minor: 1, major: 5 };
}

export function snapToGrid(value: number, gridSize: number): number {
    return Math.round(value / gridSize) * gridSize;
}

export function getVisibleTicks(
    start: number,
    end: number,
    spacing: number,
    limit = 100,
): number[] {
    const firstTick = Math.ceil(start / spacing) * spacing;
    const ticks: number[] = [];

    for (let tick = firstTick; tick <= end && ticks.length < limit; tick += spacing) {
        ticks.push(Object.is(tick, -0) ? 0 : tick);
    }

    return ticks;
}
