

export type ShapeType = "polygon" | "rectangle" | "circle" | "linestring";

export const MAX_SHAPES: Record<ShapeType, number> = {
  polygon: 10,
  rectangle: 5,
  circle: 5,
  linestring: 7
};
