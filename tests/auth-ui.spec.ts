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

  test('rejects registration when the e-mail extension does not exist', async ({
    context,
    page,
  }) => {
    let registrationRequests = 0;
    await context.route('**/auth/register', (route) => {
      registrationRequests += 1;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: '{}',
      });
    });

    await page.goto('/');
    await page.getByLabel('Nome completo').fill('Marcelo Silva');
    await page.getByLabel('E-mail').fill('marcelo@gmai.colm');
    await page.getByLabel('Senha').fill('senha-segura');
    await page.getByLabel('Inscrição estadual').fill('110042490114');
    await page.getByLabel('UF da IE').fill('SP');
    await page.getByRole('button', { name: 'Criar conta e entrar' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Informe um e-mail com uma extensão válida.',
    );
    expect(registrationRequests).toBe(0);
  });

  test('switches buyer and seller registration profiles', async ({ page }) => {
    await page.goto('/');
    const buyer = page.getByRole('button', { name: 'Comprador' });
    const seller = page.getByRole('button', { name: 'Vendedor' });
    await expect(buyer).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Inscrição estadual')).toHaveAttribute(
      'required',
      '',
    );
    await expect(page.getByLabel('UF da IE')).toHaveAttribute('required', '');
    await seller.click();
    await expect(seller).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Dados do vendedor')).toBeVisible();
    await expect(page.getByLabel('UF da IE')).toHaveCount(0);
  });

  test('sends normalized IE only for buyer registration', async ({ context, page }) => {
    let registrationBody: Record<string, unknown> | undefined;
    const registeredUser = {
      id: 'buyer-new',
      name: 'Comprador Novo',
      email: 'novo@example.com',
      platformRole: 'USER',
      status: 'ACTIVE',
      buyerProfile: { id: 'profile-new', ie: '110042490114', ieUf: 'SP' },
      sellerProfile: null,
      createdAt: '2026-09-22T12:00:00.000Z',
      updatedAt: '2026-09-22T12:00:00.000Z',
    };
    await context.route('**/auth/register', async (route) => {
      registrationBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(registeredUser),
      });
    });
    await context.route('**/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'buyer-new-token',
          actorType: 'USER',
          user: registeredUser,
        }),
      }),
    );
    await context.route('http://localhost:3000/auctions**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await context.route('http://localhost:3000/lots', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );

    await page.goto('/');
    await page.getByLabel('Nome completo').fill('Comprador Novo');
    await page.getByLabel('E-mail').fill('novo@example.com');
    await page.getByLabel('Senha').fill('senha-segura');
    await page.getByLabel('Inscrição estadual').fill('110.042.490.114');
    await page.getByLabel('UF da IE').fill('sp');
    await expect(page.getByLabel('Inscrição estadual')).toHaveValue(
      '110.042.490.114',
    );
    await page.getByRole('button', { name: 'Criar conta e entrar' }).click();

    await expect.poll(() => registrationBody).toMatchObject({
      accountType: 'BUYER',
      buyerProfile: { ie: '110042490114', ieUf: 'SP' },
    });
  });

  test('reformats and limits the state registration when its UF changes', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByLabel('Inscrição estadual').fill('195119568');
    await page.getByLabel('UF da IE').fill('pi');
    await expect(page.getByLabel('Inscrição estadual')).toHaveValue(
      '19.511.956-8',
    );

    await page.getByLabel('Inscrição estadual').fill('295082968');
    await page.getByLabel('UF da IE').fill('to');
    await expect(page.getByLabel('Inscrição estadual')).toHaveValue(
      '29.508.296-8',
    );

    await page.reload();
    await page.getByLabel('Inscrição estadual').fill('22436587929999999');
    await page.getByLabel('UF da IE').fill('rs');

    await expect(page.getByLabel('Inscrição estadual')).toHaveValue(
      '224/3658792',
    );
  });

  test('formats and limits seller registrations using the seller UF', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Vendedor' }).click();
    const rural = page.getByLabel('Inscrição rural');
    const stateRegistration = page.getByLabel('Inscrição estadual');
    const uf = page.getByLabel('Estado', { exact: true });

    await uf.fill('rs');
    await rural.fill('22436587929999999');
    await stateRegistration.fill('2243658792');

    await expect(rural).toHaveValue('224/3658792');
    await expect(stateRegistration).toHaveValue('224/3658792');
    await expect(stateRegistration).toHaveAttribute('placeholder', '000/0000000');
    await expect(page.getByText('Inscrições de RS têm 10 dígitos.')).toBeVisible();

    await rural.fill('251040852');
    await stateRegistration.fill('251040852');
    await uf.fill('sc');

    await expect(rural).toHaveValue('251.040.852');
    await expect(stateRegistration).toHaveValue('251.040.852');
    await expect(page.getByText('Inscrições de SC têm 9 dígitos.')).toBeVisible();
  });

  test('blocks seller registration when a registration is incomplete', async ({
    context,
    page,
  }) => {
    let registrationRequests = 0;
    await context.route('**/auth/register', (route) => {
      registrationRequests += 1;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: '{}',
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Vendedor' }).click();
    await page.getByLabel('Nome completo').fill('Vendedor Novo');
    await page.getByLabel('E-mail').fill('vendedor@example.com');
    await page.getByLabel('Senha').fill('senha-segura');
    await page.getByLabel('Estado', { exact: true }).fill('sp');
    await page.getByLabel('Inscrição estadual').fill('1100424');
    await page.getByRole('button', { name: 'Criar conta e entrar' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Inscrição estadual de SP deve conter 12 dígitos.',
    );
    expect(registrationRequests).toBe(0);
  });

  test('requires the seller UF when a registration is informed', async ({
    context,
    page,
  }) => {
    let registrationRequests = 0;
    await context.route('**/auth/register', (route) => {
      registrationRequests += 1;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: '{}',
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Vendedor' }).click();
    await page.getByLabel('Nome completo').fill('Vendedor Novo');
    await page.getByLabel('E-mail').fill('vendedor@example.com');
    await page.getByLabel('Senha').fill('senha-segura');
    await page.getByLabel('Inscrição rural').fill('110042490114');
    await page.getByRole('button', { name: 'Criar conta e entrar' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Informe o estado para validar a inscrição rural.',
    );
    expect(registrationRequests).toBe(0);
  });

  test('sends only digits in seller registrations', async ({ context, page }) => {
    let registrationBody: Record<string, unknown> | undefined;
    const registeredUser = {
      id: 'seller-new',
      name: 'Vendedor Novo',
      email: 'vendedor@example.com',
      platformRole: 'USER',
      status: 'ACTIVE',
      buyerProfile: null,
      sellerProfile: {
        id: 'profile-new',
        ruralRegistration: '244112330118',
        stateRegistration: '110042490114',
        state: 'SP',
      },
      createdAt: '2026-11-08T12:00:00.000Z',
      updatedAt: '2026-11-08T12:00:00.000Z',
    };
    await context.route('**/auth/register', async (route) => {
      registrationBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(registeredUser),
      });
    });
    await context.route('**/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'seller-new-token',
          actorType: 'USER',
          user: registeredUser,
        }),
      }),
    );
    await context.route('http://localhost:3000/auctions**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await context.route('http://localhost:3000/lots', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );

    await page.goto('/');
    await page.getByRole('button', { name: 'Vendedor' }).click();
    await page.getByLabel('Nome completo').fill('Vendedor Novo');
    await page.getByLabel('E-mail').fill('vendedor@example.com');
    await page.getByLabel('Senha').fill('senha-segura');
    await page.getByLabel('Estado', { exact: true }).fill('sp');
    await page.getByLabel('Inscrição rural').fill('244112330118');
    await page.getByLabel('Inscrição estadual').fill('110042490114');
    await expect(page.getByLabel('Inscrição estadual')).toHaveValue('110.042.490.114');
    await page.getByRole('button', { name: 'Criar conta e entrar' }).click();

    await expect.poll(() => registrationBody).toMatchObject({
      accountType: 'SELLER',
      sellerProfile: {
        ruralRegistration: '244112330118',
        stateRegistration: '110042490114',
        state: 'SP',
      },
    });
  });

  test('validates registrations in the producer profile page', async ({
    context,
    page,
  }) => {
    const user = {
      id: 'user-1',
      name: 'Usuario Teste',
      email: 'usuario@example.test',
      phone: null,
      document: null,
      platformRole: 'USER',
      status: 'ACTIVE',
      buyerProfile: null,
      sellerProfile: null,
      createdAt: '2026-11-08T12:00:00.000Z',
      updatedAt: '2026-11-08T12:00:00.000Z',
    };
    let profileBody: Record<string, unknown> | undefined;
    await context.route('**/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: 'user-token', actorType: 'USER', user }),
      }),
    );
    await context.route('**/users/me/seller-profile', async (route) => {
      profileBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ...user,
          sellerProfile: { id: 'profile-1', ...profileBody },
        }),
      });
    });
    await context.route('http://localhost:3000/auctions**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await context.route('http://localhost:3000/lots', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );

    await page.goto('/');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Senha').fill('user-password');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.getByRole('button', { name: 'Cadastro de produtor' }).click();

    await page.getByLabel('Estado', { exact: true }).fill('rs');
    await expect(page.getByText('Inscrições de RS têm 10 dígitos.')).toBeVisible();
    await expect(page.getByLabel('Inscrição rural')).toHaveAttribute(
      'placeholder',
      '000/0000000',
    );

    await page.getByLabel('Inscrição estadual').fill('224365');
    await page.getByRole('button', { name: 'Salvar e solicitar lote' }).click();
    await expect(
      page.getByText('Inscrição estadual de RS deve conter 10 dígitos.'),
    ).toBeVisible();
    expect(profileBody).toBeUndefined();

    await page.getByLabel('Inscrição estadual').fill('2243658792');
    await expect(page.getByLabel('Inscrição estadual')).toHaveValue('224/3658792');
    await page.getByRole('button', { name: 'Salvar e solicitar lote' }).click();

    await expect.poll(() => profileBody).toMatchObject({
      stateRegistration: '2243658792',
      state: 'RS',
    });
  });

  test('requires municipality and UF in office invite registration', async ({
    context,
    page,
  }) => {
    await context.route('**/auction-houses/invites/invite-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          email: 'office@example.test',
          expiresAt: '2099-09-25T12:00:00.000Z',
          status: 'PENDING',
        }),
      }),
    );

    await page.goto('/cadastro-escritorio/invite-1');

    await expect(page.getByLabel('Município')).toHaveAttribute('required', '');
    await expect(page.getByLabel('UF')).toHaveAttribute('required', '');
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
