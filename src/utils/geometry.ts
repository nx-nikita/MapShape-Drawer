import * as turf from "@turf/turf";
import { Feature, Geometry } from "geojson";

export const applyPolygonRules = (
  newFeature: Feature<Geometry>,
  existing: Feature<Geometry>[]
): Feature<Geometry> | null => {
  for (const old of existing) {
    if (!old.geometry) continue;

    if (
      turf.booleanContains(newFeature, old) ||
      turf.booleanContains(old, newFeature)
    ) {
      return null;
    }

    if (turf.booleanIntersects(newFeature, old)) {
      return null;
    }
  }

  return newFeature;
};

export const hasOverlap = (
  newFeature: Feature<Geometry>,
  features: Feature<Geometry>[]
): boolean => {
  for (const f of features) {
    if (
      f.geometry.type !== "LineString" &&
      newFeature.geometry.type !== "LineString"
    ) {
      if (turf.booleanIntersects(newFeature, f)) {
        return true;
      }
    }
  }

  return false;
};
