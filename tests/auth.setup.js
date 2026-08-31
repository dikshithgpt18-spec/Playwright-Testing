// @ts-check
import { test as setup, expect } from '@playwright/test';

const targetUrl = process.env.BASE_URL || 'https://polite-pond-09fb16200.7.azurestaticapps.net/';
const authFile = 'playwright/.auth/user.json';

setup('authenticate once', async ({ page }) => {
  const userId = process.env.USER_ID;
  const password = process.env.PASSWORD;

  if (!userId || !password) {
    throw new Error('Set USER_ID and PASSWORD before running authenticated tests.');
  }

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  const emailInput = page.getByRole('textbox').first();
  const passwordInput = page.locator('input[type="password"]');
  const loginButton = page.getByRole('button', { name: 'Login' });

  await emailInput.fill(userId);
  await passwordInput.fill(password);
  await loginButton.click();
  await expect(loginButton).toBeHidden();

  await page.context().storageState({ path: authFile });
});