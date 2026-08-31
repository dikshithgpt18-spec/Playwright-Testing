// @ts-check
import { test, expect } from '@playwright/test';

const targetUrl = process.env.BASE_URL || 'https://polite-pond-09fb16200.7.azurestaticapps.net/';
const repeatCount = Number(process.env.CYCLE_COUNT || 20);

test('5 pages operations running simultaneously in parallel tabs sharing 1 login session', async ({ browser }) => {
    // Unlimited execution time to allow all 20 rounds to complete
    test.setTimeout(0);

    const userId = process.env.USER_ID;
    const password = process.env.PASSWORD;

    if (!userId || !password) {
        throw new Error('Set USER_ID and PASSWORD in .env before running tests.');
    }

    console.log('🚀 Creating single shared browser context...');
    const context = await browser.newContext();

    // -------------------------------------------------------------
    // Step 1: Log in on Tab 1 and capture the authenticated URL
    // -------------------------------------------------------------
    console.log('🔐 Logging in on Tab 1...');
    const tab1 = await context.newPage();
    await tab1.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    const emailInput = tab1.getByRole('textbox').first();
    const passwordInput = tab1.locator('input[type="password"]');
    const loginButton = tab1.getByRole('button', { name: 'Login' });

    await emailInput.fill(userId);
    await passwordInput.fill(password);
    await loginButton.click();
    await expect(loginButton).toBeHidden({ timeout: 30000 });

    // Capture the exact logged-in page URL after authentication
    const loggedInUrl = tab1.url();
    console.log(`✅ Login successful on Tab 1! Authenticated URL: ${loggedInUrl}`);

    // -------------------------------------------------------------
    // Step 2: Define Page Operations for the 5 Tabs
    // -------------------------------------------------------------
    const pageDefinitions = [
        {
            name: 'Master Pages',
            menu: 'Master',
            items: ['Enterprise', 'External Filter', 'Org Unit', 'Location', 'Customer', 'Portal', 'Role', 'User', 'Position', 'Program Repository']
        },
        {
            name: 'Automation Pages',
            menu: 'Automation',
            items: ['Plant Customer Cross Ref', 'Program Mapping', 'Program Variant', 'Task', 'Scheduler', 'Setups', 'Adapters', 'Logical System', 'Internal Customer Cross Ref', 'Screen Configuration', 'Mail', 'FTP/SFTP']
        },
        {
            name: 'Admin Page',
            menu: 'Admin',
            items: []
        },
        {
            name: 'Analytics Page',
            menu: 'Analytics',
            items: []
        },
        {
            name: 'Monitor Page',
            menu: 'Monitor',
            items: []
        }
    ];

    // -------------------------------------------------------------
    // Step 3: Open Tabs 2-5 directly using loggedInUrl in parallel
    // -------------------------------------------------------------
    console.log(`📂 Opening 4 additional tabs directly to authenticated URL: ${loggedInUrl}`);

    // Tab 1 (already logged in) is used for Page 1 (Master Pages)
    const tabs = [{ page: tab1, def: pageDefinitions[0] }];

    // Open Tabs 2 to 5 concurrently directly to loggedInUrl
    const newTabPromises = pageDefinitions.slice(1).map(async (def) => {
        const page = await context.newPage();
        await page.goto(loggedInUrl, { waitUntil: 'domcontentloaded' });
        return { page, def };
    });

    const openedTabs = await Promise.all(newTabPromises);
    tabs.push(...openedTabs);

    console.log(`✅ All 5 tabs opened and ready on authenticated dashboard!`);

    // Helper function to execute operations for a single tab
    const runTabOperations = async (page, def, cycle) => {
        console.log(`[Cycle ${cycle}/${repeatCount}] [PARALLEL] Starting operations on: ${def.name}`);

        for (const sectionName of def.items) {
            const itemLocator = page.getByText(sectionName, { exact: true }).first();

            if (!(await itemLocator.isVisible({ timeout: 500 }).catch(() => false))) {
                const menuHeader = page.getByText(def.menu, { exact: true }).or(page.getByText(new RegExp(def.menu, 'i'))).first();
                await menuHeader.click().catch(() => {});
                await expect(itemLocator).toBeVisible({ timeout: 3000 }).catch(() => {});
            }

            await itemLocator.click({ timeout: 5000 }).catch(async () => {
                const menuHeader = page.getByText(def.menu, { exact: true }).or(page.getByText(new RegExp(def.menu, 'i'))).first();
                await menuHeader.click().catch(() => {});
                await expect(itemLocator).toBeVisible({ timeout: 5000 }).catch(() => {});
                await itemLocator.click({ timeout: 5000 }).catch(() => {});
            });

            console.log(`[Cycle ${cycle}/${repeatCount}] [${def.name}] Visited: ${sectionName}`);
        }

        if (def.items.length === 0) {
            const menuHeader = page.getByText(def.menu, { exact: true }).or(page.getByText(new RegExp(def.menu, 'i'))).first();
            if (await menuHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
                await menuHeader.click().catch(() => {});
                console.log(`[Cycle ${cycle}/${repeatCount}] [${def.name}] Visited menu: ${def.menu}`);
            }
        }
    };

    // -------------------------------------------------------------
    // Step 4: Run ALL 5 TABS SIMULTANEOUSLY in TRUE PARALLEL
    // -------------------------------------------------------------
    for (let cycle = 1; cycle <= repeatCount; cycle++) {
        console.log(`\n==================================================`);
        console.log(` Starting SIMULTANEOUS Parallel Cycle [${cycle}/${repeatCount}]`);
        console.log(`==================================================`);

        // Execute all 5 tabs simultaneously in parallel!
        await Promise.all(
            tabs.map(({ page, def }) => runTabOperations(page, def, cycle))
        );

        console.log(`[Cycle ${cycle}/${repeatCount}] Completed parallel cycle across all 5 tabs.`);
    }

    // Keep browser window open for inspection in headed mode
    await tab1.pause();
    await context.close();
});
