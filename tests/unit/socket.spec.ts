import { describe, expect, it } from 'vitest';
import { resolveSocketServerUrl } from '@/api/socket';

describe('Socket.IO server URL', () => {
  it('uses the browser origin when the REST API base is relative', () => {
    expect(
      resolveSocketServerUrl('/api', 'https://demo.trycloudflare.com'),
    ).toBe('https://demo.trycloudflare.com');
  });

  it('keeps the origin of an absolute API URL', () => {
    expect(
      resolveSocketServerUrl(
        'http://localhost:3000/api',
        'https://demo.trycloudflare.com',
      ),
    ).toBe('http://localhost:3000');
  });
});
