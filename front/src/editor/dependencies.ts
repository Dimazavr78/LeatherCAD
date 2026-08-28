import type { CadObject } from "../types/cad";

export function directlyDependsOn(
  object: CadObject,
  sourceId: string,
): boolean {
  if (object.type === "stitch") return object.sourceObjectId === sourceId;
  if (object.type === "hole")
    return (
      object.hostObjectId === sourceId ||
      object.customSourceObjectId === sourceId
    );
  if (object.type === "part") return object.contourSourceId === sourceId;
  if (object.type === "dimension")
    return (
      object.referenceA.objectId === sourceId ||
      object.referenceB?.objectId === sourceId
    );
  return false;
}

export const dependsOnObject = directlyDependsOn;

export function getDependentObjectIds(
  sourceId: string,
  objects: CadObject[],
): Set<string> {
  const result = new Set<string>();
  const visit = (id: string) => {
    for (const object of objects)
      if (!result.has(object.id) && directlyDependsOn(object, id)) {
        result.add(object.id);
        visit(object.id);
      }
  };
  visit(sourceId);
  return result;
}
