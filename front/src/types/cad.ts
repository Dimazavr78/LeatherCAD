export type CadObjectType = 'rectangle';

export interface RectangleObject {
    id: string;
    type: 'rectangle';
    x: number;
    y: number;
    width: number;
    height: number;
}

export type CadObject = RectangleObject;

export type Tool = 'select' | 'rectangle';
