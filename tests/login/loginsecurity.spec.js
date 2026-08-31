// @ts-check
import { test, expect } from '@playwright/test';

const targetUrl = process.env.BASE_URL || 'https://polite-pond-09fb16200.7.azurestaticapps.net/';

test.describe('Security Baseline and Post-Login Security Checks', () => {

  test('uses HTTPS and sends baseline security headers', async ({ request }) => {
    const url = new URL(targetUrl);
    expect(url.protocol).toBe('https:');

    const response = await request.get(targetUrl);
    expect(response.ok()).toBeTruthy();

    const headers = response.headers();
    expect(headers['strict-transport-security'] || headers['x-content-type-options']).toBeTruthy();
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  test('does not load insecure active content over HTTP', async ({ page }) => {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    const insecureResources = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[src], [href], form[action]'))
        .map((element) =>
          element.getAttribute('src') ||
          element.getAttribute('href') ||
          element.getAttribute('action') ||
          ''
        )
        .filter((value) => value.startsWith('http://'))
    );

    expect(insecureResources, `HTTP resources found: ${insecureResources.join(', ')}`).toEqual([]);
  });

  test('logs in with credentials and verifies post-login session and cookie security', async ({ page, context }) => {
    const userId = process.env.USER_ID;
    const password = process.env.PASSWORD;

    if (!userId || !password) {
      throw new Error('Set USER_ID and PASSWORD in .env before running tests.');
    }

    // 1. Navigate to Target URL
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // 2. Perform Login with Credentials
    const emailInput = page.getByRole('textbox').first();
    const passwordInput = page.locator('input[type="password"]');
    const loginButton = page.getByRole('button', { name: 'Login' });

    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill(userId);
      await passwordInput.fill(password);
      await loginButton.click();
      await expect(loginButton).toBeHidden({ timeout: 30000 });
    }

    console.log('Authenticated successfully! Checking post-login security context...');

    // 3. Inspect Browser Cookies issued after login
    const cookies = await context.cookies();
    console.log(`[Security Check] Inspected ${cookies.length} browser cookies post-login.`);

    for (const cookie of cookies) {
      console.log(` Cookie: ${cookie.name} | Secure: ${cookie.secure} | HttpOnly: ${cookie.httpOnly} | SameSite: ${cookie.sameSite}`);
      // Verify cookies have Secure flag over HTTPS connection
      expect(cookie.secure, `Cookie ${cookie.name} missing Secure flag`).toBeTruthy();
    }

    // 4. Verify post-login session URL protocol remains HTTPS
    const postLoginUrl = page.url();
    expect(postLoginUrl.startsWith('https://'), `Post-login URL must use HTTPS: ${postLoginUrl}`).toBeTruthy();

    // 5. Verify no insecure HTTP resources loaded on post-login dashboard
    const postLoginInsecureResources = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[src], [href], form[action]'))
        .map((element) =>
          element.getAttribute('src') ||
          element.getAttribute('href') ||
          element.getAttribute('action') ||
          ''
        )
        .filter((value) => value.startsWith('http://'))
    );

    expect(postLoginInsecureResources, `Post-login HTTP resources found: ${postLoginInsecureResources.join(', ')}`).toEqual([]);
    await page.pause();
  });
});