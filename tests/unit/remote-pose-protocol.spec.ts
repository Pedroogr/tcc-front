import { describe, expect, it } from 'vitest';
import {
  encodePoseFrame,
  parsePoseServerMessage,
} from '@/gesture/remote-pose-protocol';

const model = {
  name: 'yolo11s-pose',
  sha256: '1060bda4',
  inputSize: 640,
};

const device = {
  type: 'cuda',
  name: 'NVIDIA GeForce RTX 3070 Ti',
};

const timings = {
  decodeMs: 1,
  preprocessMs: 2,
  inferenceMs: 18,
  postprocessMs: 3,
  totalMs: 24,
};

const keypoints = Array.from({ length: 17 }, (_, index) => ({
  x: index + 0.25,
  y: index + 0.5,
  confidence: 0.9,
}));

describe('remote pose protocol', () => {
  it('encodes a uint32 big-endian frame ID followed by the exact JPEG bytes', () => {
    const encoded = new Uint8Array(
      encodePoseFrame(0x01020304, new Uint8Array([0xff, 0xd8, 0xaa, 0xff, 0xd9])),
    );

    expect([...encoded]).toEqual([1, 2, 3, 4, 0xff, 0xd8, 0xaa, 0xff, 0xd9]);
  });

  it('wraps frame IDs modulo uint32', () => {
    const encoded = new Uint8Array(
      encodePoseFrame(0x1_0000_0001, new Uint8Array([0xff, 0xd8])),
    );

    expect([...encoded.slice(0, 4)]).toEqual([0, 0, 0, 1]);
  });

  it('validates ready, pose and recoverable error messages', () => {
    expect(
      parsePoseServerMessage({
        type: 'ready',
        protocolVersion: 1,
        model,
        device,
      }),
    ).toEqual({ type: 'ready', protocolVersion: 1, model, device });

    expect(
      parsePoseServerMessage({
        type: 'pose',
        protocolVersion: 1,
        frameId: 42,
        modelVersion: 'yolo11s-pose:1060bda4',
        timings,
        poses: [
          {
            confidence: 0.95,
            box: { x1: 10, y1: 20, x2: 110, y2: 220 },
            normalizedBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
            keypoints,
          },
        ],
      }),
    ).toEqual({
      type: 'pose',
      protocolVersion: 1,
      frameId: 42,
      modelVersion: 'yolo11s-pose:1060bda4',
      timings,
      poses: [
        {
          confidence: 0.95,
          box: { x1: 10, y1: 20, x2: 110, y2: 220 },
          normalizedBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
          keypoints,
        },
      ],
    });

    expect(
      parsePoseServerMessage({
        type: 'error',
        protocolVersion: 1,
        frameId: 42,
        code: 'invalid_jpeg',
        message: 'JPEG inválido.',
      }),
    ).toEqual({
      type: 'error',
      protocolVersion: 1,
      frameId: 42,
      code: 'invalid_jpeg',
      message: 'JPEG inválido.',
    });
  });

  it.each([
    ['non-object', 'not-json'],
    [
      'unsupported protocol',
      { type: 'ready', protocolVersion: 2, model, device },
    ],
    [
      'missing ready field',
      { type: 'ready', protocolVersion: 1, model },
    ],
    [
      'invalid pose frame ID',
      {
        type: 'pose',
        protocolVersion: 1,
        frameId: -1,
        modelVersion: 'model',
        timings,
        poses: [],
      },
    ],
    [
      'invalid pose keypoint count',
      {
        type: 'pose',
        protocolVersion: 1,
        frameId: 1,
        modelVersion: 'model',
        timings,
        poses: [
          {
            confidence: 0.9,
            box: { x1: 0, y1: 0, x2: 1, y2: 1 },
            normalizedBox: { x: 0, y: 0, width: 1, height: 1 },
            keypoints: [],
          },
        ],
      },
    ],
    [
      'missing error code',
      { type: 'error', protocolVersion: 1, message: 'failed' },
    ],
  ])('rejects %s', (_caseName, payload) => {
    expect(() => parsePoseServerMessage(payload)).toThrow('Mensagem inválida do servidor de gestos.');
  });
});
