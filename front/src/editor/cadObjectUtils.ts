import type { CadObject } from '../types/cad';

export function cloneCadObject(object: CadObject): CadObject {
    return { ...object };
}

export function translateCadObject(
    object: CadObject,
    deltaX: number,
    deltaY: number,
): CadObject {
    return {
        ...object,
        x: object.x + deltaX,
        y: object.y + deltaY,
    };
}

export function cloneCadObjectWithOffset(
    object: CadObject,
    offset: number,
): CadObject {
    return {
        ...translateCadObject(object, offset, offset),
        id: crypto.randomUUID(),
    };
}
