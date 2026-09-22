import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const TS = '2026-09-02T12:00:00.000Z';

const buyer = {
  id: 'buyer-1',
  name: 'Comprador Vencedor',
  email: 'comprador@example.test',
  phone: '11999999999',
  document: null,
  platformRole: 'USER',
  status: 'ACTIVE',
  buyerProfile: { id: 'bp-1' },
  sellerProfile: null,
  createdAt: TS,
  updatedAt: TS,
};

const seller = {
  id: 'seller-1',
  name: 'Vendedor Teste',
  email: 'vendedor@example.test',
  phone: '11888888888',
  document: null,
  platformRole: 'USER',
  status: 'ACTIVE',
  buyerProfile: null,
  sellerProfile: {
    id: 'sp-1',
    userId: 'seller-1',
    farmName: 'Fazenda Teste',
    verificationStatus: 'APPROVED',
    createdAt: TS,
    updatedAt: TS,
  },
  createdAt: TS,
  updatedAt: TS,
};

const auctionHouse = {
  id: 'house-1',
  name: 'Escritorio Teste',
  email: 'office@example.test',
  phone: '1140000000',
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

const buyerContact = {
  id: 'buyer-1',
  name: 'Comprador Vencedor',
  email: 'comprador@example.test',
  phone: '11999999999',
};
const sellerContact = {
  id: 'seller-1',
  name: 'Vendedor Teste',
  email: 'vendedor@example.test',
  phone: '11888888888',
};

const base = {
  id: 'sale-1',
  lotId: 'lot-1',
  lotCode: 'L-01',
  lotTitle: 'Lote Vendido',
  auctionId: 'auction-1',
  auctionTitle: 'Remate Teste',
  finalPrice: '1250',
  soldAt: TS,
  status: 'CONFIRMED',
  notes: null,
};

const officeSale = {
  ...base,
  buyer: buyerContact,
  seller: sellerContact,
  responsible: { kind: 'SELLER', ...sellerContact },
};
const winnerSale = { ...base, responsible: { kind: 'SELLER', ...sellerContact } };
const sellerSale = { ...base, buyer: buyerContact };

function json(body: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) };
}

async function setupRoutes(context: BrowserContext) {
  await context.route('**/auth/login', (route) => {
    const body = route.request().postDataJSON() as { email: string };
    let response: unknown;
    if (body.email === buyer.email) {
      response = { accessToken: 'buyer-token', actorType: 'USER', user: buyer };
    } else if (body.email === seller.email) {
      response = { accessToken: 'seller-token', actorType: 'USER', user: seller };
    } else {
      response = { accessToken: 'office-token', actorType: 'AUCTION_HOUSE', auctionHouse };
    }
    return route.fulfill(json(response));
  });
  await context.route('**/auctions/public', (route) => route.fulfill(json([])));
  await context.route('**/auctions', (route) => route.fulfill(json([])));
  await context.route('**/lots', (route) => route.fulfill(json([])));
  await context.route('**/sales/me', (route) => route.fulfill(json([winnerSale])));
  await context.route('**/sales/sold', (route) => route.fulfill(json([sellerSale])));
  await context.route('**/sales', (route) => route.fulfill(json([officeSale])));
}

async function login(page: Page, email: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('any-password');
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function openMenuItem(page: Page, account: string, item: string) {
  await page.getByRole('button', { name: new RegExp(account) }).first().click();
  await page.getByRole('menuitem', { name: item }).click();
}

test.describe('post-auction contacts', () => {
  test('winning buyer sees the responsible seller, never another buyer', async ({
    context,
    page,
  }) => {
    await setupRoutes(context);
    await login(page, buyer.email);
    await openMenuItem(page, 'Comprador Vencedor', 'Meus arremates');

    await expect(page.getByText('Vendedor Teste')).toBeVisible();
    await expect(page.getByText('vendedor@example.test')).toBeVisible();
    // O comprador nunca ve o contato de outro comprador.
    await expect(page.getByText('comprador@example.test')).toHaveCount(0);
  });

  test('seller sees the winning buyer via "Minhas vendas"', async ({ context, page }) => {
    await setupRoutes(context);
    await login(page, seller.email);
    await openMenuItem(page, 'Vendedor Teste', 'Minhas vendas');

    await expect(page.getByText('Comprador Vencedor')).toBeVisible();
    await expect(page.getByText('comprador@example.test')).toBeVisible();
  });

  test('office sees both buyer and seller contacts', async ({ context, page }) => {
    await setupRoutes(context);
    await login(page, auctionHouse.email);
    await openMenuItem(page, 'Escritorio Teste', 'Vendas / Arremates');

    await expect(page.getByText('Vendedor Teste')).toBeVisible();
    await expect(page.getByText('Comprador Vencedor')).toBeVisible();
    await expect(page.getByText('vendedor@example.test')).toBeVisible();
    await expect(page.getByText('comprador@example.test')).toBeVisible();
  });

  test('a non-seller buyer has no "Minhas vendas" entry', async ({ context, page }) => {
    await setupRoutes(context);
    await login(page, buyer.email);
    await page.getByRole('button', { name: /Comprador Vencedor/ }).first().click();

    await expect(page.getByRole('menuitem', { name: 'Meus arremates' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Minhas vendas' })).toHaveCount(0);
  });
});
