import { Feature, Polygon } from "geojson";
import * as turf from "@turf/turf";

/* --------------------------------------------------
   STEP 1: FULL ENCLOSURE CHECK (INTERVIEW MUST)
   - new polygon existing ke andar ho
   - ya existing polygon new ke andar ho
-------------------------------------------------- */
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

/* --------------------------------------------------
   STEP 2: SAFE INTERSECTION CHECK
-------------------------------------------------- */
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

/* --------------------------------------------------
   STEP 3: AUTO-TRIM PARTIAL OVERLAP ONLY
   ✔ Partial overlap → trim
   ❌ Full overlap → null
   ❌ Tiny sliver → ignore
-------------------------------------------------- */
export const trimPolygon = (
  newPoly: Feature<Polygon>,
  existingPoly: Feature<Polygon>
): Feature<Polygon> | null => {
  try {
    /* ---- A. INTERSECTION (Turf v6 way) ---- */
    const intersection = turf.intersect(
      turf.featureCollection([newPoly, existingPoly])
    );

    // No overlap → return original
    if (!intersection) return newPoly;

    // Ignore very tiny touch
    if (turf.area(intersection) < 1) return newPoly;

    /* ---- B. DIFFERENCE (Turf v6 way) ---- */
    const diff = turf.difference(
      turf.featureCollection([newPoly, existingPoly])
    ) as Feature<Polygon> | null;

    // Fully eaten → reject
    if (!diff) return null;

    // Very small polygon → reject
    if (turf.area(diff) < 1) return null;

    return diff;
  } catch (error) {
    console.warn("trimPolygon failed:", error);
    return null;
  }
};
