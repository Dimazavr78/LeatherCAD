import type { CadObject } from "../types/cad";

export function dependsOnObject(object: CadObject, sourceId: string): boolean {
  if (object.type === "stitch") return object.sourceObjectId === sourceId;
  if (object.type === "dimension")
    return (
      object.referenceA.objectId === sourceId ||
      object.referenceB?.objectId === sourceId
    );
  return false;
}
