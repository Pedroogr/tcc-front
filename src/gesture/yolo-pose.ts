import { MIN_PERSON_CONFIDENCE } from './pose-rules';
import type { FrameSize, PersonPose, PixelBox, PoseKeypoint } from './pose-types';

export const YOLO_POSE_CHANNELS = 56;
export const YOLO_POSE_KEYPOINTS = 17;
export const YOLO_NMS_IOU_THRESHOLD = 0.45;
export const YOLO_MAX_PEOPLE = 100;

export type LetterboxTransform = {
  inputWidth: number;
  inputHeight: number;
  scale: number;
  padX: number;
  padY: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function sourceX(value: number, source: FrameSize, transform: LetterboxTransform) {
  return clamp((value - transform.padX) / transform.scale, 0, source.width);
}

function sourceY(value: number, source: FrameSize, transform: LetterboxTransform) {
  return clamp((value - transform.padY) / transform.scale, 0, source.height);
}

function boxIou(left: PixelBox, right: PixelBox) {
  const overlapWidth = Math.max(0, Math.min(left.x2, right.x2) - Math.max(left.x1, right.x1));
  const overlapHeight = Math.max(0, Math.min(left.y2, right.y2) - Math.max(left.y1, right.y1));
  const intersection = overlapWidth * overlapHeight;
  if (intersection === 0) return 0;

  const leftArea = Math.max(0, left.x2 - left.x1) * Math.max(0, left.y2 - left.y1);
  const rightArea = Math.max(0, right.x2 - right.x1) * Math.max(0, right.y2 - right.y1);
  return intersection / (leftArea + rightArea - intersection);
}

function validInputs(
  output: Float32Array,
  candidateCount: number,
  source: FrameSize,
  transform: LetterboxTransform,
) {
  return (
    Number.isInteger(candidateCount) &&
    candidateCount > 0 &&
    output.length === YOLO_POSE_CHANNELS * candidateCount &&
    source.width > 0 &&
    source.height > 0 &&
    transform.inputWidth > 0 &&
    transform.inputHeight > 0 &&
    transform.scale > 0
  );
}

function value(output: Float32Array, candidateCount: number, channel: number, index: number) {
  return output[channel * candidateCount + index];
}

function decodeCandidate(
  output: Float32Array,
  candidateCount: number,
  index: number,
  source: FrameSize,
  transform: LetterboxTransform,
): PersonPose {
  const centerX = value(output, candidateCount, 0, index);
  const centerY = value(output, candidateCount, 1, index);
  const width = value(output, candidateCount, 2, index);
  const height = value(output, candidateCount, 3, index);
  const x1 = sourceX(centerX - width / 2, source, transform);
  const y1 = sourceY(centerY - height / 2, source, transform);
  const x2 = sourceX(centerX + width / 2, source, transform);
  const y2 = sourceY(centerY + height / 2, source, transform);
  const keypoints: PoseKeypoint[] = [];

  for (let keypoint = 0; keypoint < YOLO_POSE_KEYPOINTS; keypoint += 1) {
    const channel = 5 + keypoint * 3;
    keypoints.push({
      x: sourceX(value(output, candidateCount, channel, index), source, transform),
      y: sourceY(value(output, candidateCount, channel + 1, index), source, transform),
      confidence: value(output, candidateCount, channel + 2, index),
    });
  }

  return {
    confidence: value(output, candidateCount, 4, index),
    box: { x1, y1, x2, y2 },
    normalizedBox: {
      x: x1 / source.width,
      y: y1 / source.height,
      width: (x2 - x1) / source.width,
      height: (y2 - y1) / source.height,
    },
    keypoints,
  };
}

export function decodeYoloPose(
  output: Float32Array,
  candidateCount: number,
  source: FrameSize,
  transform: LetterboxTransform,
) {
  if (!validInputs(output, candidateCount, source, transform)) {
    throw new Error('Saída YOLO Pose inválida.');
  }

  const candidates: PersonPose[] = [];
  for (let index = 0; index < candidateCount; index += 1) {
    const confidence = value(output, candidateCount, 4, index);
    if (Number.isFinite(confidence) && confidence >= MIN_PERSON_CONFIDENCE) {
      const candidate = decodeCandidate(output, candidateCount, index, source, transform);
      if (candidate.box.x2 > candidate.box.x1 && candidate.box.y2 > candidate.box.y1) {
        candidates.push(candidate);
      }
    }
  }

  candidates.sort((left, right) => right.confidence - left.confidence);
  const selected: PersonPose[] = [];
  for (const candidate of candidates) {
    if (selected.every((person) => boxIou(person.box, candidate.box) <= YOLO_NMS_IOU_THRESHOLD)) {
      selected.push(candidate);
      if (selected.length === YOLO_MAX_PEOPLE) break;
    }
  }
  return selected;
}
