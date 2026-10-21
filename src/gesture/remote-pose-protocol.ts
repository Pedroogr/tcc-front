import type { PersonPose } from './pose-types';

export const POSE_PROTOCOL_VERSION = 1;

export type RemoteModelMetadata = {
  name: string;
  sha256: string;
  inputSize: number;
};

export type RemoteDeviceMetadata = {
  type: string;
  name: string;
};

export type RemotePoseTimings = {
  decodeMs: number;
  preprocessMs: number;
  inferenceMs: number;
  postprocessMs: number;
  totalMs: number;
};

export type PoseServerMessage =
  | {
      type: 'ready';
      protocolVersion: 1;
      model: RemoteModelMetadata;
      device: RemoteDeviceMetadata;
    }
  | {
      type: 'pose';
      protocolVersion: 1;
      frameId: number;
      modelVersion: string;
      timings: RemotePoseTimings;
      poses: PersonPose[];
    }
  | {
      type: 'error';
      protocolVersion: 1;
      frameId?: number;
      code: string;
      message: string;
    };

const INVALID_MESSAGE = 'Mensagem inválida do servidor de gestos.';

function invalid(): never {
  throw new Error(INVALID_MESSAGE);
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) invalid();
  return value;
}

function finiteNumber(value: unknown, minimum = Number.NEGATIVE_INFINITY): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) invalid();
  return value;
}

function integer(value: unknown, minimum: number, maximum: number): number {
  const parsed = finiteNumber(value, minimum);
  if (!Number.isInteger(parsed) || parsed > maximum) invalid();
  return parsed;
}

function unitNumber(value: unknown): number {
  const parsed = finiteNumber(value, 0);
  if (parsed > 1) invalid();
  return parsed;
}

function parseModel(value: unknown): RemoteModelMetadata {
  const candidate = record(value);
  return {
    name: text(candidate.name),
    sha256: text(candidate.sha256),
    inputSize: integer(candidate.inputSize, 1, Number.MAX_SAFE_INTEGER),
  };
}

function parseDevice(value: unknown): RemoteDeviceMetadata {
  const candidate = record(value);
  return {
    type: text(candidate.type),
    name: text(candidate.name),
  };
}

function parseTimings(value: unknown): RemotePoseTimings {
  const candidate = record(value);
  return {
    decodeMs: finiteNumber(candidate.decodeMs, 0),
    preprocessMs: finiteNumber(candidate.preprocessMs, 0),
    inferenceMs: finiteNumber(candidate.inferenceMs, 0),
    postprocessMs: finiteNumber(candidate.postprocessMs, 0),
    totalMs: finiteNumber(candidate.totalMs, 0),
  };
}

function parsePose(value: unknown): PersonPose {
  const candidate = record(value);
  const box = record(candidate.box);
  const normalizedBox = record(candidate.normalizedBox);
  if (!Array.isArray(candidate.keypoints) || candidate.keypoints.length !== 17) invalid();

  return {
    confidence: unitNumber(candidate.confidence),
    box: {
      x1: finiteNumber(box.x1),
      y1: finiteNumber(box.y1),
      x2: finiteNumber(box.x2),
      y2: finiteNumber(box.y2),
    },
    normalizedBox: {
      x: unitNumber(normalizedBox.x),
      y: unitNumber(normalizedBox.y),
      width: unitNumber(normalizedBox.width),
      height: unitNumber(normalizedBox.height),
    },
    keypoints: candidate.keypoints.map((value) => {
      const keypoint = record(value);
      return {
        x: finiteNumber(keypoint.x),
        y: finiteNumber(keypoint.y),
        confidence: unitNumber(keypoint.confidence),
      };
    }),
  };
}

export function encodePoseFrame(frameId: number, jpeg: Uint8Array): ArrayBuffer {
  if (!Number.isSafeInteger(frameId)) {
    throw new Error('O identificador do frame precisa ser um inteiro seguro.');
  }
  const encoded = new Uint8Array(4 + jpeg.byteLength);
  new DataView(encoded.buffer).setUint32(0, frameId >>> 0, false);
  encoded.set(jpeg, 4);
  return encoded.buffer;
}

export function parsePoseServerMessage(value: unknown): PoseServerMessage {
  const candidate = record(value);
  if (candidate.protocolVersion !== POSE_PROTOCOL_VERSION) invalid();

  if (candidate.type === 'ready') {
    return {
      type: 'ready',
      protocolVersion: POSE_PROTOCOL_VERSION,
      model: parseModel(candidate.model),
      device: parseDevice(candidate.device),
    };
  }

  if (candidate.type === 'pose') {
    if (!Array.isArray(candidate.poses)) invalid();
    return {
      type: 'pose',
      protocolVersion: POSE_PROTOCOL_VERSION,
      frameId: integer(candidate.frameId, 0, 0xffff_ffff),
      modelVersion: text(candidate.modelVersion),
      timings: parseTimings(candidate.timings),
      poses: candidate.poses.map(parsePose),
    };
  }

  if (candidate.type === 'error') {
    const parsed: Extract<PoseServerMessage, { type: 'error' }> = {
      type: 'error',
      protocolVersion: POSE_PROTOCOL_VERSION,
      code: text(candidate.code),
      message: text(candidate.message),
    };
    if (candidate.frameId !== undefined) {
      parsed.frameId = integer(candidate.frameId, 0, 0xffff_ffff);
    }
    return parsed;
  }

  return invalid();
}
