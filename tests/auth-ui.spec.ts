import { test, expect } from '@playwright/test';

test.describe('authentication UI', () => {
  test('keeps buyer and auction house sessions isolated between tabs', async ({
    context,
    page,
  }) => {
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
      createdAt: '2026-09-02T12:00:00.000Z',
      updatedAt: '2026-09-02T12:00:00.000Z',
    };
    const auctionHouse = {
      id: 'auction-house-1',
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
      createdAt: '2026-09-02T12:00:00.000Z',
      updatedAt: '2026-09-02T12:00:00.000Z',
    };

    await context.route('http://localhost:3000/auctions**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await context.route('http://localhost:3000/lots', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await context.route('http://localhost:3000/auth/login', async (route) => {
      const body = route.request().postDataJSON() as { email: string };
      const response = body.email === buyer.email
        ? { accessToken: 'buyer-token', actorType: 'USER', user: buyer }
        : {
            accessToken: 'auction-house-token',
            actorType: 'AUCTION_HOUSE',
            auctionHouse,
          };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    await page.goto('/');
    const officePage = await context.newPage();
    await officePage.goto('/');

    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByLabel('E-mail').fill(buyer.email);
    await page.getByLabel('Senha').fill('buyer-password');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('button', { name: /Comprador Teste/ })).toBeVisible();

    await officePage.getByRole('button', { name: 'Login' }).click();
    await officePage.getByLabel('E-mail').fill(auctionHouse.email);
    await officePage.getByLabel('Senha').fill('office-password');
    await officePage.getByRole('button', { name: 'Entrar' }).click();
    await expect(
      officePage.getByRole('button', { name: /Escritorio Teste/ }),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /Comprador Teste/ })).toBeVisible();

    await officePage.reload();
    await expect(
      officePage.getByRole('button', { name: /Escritorio Teste/ }),
    ).toBeVisible();
  });

  test('switches between registration and login modes', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Crie sua conta' })).toBeVisible();
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible();
    await expect(page.getByLabel('Nome completo')).toHaveCount(0);
    await page.getByRole('button', { name: 'Cadastro' }).click();
    await expect(page.getByLabel('Nome completo')).toBeVisible();
  });

  test('shows form validation for incomplete registration', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Criar conta e entrar' }).click();
    await expect(page.locator('input:invalid').first()).toBeVisible();
  });

  test('switches buyer and seller registration profiles', async ({ page }) => {
    await page.goto('/');
    const buyer = page.getByRole('button', { name: 'Comprador' });
    const seller = page.getByRole('button', { name: 'Vendedor' });
    await expect(buyer).toHaveAttribute('aria-pressed', 'true');
    await seller.click();
    await expect(seller).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Dados do vendedor')).toBeVisible();
  });

  test('shows the API error when login is rejected', async ({ page }) => {
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'E-mail ou senha invalidos' }) });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByLabel('E-mail').fill('wrong@example.test');
    await page.getByLabel('Senha').fill('wrong-password');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha inválidos.');
  });
});
