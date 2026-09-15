import { test, expect, type BrowserContext } from '@playwright/test';

const TS = '2026-09-02T12:00:00.000Z';

const buyer = {
  id: 'buyer-1',
  name: 'Comprador Teste',
  email: 'buyer@example.test',
  phone: null,
  document: null,
  platformRole: 'USER',
  status: 'ACTIVE',
  buyerProfile: { id: 'buyer-profile-1' },
  sellerProfile: null,
  createdAt: TS,
  updatedAt: TS,
};

const auctionHouse = {
  id: 'house-1',
  name: 'Escritorio Teste',
  email: 'office@example.test',
  phone: null,
  document: null,
  city: null,
  state: null,
  country: 'BR',
  logoUrl: null,
  status: 'ACTIVE',
  mustChangePassword: false,
  createdAt: TS,
  updatedAt: TS,
};

const auction = {
  id: 'auction-1',
  title: 'Remate Teste',
  description: 'Remate de teste',
  status: 'LIVE',
  auctionHouseId: 'house-1',
  auctionHouse: { id: 'house-1', name: 'Escritorio Teste' },
  scheduledAt: null,
  thumbnailUrl: null,
  createdAt: TS,
  updatedAt: TS,
};

// currentPrice e o preco publico anonimo. O array `bids` (com um nome sigiloso)
// e deliberadamente incluido no fixture para provar que a UI NUNCA o renderiza.
const inPistaLot = {
  id: 'lot-1',
  code: 'L-01',
  title: 'Lote em Pista',
  status: 'IN_AUCTION',
  quantity: 1,
  initialPrice: '1000',
  currentPrice: '1250',
  auctionId: 'auction-1',
  media: [],
  createdAt: TS,
  bids: [{ id: 'b1', amount: '1250', status: 'WINNING', bidder: { id: 'x', name: 'Comprador Sigiloso' } }],
};

const newlyCreatedLot = {
  id: 'lot-2',
  code: 'L-02',
  title: 'Lote adicionado ao vivo',
  status: 'DRAFT',
  quantity: 1,
  initialPrice: '1800',
  currentPrice: '1800',
  auctionId: 'auction-1',
  media: [],
  createdAt: '2026-09-02T12:01:00.000Z',
};

const officeHistory = [
  {
    id: 'b1',
    lotId: 'lot-1',
    amount: '1250',
    status: 'WINNING',
    createdAt: TS,
    bidder: { id: 'buyer-a', name: 'Comprador A' },
  },
  {
    id: 'b2',
    lotId: 'lot-1',
    amount: '1000',
    status: 'OUTBID',
    createdAt: TS,
    bidder: { id: 'buyer-b', name: 'Comprador B' },
  },
];

function json(body: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) };
}

async function setupCommonRoutes(context: BrowserContext) {
  await context.route('**/auth/login', (route) => {
    const body = route.request().postDataJSON() as { email: string };
    const response =
      body.email === buyer.email
        ? { accessToken: 'buyer-token', actorType: 'USER', user: buyer }
        : { accessToken: 'office-token', actorType: 'AUCTION_HOUSE', auctionHouse };
    return route.fulfill(json(response));
  });
  await context.route('**/auctions/public', (route) => route.fulfill(json([auction])));
  await context.route('**/auctions', (route) => route.fulfill(json([auction])));
  await context.route('**/auctions/*/stream', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
  );
  await context.route('**/lots', (route) => route.fulfill(json([inPistaLot])));
  await context.route('**/buyer-registrations/me', (route) =>
    route.fulfill(
      json({
        id: 'reg-1',
        status: 'APPROVED',
        buyerId: buyer.id,
        auctionHouseId: auctionHouse.id,
        createdAt: TS,
        updatedAt: TS,
      }),
    ),
  );
  await context.route('**/me/buyer-registrations', (route) => route.fulfill(json([])));
  await context.route('**/lots/*/bids', (route) => route.fulfill(json(officeHistory)));
}

async function loginAndEnterRoom(
  page: import('@playwright/test').Page,
  email: string,
) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('any-password');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('button', { name: 'Entrar no remate' }).first().click();
}

test.describe('auction room commerce', () => {
  test('shows the buyer only the anonymous current price, never history or names', async ({
    context,
    page,
  }) => {
    await setupCommonRoutes(context);
    await loginAndEnterRoom(page, buyer.email);

    // Preco atual visivel em tempo real.
    await expect(page.getByText(/1\.250/).first()).toBeVisible();

    // Nunca o nome de quem lancou nem qualquer historico.
    await expect(page.getByText('Comprador Sigiloso')).toHaveCount(0);
    await expect(page.getByText('Histórico de lances')).toHaveCount(0);
  });

  test('shows a lot created while the buyer is already in the auction room', async ({
    context,
    page,
  }) => {
    let lotRequests = 0;

    await setupCommonRoutes(context);
    await context.unroute('**/lots');
    await context.route('**/lots', (route) => {
      lotRequests += 1;
      return route.fulfill(
        json(lotRequests >= 3 ? [newlyCreatedLot, inPistaLot] : [inPistaLot]),
      );
    });
    await loginAndEnterRoom(page, buyer.email);

    await expect(page.getByText('Lote adicionado ao vivo')).toHaveCount(0);
    await expect.poll(() => lotRequests, { timeout: 7_000 }).toBeGreaterThanOrEqual(3);
    await expect(page.getByText('Lote adicionado ao vivo')).toBeVisible();
  });

  test('shows the owner office the nominal bid history', async ({ context, page }) => {
    await setupCommonRoutes(context);
    await loginAndEnterRoom(page, auctionHouse.email);

    await expect(page.getByText('Histórico de lances')).toBeVisible();
    // Comprador A aparece no painel de vencedor e no historico; B so no historico.
    await expect(page.getByText('Comprador A').first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Comprador B' })).toBeVisible();
    await expect(page.getByText(/1\.250/).first()).toBeVisible();
  });

  test('recovers a winning bid from the backend when the realtime event is missed', async ({
    context,
    page,
  }) => {
    let bidHistoryRequests = 0;

    await setupCommonRoutes(context);
    await context.unroute('**/lots/*/bids');
    await context.route('**/lots/*/bids', (route) => {
      bidHistoryRequests += 1;
      return route.fulfill(json(bidHistoryRequests >= 3 ? officeHistory : []));
    });
    await context.route('**/sales', (route) =>
      route.fulfill(
        json({
          id: 'sale-1',
          lotId: inPistaLot.id,
          lotCode: inPistaLot.code,
          finalPrice: '1250',
          buyer: { id: buyer.id, name: 'Comprador A', email: buyer.email },
        }),
      ),
    );
    await loginAndEnterRoom(page, auctionHouse.email);

    const hammer = page.getByRole('button', { name: /Bater o martelo/ });
    await expect.poll(() => bidHistoryRequests).toBeGreaterThanOrEqual(1);
    await expect(hammer).toBeDisabled();

    await expect.poll(() => bidHistoryRequests, { timeout: 7_000 }).toBeGreaterThanOrEqual(3);
    await expect(hammer).toBeEnabled({ timeout: 7_000 });
    await expect(page.getByText('Comprador A').first()).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await hammer.click();
    await expect(page.getByText(/Lote L-01 vendido por/)).toBeVisible();
  });

  test('keeps the winning bid available during a temporary history refresh failure', async ({
    context,
    page,
  }) => {
    let failRefresh = false;

    await setupCommonRoutes(context);
    await context.unroute('**/lots/*/bids');
    await context.route('**/lots/*/bids', (route) =>
      failRefresh
        ? route.fulfill({ status: 503, body: 'temporarily unavailable' })
        : route.fulfill(json(officeHistory)),
    );
    await loginAndEnterRoom(page, auctionHouse.email);

    const hammer = page.getByRole('button', { name: /Bater o martelo/ });
    await expect(hammer).toBeEnabled();

    const failedRefresh = page.waitForResponse(
      (response) => response.url().includes('/bids') && response.status() === 503,
    );
    failRefresh = true;
    await failedRefresh;
    await page.waitForTimeout(100);

    await expect(hammer).toBeEnabled();
    await expect(page.getByText('Comprador A').first()).toBeVisible();
  });

  test('does not overlap slow bid history refreshes', async ({ context, page }) => {
    let activeRequests = 0;
    let maximumActiveRequests = 0;

    await setupCommonRoutes(context);
    await context.unroute('**/lots/*/bids');
    await context.route('**/lots/*/bids', async (route) => {
      activeRequests += 1;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      await route.fulfill(json(officeHistory));
      activeRequests -= 1;
    });
    await loginAndEnterRoom(page, auctionHouse.email);

    await expect(page.getByRole('button', { name: /Bater o martelo/ })).toBeEnabled({
      timeout: 8_000,
    });
    expect(maximumActiveRequests).toBe(1);
  });
});
