import { describe, expect, it } from 'vitest';
import {
  clearGestureServerToken,
  gestureServerPublicStatus,
  readGestureServerSettings,
  saveGestureServerToken,
} from '@/gesture/gesture-server-settings';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe('gesture server session settings', () => {
  it('reads non-secret remote defaults and the per-tab token separately', () => {
    const storage = new MemoryStorage();
    saveGestureServerToken('runtime-secret', storage);

    const settings = readGestureServerSettings(
      {
        VITE_GESTURE_INFERENCE_MODE: 'remote',
        VITE_GESTURE_SERVER_URL: 'ws://10.8.0.1:8765/v1/pose',
      },
      storage,
    );

    expect(settings).toEqual({
      mode: 'remote',
      serverUrl: 'ws://10.8.0.1:8765/v1/pose',
      token: 'runtime-secret',
    });
  });

  it('updates and clears only the gesture token in session storage', () => {
    const storage = new MemoryStorage();

    saveGestureServerToken('  first-token  ', storage);
    expect(readGestureServerSettings({}, storage).token).toBe('first-token');
    saveGestureServerToken('second-token', storage);
    expect(readGestureServerSettings({}, storage).token).toBe('second-token');
    clearGestureServerToken(storage);
    expect(readGestureServerSettings({}, storage).token).toBe('');
  });

  it('returns public status without token or server URL', () => {
    const status = gestureServerPublicStatus({
      mode: 'remote',
      serverUrl: 'ws://private-host:8765/v1/pose',
      token: 'do-not-expose',
    });

    expect(status).toEqual({ mode: 'remote', configured: true });
    expect(JSON.stringify(status)).not.toContain('do-not-expose');
    expect(JSON.stringify(status)).not.toContain('private-host');
  });

  it('rejects an unsupported inference mode instead of silently changing engines', () => {
    expect(() =>
      readGestureServerSettings(
        { VITE_GESTURE_INFERENCE_MODE: 'automatic' },
        new MemoryStorage(),
      ),
    ).toThrow('Modo de inferência de gestos inválido.');
  });
});
