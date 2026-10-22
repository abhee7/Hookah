export type AppState =
  | 'IDLE'
  | 'HAND_DETECTED'
  | 'PIPE_GRABBED'
  | 'PIPE_AT_MOUTH'
  | 'SIP_DETECTED'
  | 'VAPOUR';

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D extends Point2D {
  z: number;
}

export interface PinchState {
  isPinching: boolean; // Retained for backwards compatibility
  isGrabbing: boolean; // True when user forms a fist or pinch to hold rod
  isFist: boolean;
  pinchCenter: Point2D;
  distance: number;
  thumbTip: Point2D;
  indexTip: Point2D;
}

export interface MouthState {
  isOpen: boolean;
  center: Point2D;
  openRatio: number;
  width: number;
  height: number;
}

export interface PipePosition {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  angle: number;
  isHeld: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxLife: number;
  life: number;
  rotation: number;
  rotSpeed: number;
  expansionRate?: number;
  lateralBias?: number;
  kind?: 'puff' | 'ring';
}

export interface FaceAnchors {
  center: Point2D; // between the eyes
  roll: number; // head tilt in radians (screen space)
  width: number; // cheek-to-cheek width in px
  eyeLeft: Point2D; // screen-left eye
  eyeRight: Point2D; // screen-right eye
  forehead: Point2D;
  chin: Point2D;
  noseLeft: Point2D;
  noseRight: Point2D;
}
