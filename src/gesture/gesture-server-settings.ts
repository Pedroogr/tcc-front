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
type GestureServerLocation = Pick<Location, 'protocol' | 'host'>;

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

function defaultLocation(): GestureServerLocation {
  return window.location;
}

export function resolveGestureServerUrl(
  rawUrl: string,
  location: GestureServerLocation,
) {
  const normalized = rawUrl.trim();
  if (/^wss?:\/\//i.test(normalized)) return normalized;
  if (!normalized.startsWith('/')) {
    throw new Error('A URL do servidor de gestos precisa ser absoluta ou iniciar com /.');
  }
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}${normalized}`;
}

export function readGestureServerSettings(
  environment: GestureServerEnvironment = defaultEnvironment(),
  storage: SessionStoragePort = defaultStorage(),
  location: GestureServerLocation = defaultLocation(),
): GestureServerSettings {
  const rawMode = environment.VITE_GESTURE_INFERENCE_MODE?.trim() || 'local';
  if (rawMode !== 'local' && rawMode !== 'remote') {
    throw new Error('Modo de inferência de gestos inválido.');
  }
  const rawServerUrl = environment.VITE_GESTURE_SERVER_URL?.trim() ?? '';
  return {
    mode: rawMode,
    serverUrl: rawServerUrl
      ? resolveGestureServerUrl(rawServerUrl, location)
      : '',
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
