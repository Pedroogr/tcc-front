import type {
  PersonPose,
  PoseKeypoint,
  RaisedHandSide,
} from './pose-types';

export const MIN_KEYPOINT_CONFIDENCE = 0.35;
export const MIN_PERSON_CONFIDENCE = 0.25;
export const RAISE_MARGIN = 15;
export const MIN_BOX_WIDTH = 45;
export const MIN_BOX_HEIGHT = 90;
export const MAX_ELBOW_BELOW_SHOULDER = 80;

const NOSE = 0;
const LEFT_EYE = 1;
const RIGHT_EYE = 2;
const LEFT_EAR = 3;
const RIGHT_EAR = 4;
const LEFT_SHOULDER = 5;
const RIGHT_SHOULDER = 6;
const LEFT_ELBOW = 7;
const RIGHT_ELBOW = 8;
const LEFT_WRIST = 9;
const RIGHT_WRIST = 10;
const LEFT_HIP = 11;
const RIGHT_HIP = 12;

function isReliable(point: PoseKeypoint | undefined) {
  return Boolean(point && point.confidence >= MIN_KEYPOINT_CONFIDENCE);
}

export function isValidPerson(person: PersonPose) {
  const width = person.box.x2 - person.box.x1;
  const height = person.box.y2 - person.box.y1;
  if (width < MIN_BOX_WIDTH || height < MIN_BOX_HEIGHT) {
    return false;
  }

  const { keypoints } = person;
  const leftShoulder = isReliable(keypoints[LEFT_SHOULDER]);
  const rightShoulder = isReliable(keypoints[RIGHT_SHOULDER]);
  if (!leftShoulder && !rightShoulder) {
    return false;
  }

  const hasHead = [NOSE, LEFT_EYE, RIGHT_EYE, LEFT_EAR, RIGHT_EAR].some(
    (index) => isReliable(keypoints[index]),
  );
  if (hasHead || (leftShoulder && rightShoulder)) {
    return true;
  }

  const reliableCount = keypoints.filter(isReliable).length;
  const hasHip = isReliable(keypoints[LEFT_HIP]) || isReliable(keypoints[RIGHT_HIP]);
  return (hasHip && reliableCount >= 4) || reliableCount >= 6;
}

function isSideRaised(
  keypoints: PoseKeypoint[],
  shoulderIndex: number,
  elbowIndex: number,
  wristIndex: number,
) {
  const shoulder = keypoints[shoulderIndex];
  const elbow = keypoints[elbowIndex];
  const wrist = keypoints[wristIndex];
  if (!isReliable(shoulder) || !isReliable(wrist)) {
    return false;
  }
  if (wrist.y >= shoulder.y - RAISE_MARGIN) {
    return false;
  }
  return !isReliable(elbow) || elbow.y < shoulder.y + MAX_ELBOW_BELOW_SHOULDER;
}

export function getRaisedHandSide(person: PersonPose): RaisedHandSide {
  const left = isSideRaised(
    person.keypoints,
    LEFT_SHOULDER,
    LEFT_ELBOW,
    LEFT_WRIST,
  );
  const right = isSideRaised(
    person.keypoints,
    RIGHT_SHOULDER,
    RIGHT_ELBOW,
    RIGHT_WRIST,
  );

  if (left && right) return 'both';
  if (left) return 'left';
  if (right) return 'right';
  return null;
}
