import { expect, test } from '@playwright/test';

const TS = '2026-09-22T12:00:00.000Z';

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

test('the owner office creates, dismisses, lists, and revokes operator access', async ({
  context,
  page,
}) => {
  const office = {
    id: 'house-1',
    name: 'Escritório Teste',
    email: 'office@example.test',
    status: 'ACTIVE',
    mustChangePassword: false,
    createdAt: TS,
    updatedAt: TS,
  };
  const auction = {
    id: 'auction-1',
    title: 'Remate Teste',
    status: 'LIVE',
    auctionHouseId: office.id,
    auctionHouse: { id: office.id, name: office.name },
    scheduledAt: null,
    createdAt: TS,
    updatedAt: TS,
  };
  let accesses: Array<Record<string, unknown>> = [];

  await context.route('**/auth/login', (route) =>
    route.fulfill(
      json({
        accessToken: 'office-token',
        actorType: 'AUCTION_HOUSE',
        auctionHouse: office,
      }),
    ),
  );
  await context.route('**/auctions/public', (route) =>
    route.fulfill(json([auction])),
  );
  await context.route('**/auctions', (route) => route.fulfill(json([auction])));
  await context.route('**/auctions/*/stream', (route) =>
    route.fulfill(json({}, 404)),
  );
  await context.route('**/lots', (route) => route.fulfill(json([])));
  await context.route('**/lots/*/bids', (route) => route.fulfill(json([])));
  await context.route('**/me/buyer-registrations', (route) =>
    route.fulfill(json([])),
  );
  await context.route('**/operator/accesses**', async (route) => {
    const method = route.request().method();

    if (method === 'POST') {
      const body = route.request().postDataJSON() as { label: string };
      const summary = {
        id: 'access-1',
        auctionId: auction.id,
        label: body.label,
        expiresAt: '2026-09-23T12:00:00.000Z',
        usedAt: null,
        revokedAt: null,
        createdAt: TS,
      };
      accesses = [summary];
      return route.fulfill(
        json({ ...summary, code: 'ABCD-1234-EF56' }, 201),
      );
    }

    if (method === 'DELETE') {
      accesses = accesses.map((access) => ({
        ...access,
        revokedAt: '2026-09-22T13:00:00.000Z',
      }));
      return route.fulfill(json(accesses[0]));
    }

    return route.fulfill(json(accesses));
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByLabel('E-mail').fill(office.email);
  await page.getByLabel('Senha').fill('office-password');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page
    .getByRole('button', { name: 'Entrar no remate', exact: true })
    .click();

  await expect(page.getByRole('heading', { name: 'Acessos de pisteiro' })).toBeVisible();
  await page.getByLabel('Identificação do acesso').fill('Pista principal');
  await page.getByRole('button', { name: 'Gerar código' }).click();
  await expect(page.getByText('ABCD-1234-EF56')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copiar código' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar código' }).click();
  await expect(page.getByText('ABCD-1234-EF56')).toHaveCount(0);
  await expect(page.getByText('Pista principal')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('codeHash');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Revogar Pista principal' }).click();
  await expect(page.getByText('Revogado')).toBeVisible();
});
