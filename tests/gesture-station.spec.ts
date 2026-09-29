import { expect, test, type BrowserContext } from '@playwright/test';

const auction = {
  id: 'auction-1',
  title: 'Remate Primavera',
  status: 'LIVE',
  mode: 'PRESENTIAL',
  auctionHouseId: 'house-1',
  auctionHouse: { id: 'house-1', name: 'Escritório Pampa' },
};

async function installStationBrowserFakes(context: BrowserContext) {
  await context.addInitScript(() => {
    const stats = {
      cameraRequests: [] as MediaStreamConstraints[],
      stoppedTracks: 0,
      workersCreated: 0,
      workersTerminated: 0,
    };
    Object.assign(window, { stationStats: stats });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: async () => [
          { deviceId: 'camera-1', kind: 'videoinput', label: 'Câmera principal', groupId: '' },
          { deviceId: 'camera-2', kind: 'videoinput', label: 'Câmera lateral', groupId: '' },
        ],
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          stats.cameraRequests.push(constraints);
          const canvas = document.createElement('canvas');
          canvas.width = 1280;
          canvas.height = 720;
          const stream = canvas.captureStream(10);
          for (const track of stream.getTracks()) {
            const stop = track.stop.bind(track);
            track.stop = () => {
              stats.stoppedTracks += 1;
              stop();
            };
          }
          return stream;
        },
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: async () => undefined,
    });
    Object.assign(window, {
      createImageBitmap: async () => ({ width: 1280, height: 720, close: () => undefined }),
    });

    class FakeWorker {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      onerror: ((event: { message: string }) => void) | null = null;

      constructor() {
        stats.workersCreated += 1;
      }

      postMessage(message: { type: string; requestId?: string; sampledAtMs?: number }) {
        if (message.type === 'init') {
          queueMicrotask(() => this.onmessage?.({ data: { type: 'ready', backend: 'webgpu' } }));
        }
        if (message.type === 'detect') {
          queueMicrotask(() =>
            this.onmessage?.({
              data: {
                type: 'result',
                requestId: message.requestId,
                sampledAtMs: message.sampledAtMs,
                inferenceMs: 5,
                poses: [],
              },
            }),
          );
        }
      }

      terminate() {
        stats.workersTerminated += 1;
      }
    }
    Object.assign(window, { Worker: FakeWorker });
  });
}

test('blocks a direct buyer route before requesting the camera', async ({ context, page }) => {
  await installStationBrowserFakes(context);
  await context.addInitScript(() => {
    sessionStorage.setItem('cattleAuctionToken', 'buyer-token');
    sessionStorage.setItem('cattleAuctionActorType', 'USER');
  });

  await page.goto('/gesture-station/auction-1');

  await expect(page.getByText('Acesso exclusivo do escritório')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { stationStats: { cameraRequests: unknown[] } })
            .stationStats.cameraRequests.length,
      ),
    )
    .toBe(0);
});

test('starts, changes, and stops a dedicated camera without demo controls', async ({
  context,
  page,
}) => {
  await installStationBrowserFakes(context);
  await context.addInitScript(() => {
    sessionStorage.setItem('cattleAuctionToken', 'house-token');
    sessionStorage.setItem('cattleAuctionActorType', 'AUCTION_HOUSE');
    sessionStorage.setItem(
      'cattleAuctionHouse',
      JSON.stringify({ id: 'house-1', name: 'Escritório Pampa' }),
    );
  });
  await page.route('http://localhost:3000/auctions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([auction]),
    }),
  );

  await page.goto('/gesture-station/auction-1');
  await expect(page.getByRole('heading', { name: 'Remate Primavera' })).toBeVisible();
  await page.getByLabel('Câmera dedicada').selectOption('camera-2');
  await page.getByRole('button', { name: 'Iniciar reconhecimento' }).click();
  await expect(page.getByText('GPU local')).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as {
            stationStats: { cameraRequests: MediaStreamConstraints[] };
          }).stationStats.cameraRequests[0],
      ),
    )
    .toMatchObject({ video: { deviceId: { exact: 'camera-2' } } });

  await page.getByLabel('Câmera dedicada').selectOption('camera-1');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { stationStats: { cameraRequests: unknown[] } })
            .stationStats.cameraRequests.length,
      ),
    )
    .toBe(2);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { stationStats: { stoppedTracks: number } }).stationStats
            .stoppedTracks,
      ),
    )
    .toBeGreaterThanOrEqual(1);

  await page.getByRole('button', { name: 'Parar reconhecimento' }).click();
  await expect(page.getByRole('button', { name: 'Iniciar reconhecimento' })).toBeVisible();
  expect(await page.getByRole('button', { name: /demo|simular|disparar/i }).count()).toBe(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as {
            stationStats: { stoppedTracks: number; workersTerminated: number };
          }).stationStats,
      ),
    )
    .toMatchObject({ stoppedTracks: 2, workersTerminated: 2 });
});
