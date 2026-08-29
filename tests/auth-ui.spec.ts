import { test, expect } from '@playwright/test';

test.describe('authentication UI', () => {
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
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha invalidos');
  });
});
