export const ZOOM_MAX = 6.0;
export const ZOOM_MIN = 0.1;
export const ZOOM_STEP = 0.25;
export const ZOOM_INITIAL = 1.0;
export const ZOOM_WHEEL_STEP = 0.1;
export const GRID_SIZE = 3000;
export const GRID_GAP_MIN = 10;
export const GRID_GAP_MAX = 50;

// TODO: need to check the default central area ratio
export const DEFAULT_CENTRAL_AREA_RATIO = 0.3;

export enum ShapeStyle {
  General = 'General',
  Scribbled = 'Scribbled',
}

export interface IModelCoord {
  x: number;
  y: number;
}

export enum TextResizing {
  AUTO_WIDTH,
  AUTO_HEIGHT,
}
