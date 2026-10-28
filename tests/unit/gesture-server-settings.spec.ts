import { describe, expect, it } from 'vitest';
import {
  clearGestureServerToken,
  gestureServerPublicStatus,
  readGestureServerSettings,
  resolveGestureServerUrl,
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
  it.each([
    ['https:', 'demo.trycloudflare.com', 'wss://demo.trycloudflare.com/v1/pose'],
    ['http:', 'localhost:5173', 'ws://localhost:5173/v1/pose'],
  ])(
    'resolves a relative pose endpoint for %s',
    (protocol, host, expected) => {
      expect(resolveGestureServerUrl('/v1/pose', { protocol, host })).toBe(
        expected,
      );
    },
  );

  it('keeps an absolute LAN WebSocket URL unchanged', () => {
    expect(
      resolveGestureServerUrl('ws://192.168.15.6:8765/v1/pose', {
        protocol: 'https:',
        host: 'demo.trycloudflare.com',
      }),
    ).toBe('ws://192.168.15.6:8765/v1/pose');
  });

  it('rejects a non-absolute endpoint without a leading slash', () => {
    expect(() =>
      resolveGestureServerUrl('v1/pose', {
        protocol: 'https:',
        host: 'demo.trycloudflare.com',
      }),
    ).toThrow('URL');
  });

  it('reads non-secret remote defaults and the per-tab token separately', () => {
    const storage = new MemoryStorage();
    saveGestureServerToken('runtime-secret', storage);

    const settings = readGestureServerSettings(
      {
        VITE_GESTURE_INFERENCE_MODE: 'remote',
        VITE_GESTURE_SERVER_URL: 'ws://10.8.0.1:8765/v1/pose',
      },
      storage,
      { protocol: 'http:', host: 'localhost:5173' },
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
