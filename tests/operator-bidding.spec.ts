import {
  expect,
  test,
  type BrowserContext,
  type WebSocketRoute,
} from '@playwright/test';

const TS = '2026-09-22T12:00:00.000Z';

const operatorAccess = {
  id: 'operator-access-1',
  auctionId: 'auction-1',
  label: 'Pista principal',
  expiresAt: '2026-09-23T12:00:00.000Z',
};

const lotTwo = {
  id: 'lot-2',
  code: '2',
  title: 'Lote 2',
  status: 'IN_AUCTION',
  currentPrice: '1000',
  nextMinimumBid: '1100',
};

const lotThree = {
  ...lotTwo,
  id: 'lot-3',
  code: '3',
  title: 'Lote 3',
  currentPrice: '1800',
  nextMinimumBid: '1900',
};

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function session(currentLot: typeof lotTwo | null = lotTwo) {
  return { type: 'OPERATOR', operatorAccess, currentLot };
}

async function setupOperatorSocket(context: BrowserContext) {
  let commerceSocket: WebSocketRoute | null = null;
  let resolveAuctionJoin!: () => void;
  const auctionJoined = new Promise<void>((resolve) => {
    resolveAuctionJoin = resolve;
  });

  await context.routeWebSocket(/\/socket\.io\//, (webSocket) => {
    webSocket.onMessage((message) => {
      const frame = String(message);

      if (frame.startsWith('40')) {
        webSocket.send('40{"sid":"operator-test-socket"}');
      } else if (frame.startsWith('42') && frame.includes('"auction:join"')) {
        commerceSocket = webSocket;
        resolveAuctionJoin();
      } else if (frame === '2') {
        webSocket.send('3');
      }
    });
    webSocket.send(
      '0{"sid":"operator-test-engine","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}',
    );
  });

  return async (event: string, payload: unknown) => {
    await auctionJoined;
    commerceSocket?.send(`42${JSON.stringify([event, payload])}`);
  };
}

async function storeOperatorToken(context: BrowserContext) {
  await context.addInitScript(() => {
    sessionStorage.setItem('cattleAuctionOperatorToken', 'operator-token');
  });
}

test.describe('operator bidding', () => {
  test('uses a separate temporary-code login without replacing the regular session', async ({
    context,
    page,
  }) => {
    let receivedCode: string | undefined;

    await context.addInitScript(() => {
      sessionStorage.setItem('cattleAuctionToken', 'buyer-token');
    });
    await setupOperatorSocket(context);
    await context.route('http://localhost:3000/operator/login', async (route) => {
      receivedCode = (route.request().postDataJSON() as { code?: string }).code;
      await route.fulfill(
        json({
          accessToken: 'operator-token',
          actorType: 'OPERATOR',
          operatorAccess,
        }),
      );
    });
    await context.route('http://localhost:3000/operator/session', (route) =>
      route.fulfill(json(session())),
    );

    await page.goto('/operator');
    await page.getByLabel('Código temporário').fill('abcd ef12 3456');
    await expect(page.getByLabel('Código temporário')).toHaveValue('ABCD-EF12-3456');
    await page.getByRole('button', { name: 'Entrar como operador' }).click();

    await expect(page.getByRole('heading', { name: 'Lote 2' })).toBeVisible();
    expect(receivedCode).toBe('ABCDEF123456');
    await expect
      .poll(() =>
        page.evaluate(() => ({
          regular: sessionStorage.getItem('cattleAuctionToken'),
          operator: sessionStorage.getItem('cattleAuctionOperatorToken'),
        })),
      )
      .toEqual({ regular: 'buyer-token', operator: 'operator-token' });
  });

  test('shows only privacy-safe buyer data and confirms an on-site bid', async ({
    context,
    page,
  }) => {
    let receivedBid: unknown;
    let activeLot = lotTwo;

    await page.setViewportSize({ width: 390, height: 844 });
    await storeOperatorToken(context);
    await setupOperatorSocket(context);
    await context.route('http://localhost:3000/operator/session', (route) =>
      route.fulfill(json(session(activeLot))),
    );
    await context.route(/http:\/\/localhost:3000\/operator\/buyers\?.*/, (route) =>
      route.fulfill(
        json([{ id: 'buyer-1', name: 'Maria Silva', documentLast4: '1234' }]),
      ),
    );
    await context.route('http://localhost:3000/operator/bids', async (route) => {
      receivedBid = route.request().postDataJSON();
      activeLot = {
        ...activeLot,
        currentPrice: '1200',
        nextMinimumBid: '1300',
      };
      await route.fulfill(
        json({ id: 'bid-1', amount: '1200', source: 'ON_SITE', createdAt: TS }),
      );
    });

    await page.goto('/operator');
    await expect(page.getByRole('heading', { name: 'Lote 2' })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      )
      .toBe(true);
    await expect(page.getByText(/R\$\s*1\.000/)).toBeVisible();
    await expect(page.locator('video')).toHaveCount(0);
    await expect(page.getByText(/transmissão/i)).toHaveCount(0);

    await page.getByLabel('Buscar comprador').fill('Maria');
    await page.getByRole('button', { name: 'Maria Silva · final 1234' }).click();
    await page.getByLabel('Valor do lance').fill('1200');
    await page.getByRole('button', { name: 'Revisar lance' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Lote 2');
    await expect(dialog).toContainText('Maria Silva');
    await expect(dialog).toContainText(/R\$\s*1\.200/);
    await dialog.getByRole('button', { name: 'Confirmar lance' }).click();

    await expect(page.getByText('Lance registrado com sucesso.')).toBeVisible();
    await expect(page.getByLabel('Buscar comprador')).toHaveValue('');
    await expect(page.getByLabel('Valor do lance')).toHaveValue('');
    await expect(page.getByText(/R\$\s*1\.200/)).toBeVisible();
    expect(receivedBid).toEqual({
      expectedLotId: 'lot-2',
      buyerId: 'buyer-1',
      amount: 1200,
    });
    await expect(page.getByText(/email|telefone|inscrição estadual/i)).toHaveCount(0);
  });

  test('switches to the authoritative lot, clears stale input and blocks while offline', async ({
    context,
    page,
  }) => {
    let activeLot = lotTwo;
    let bidPosts = 0;

    await storeOperatorToken(context);
    const emitOperatorEvent = await setupOperatorSocket(context);
    await context.route('http://localhost:3000/operator/session', (route) =>
      route.fulfill(json(session(activeLot))),
    );
    await context.route(/http:\/\/localhost:3000\/operator\/buyers\?.*/, (route) =>
      route.fulfill(
        json([{ id: 'buyer-1', name: 'Maria Silva', documentLast4: '1234' }]),
      ),
    );
    await context.route('http://localhost:3000/operator/bids', (route) => {
      bidPosts += 1;
      return route.fulfill(json({ id: 'bid-1' }));
    });

    await page.goto('/operator');
    await expect(page.getByRole('heading', { name: 'Lote 2' })).toBeVisible();
    await page.getByLabel('Buscar comprador').fill('Maria');
    await page.getByRole('button', { name: 'Maria Silva · final 1234' }).click();
    await page.getByLabel('Valor do lance').fill('1200');

    activeLot = lotThree;
    await emitOperatorEvent('lot:stage-changed', {
      auctionId: 'auction-1',
      lot: lotThree,
    });

    await expect(page.getByRole('heading', { name: 'Lote 3' })).toBeVisible();
    await expect(page.getByLabel('Buscar comprador')).toHaveValue('');
    await expect(page.getByLabel('Valor do lance')).toHaveValue('');

    await page.getByLabel('Buscar comprador').fill('Maria');
    await page.getByRole('button', { name: 'Maria Silva · final 1234' }).click();
    await page.getByLabel('Valor do lance').fill('2000');
    await context.setOffline(true);
    await expect(page.getByText('Sem conexão')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Revisar lance' })).toBeDisabled();
    expect(bidPosts).toBe(0);
  });

  test('recovers a missed lot event through polling', async ({ context, page }) => {
    let activeLot = lotTwo;
    let sessionRequests = 0;

    await storeOperatorToken(context);
    await setupOperatorSocket(context);
    await context.route('http://localhost:3000/operator/session', (route) => {
      sessionRequests += 1;
      return route.fulfill(json(session(activeLot)));
    });

    await page.goto('/operator');
    await expect(page.getByRole('heading', { name: 'Lote 2' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Sincronizado');
    await page.waitForTimeout(100);
    const requestsBeforeMissedEvent = sessionRequests;
    activeLot = lotThree;

    await expect(page.getByRole('heading', { name: 'Lote 3' })).toBeVisible({
      timeout: 7_000,
    });
    expect(sessionRequests).toBeGreaterThan(requestsBeforeMissedEvent);
  });

  test('refreshes and explains when the reviewed lot became stale', async ({
    context,
    page,
  }) => {
    let activeLot = lotTwo;

    await storeOperatorToken(context);
    await setupOperatorSocket(context);
    await context.route('http://localhost:3000/operator/session', (route) =>
      route.fulfill(json(session(activeLot))),
    );
    await context.route(/http:\/\/localhost:3000\/operator\/buyers\?.*/, (route) =>
      route.fulfill(
        json([{ id: 'buyer-1', name: 'Maria Silva', documentLast4: '1234' }]),
      ),
    );
    await context.route('http://localhost:3000/operator/bids', async (route) => {
      activeLot = lotThree;
      await route.fulfill(
        json({ message: 'O lote em pista mudou. Atualize antes de lancar.' }, 409),
      );
    });

    await page.goto('/operator');
    await expect(page.getByRole('heading', { name: 'Lote 2' })).toBeVisible();
    await page.getByLabel('Buscar comprador').fill('Maria');
    await page.getByRole('button', { name: 'Maria Silva · final 1234' }).click();
    await page.getByLabel('Valor do lance').fill('1200');
    await page.getByRole('button', { name: 'Revisar lance' }).click();
    await page.getByRole('button', { name: 'Confirmar lance' }).click();

    await expect(page.getByRole('heading', { name: 'Lote 3' })).toBeVisible();
    await expect(
      page.getByText('O lote em pista mudou. Confira o lote atual antes de lançar.'),
    ).toBeVisible();
    await expect(page.getByLabel('Buscar comprador')).toHaveValue('');
    await expect(page.getByLabel('Valor do lance')).toHaveValue('');
  });
});
