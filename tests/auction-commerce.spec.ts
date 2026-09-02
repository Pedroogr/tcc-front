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

  test('shows the owner office the nominal bid history', async ({ context, page }) => {
    await setupCommonRoutes(context);
    await loginAndEnterRoom(page, auctionHouse.email);

    await expect(page.getByText('Histórico de lances')).toBeVisible();
    // Comprador A aparece no painel de vencedor e no historico; B so no historico.
    await expect(page.getByText('Comprador A').first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Comprador B' })).toBeVisible();
    await expect(page.getByText(/1\.250/).first()).toBeVisible();
  });
});
