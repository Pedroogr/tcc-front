import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitGestureEvent } from '@/api/gestureApi';

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock('@/api/http', () => ({ apiRequest }));

describe('submitGestureEvent', () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it('sends the exact multipart relay contract through the authenticated client', async () => {
    const response = {
      eventId: '4da148c7-0b3f-4cd9-b14d-e99581fd880f',
      expiresAt: '2026-09-29T18:00:05.000Z',
    };
    const snapshot = new Blob(['jpeg-bytes'], { type: 'image/jpeg' });
    apiRequest.mockResolvedValue(response);

    await expect(
      submitGestureEvent('auction/with space', {
        eventId: response.eventId,
        capturedAt: '2026-09-29T18:00:00.000Z',
        personBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
        snapshot,
      }),
    ).resolves.toEqual(response);

    expect(apiRequest).toHaveBeenCalledOnce();
    const [path, options] = apiRequest.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/auctions/auction%2Fwith%20space/gesture-events');
    expect(options.method).toBe('POST');
    expect(options.headers).toBeUndefined();
    expect(options.body).toBeInstanceOf(FormData);
    const body = options.body as FormData;
    expect(body.get('eventId')).toBe(response.eventId);
    expect(body.get('capturedAt')).toBe('2026-09-29T18:00:00.000Z');
    expect(body.get('personBox')).toBe(
      JSON.stringify({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 }),
    );
    const uploadedSnapshot = body.get('snapshot');
    expect(uploadedSnapshot).toBeInstanceOf(File);
    expect((uploadedSnapshot as File).type).toBe('image/jpeg');
    expect((uploadedSnapshot as File).size).toBe(snapshot.size);
  });

  it('propagates a network failure without retrying stale snapshots', async () => {
    apiRequest.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      submitGestureEvent('auction-1', {
        eventId: '4da148c7-0b3f-4cd9-b14d-e99581fd880f',
        capturedAt: '2026-09-29T18:00:00.000Z',
        personBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
        snapshot: new Blob(['jpeg'], { type: 'image/jpeg' }),
      }),
    ).rejects.toThrow('Failed to fetch');

    expect(apiRequest).toHaveBeenCalledOnce();
  });
});
