import { describe, expect, it, vi } from 'vitest';
import {
  createPoseEstimator,
  poseBackendLabel,
} from '@/gesture/pose-estimator-factory';
import type { PoseEstimatorPort } from '@/gesture/pose-estimator';

const localEstimator = { kind: 'local' } as unknown as PoseEstimatorPort;
const remoteEstimator = { kind: 'remote' } as unknown as PoseEstimatorPort;

describe('pose estimator factory', () => {
  it('creates the explicitly selected local estimator', () => {
    const createLocal = vi.fn(() => localEstimator);
    const createRemote = vi.fn(() => remoteEstimator);

    expect(
      createPoseEstimator(
        { mode: 'local', serverUrl: '', token: '' },
        { createLocal, createRemote },
      ),
    ).toBe(localEstimator);
    expect(createLocal).toHaveBeenCalledOnce();
    expect(createRemote).not.toHaveBeenCalled();
  });

  it('creates the remote estimator only with complete runtime credentials', () => {
    const createRemote = vi.fn(() => remoteEstimator);

    expect(
      createPoseEstimator(
        {
          mode: 'remote',
          serverUrl: 'ws://10.8.0.1:8765/v1/pose',
          token: 'runtime-secret',
        },
        { createLocal: () => localEstimator, createRemote },
      ),
    ).toBe(remoteEstimator);
    expect(createRemote).toHaveBeenCalledWith({
      url: 'ws://10.8.0.1:8765/v1/pose',
      token: 'runtime-secret',
    });
  });

  it.each([
    [{ mode: 'remote' as const, serverUrl: '', token: 'token' }, 'URL'],
    [
      {
        mode: 'remote' as const,
        serverUrl: 'ws://10.8.0.1:8765/v1/pose',
        token: '',
      },
      'token',
    ],
  ])('rejects incomplete remote settings', (settings, missingField) => {
    expect(() =>
      createPoseEstimator(settings, {
        createLocal: () => localEstimator,
        createRemote: () => remoteEstimator,
      }),
    ).toThrow(`Configure ${missingField}`);
  });

  it.each([
    ['remote-cuda' as const, 'GPU remota'],
    ['webgpu' as const, 'GPU local'],
    ['wasm' as const, 'CPU local'],
  ])('labels the %s backend', (backend, label) => {
    expect(poseBackendLabel(backend)).toBe(label);
  });
});
