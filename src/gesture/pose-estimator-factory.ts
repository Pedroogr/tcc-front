import {
  PoseEstimator,
  type PoseBackend,
  type PoseEstimatorPort,
} from './pose-estimator';
import { RemotePoseEstimator } from './remote-pose-estimator';
import type { GestureServerSettings } from './gesture-server-settings';

type PoseEstimatorFactories = {
  createLocal: () => PoseEstimatorPort;
  createRemote: (config: { url: string; token: string }) => PoseEstimatorPort;
};

const defaultFactories: PoseEstimatorFactories = {
  createLocal: () => new PoseEstimator(),
  createRemote: (config) => new RemotePoseEstimator(config),
};

export function createPoseEstimator(
  settings: GestureServerSettings,
  factories: PoseEstimatorFactories = defaultFactories,
): PoseEstimatorPort {
  if (settings.mode === 'local') return factories.createLocal();
  if (!settings.serverUrl) throw new Error('Configure URL do servidor de gestos.');
  if (!settings.token) throw new Error('Configure token do servidor de gestos.');
  return factories.createRemote({ url: settings.serverUrl, token: settings.token });
}

export function poseBackendLabel(backend: PoseBackend | null) {
  if (backend === 'remote-cuda') return 'GPU remota';
  if (backend === 'webgpu') return 'GPU local';
  if (backend === 'wasm') return 'CPU local';
  return '—';
}
