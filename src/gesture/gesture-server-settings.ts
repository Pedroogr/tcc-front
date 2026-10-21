export type GestureInferenceMode = 'local' | 'remote';

export type GestureServerSettings = {
  mode: GestureInferenceMode;
  serverUrl: string;
  token: string;
};

export type GestureServerEnvironment = {
  VITE_GESTURE_INFERENCE_MODE?: string;
  VITE_GESTURE_SERVER_URL?: string;
};

type SessionStoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const TOKEN_KEY = 'cattleAuctionGestureServerToken';

function defaultStorage(): SessionStoragePort {
  return sessionStorage;
}

function defaultEnvironment(): GestureServerEnvironment {
  return {
    VITE_GESTURE_INFERENCE_MODE: import.meta.env.VITE_GESTURE_INFERENCE_MODE,
    VITE_GESTURE_SERVER_URL: import.meta.env.VITE_GESTURE_SERVER_URL,
  };
}

export function readGestureServerSettings(
  environment: GestureServerEnvironment = defaultEnvironment(),
  storage: SessionStoragePort = defaultStorage(),
): GestureServerSettings {
  const rawMode = environment.VITE_GESTURE_INFERENCE_MODE?.trim() || 'local';
  if (rawMode !== 'local' && rawMode !== 'remote') {
    throw new Error('Modo de inferência de gestos inválido.');
  }
  return {
    mode: rawMode,
    serverUrl: environment.VITE_GESTURE_SERVER_URL?.trim() ?? '',
    token: storage.getItem(TOKEN_KEY)?.trim() ?? '',
  };
}

export function saveGestureServerToken(
  token: string,
  storage: SessionStoragePort = defaultStorage(),
) {
  const normalized = token.trim();
  if (!normalized) {
    storage.removeItem(TOKEN_KEY);
    return;
  }
  storage.setItem(TOKEN_KEY, normalized);
}

export function clearGestureServerToken(
  storage: SessionStoragePort = defaultStorage(),
) {
  storage.removeItem(TOKEN_KEY);
}

export function gestureServerPublicStatus(settings: GestureServerSettings) {
  return {
    mode: settings.mode,
    configured:
      settings.mode === 'local' || Boolean(settings.serverUrl && settings.token),
  };
}
