export type FrameSize = {
  width: number;
  height: number;
};

export type PixelBox = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type NormalizedBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PoseKeypoint = {
  x: number;
  y: number;
  confidence: number;
};

export type PersonPose = {
  confidence: number;
  box: PixelBox;
  normalizedBox: NormalizedBox;
  keypoints: PoseKeypoint[];
};

export type RaisedHandSide = 'left' | 'right' | 'both' | null;
