import { Feature, Polygon } from "geojson";
import * as turf from "@turf/turf";
export const isFullyInside = (
  newPoly: Feature<Polygon>,
  existingPoly: Feature<Polygon>
): boolean => {
  try {
    return (
      turf.booleanContains(existingPoly, newPoly) ||
      turf.booleanContains(newPoly, existingPoly)
    );
  } catch {
    return false;
  }
};
export const hasIntersection = (
  poly1: Feature<Polygon>,
  poly2: Feature<Polygon>
): boolean => {
  try {
    return turf.booleanIntersects(poly1, poly2);
  } catch {
    return false;
  }
};
export const trimPolygon = (
  newPoly: Feature<Polygon>,
  existingPoly: Feature<Polygon>
): Feature<Polygon> | null => {
  try {
  
    const intersection = turf.intersect(
      turf.featureCollection([newPoly, existingPoly])
    );

    if (!intersection) return newPoly;

 
    if (turf.area(intersection) < 1) return newPoly;

    const diff = turf.difference(
      turf.featureCollection([newPoly, existingPoly])
    ) as Feature<Polygon> | null;
    if (!diff) return null;
    if (turf.area(diff) < 1) return null;

    return diff;
  } catch (error) {
    console.warn("trimPolygon failed:", error);
    return null;
  }
};
