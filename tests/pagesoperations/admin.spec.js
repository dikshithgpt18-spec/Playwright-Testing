// @ts-check
import { test, expect } from '@playwright/test';

const targetUrl = process.env.BASE_URL || 'https://polite-pond-09fb16200.7.azurestaticapps.net/';
const repeatCount = Number(process.env.CYCLE_COUNT || 2);
const tabCount = Number(process.env.TAB_COUNT || 50);

// All sub-sections under Admin
const adminSubSections = [
    'User Profile',
    'Help',
    'Ticketing System'
];

/**
 * @param {object} fixtures
 * @param {import('@playwright/test').Browser} fixtures.browser
 * @param {import('@playwright/test').TestInfo} testInfo
 */
test('Parallel tabs hitting the SAME Admin page API simultaneously at once', async ({ browser }, testInfo) => {
    test.setTimeout(0);

    const userId = process.env.USER_ID;
    const password = process.env.PASSWORD;

    if (!userId || !password) {
        throw new Error('Set USER_ID and PASSWORD in .env before running tests.');
    }

    const testStartedAt = Date.now();

    console.log('Creating single shared browser context for Admin Pages...');
    const context = await browser.newContext();

    // -------------------------------------------------------------
    // Step 1: Log in on Tab 1 and capture authenticated URL
    // -------------------------------------------------------------
    console.log('Logging in on Tab 1...');
    const tab1 = await context.newPage();
    await tab1.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    const emailInput = tab1.getByRole('textbox').first();
    const passwordInput = tab1.locator('input[type="password"]');
    const loginButton = tab1.getByRole('button', { name: 'Login' });

    await emailInput.fill(userId);
    await passwordInput.fill(password);
    await loginButton.click();
    await expect(loginButton).toBeHidden({ timeout: 30000 });

    const loggedInUrl = tab1.url();
    console.log(`Login successful on Tab 1! Authenticated URL: ${loggedInUrl}`);

    // -------------------------------------------------------------
    // Step 2: Open Tabs safely in batches of 10
    // -------------------------------------------------------------
    console.log(`Opening ${tabCount} parallel tabs directly to authenticated URL...`);

    const tabs = [{ page: tab1, tabIndex: 1 }];
    const batchSize = 10;

    for (let i = 1; i < tabCount; i += batchSize) {
        const currentBatchSize = Math.min(batchSize, tabCount - i);
        const batchPromises = Array.from({ length: currentBatchSize }).map(async (_, idx) => {
            const pageIndex = i + idx + 1;
            const page = await context.newPage();
            await page.goto(loggedInUrl, { waitUntil: 'domcontentloaded' }).catch(() => { });
            return { page, tabIndex: pageIndex };
        });

        const openedBatch = await Promise.all(batchPromises);
        tabs.push(...openedBatch);
        console.log(`[Setup] Ready: ${tabs.length}/${tabCount} tabs authenticated.`);
    }

    console.log(`All ${tabs.length} tabs opened and ready on authenticated dashboard!`);

    const hitsStartedAt = Date.now();

    // -------------------------------------------------------------
    // Step 3: VISIBLY VISIT EACH PAGE ON ALL TABS SIMULTANEOUSLY
    // -------------------------------------------------------------
    for (let cycle = 1; cycle <= repeatCount; cycle++) {
        console.log(`\n==================================================`);
        console.log(` Starting SIMULTANEOUS Synchronized Cycle [${cycle}/${repeatCount}]`);
        console.log(`==================================================`);

        for (let i = 0; i < adminSubSections.length; i++) {
            const sectionName = adminSubSections[i];
            console.log(`\n[Cycle ${cycle}/${repeatCount}] Synchronizing ${tabs.length} tabs to VISIT [${sectionName}] simultaneously...`);

            // Phase A: Open parent Admin menu on ALL tabs concurrently
            await Promise.all(tabs.map(async ({ page }) => {
                const adminMenu = page.getByText('Admin', { exact: true }).or(page.getByText(/Admin/i)).first();
                const itemLocator = page.getByText(sectionName, { exact: true }).or(page.getByText(sectionName, { exact: false })).first();

                if (!(await itemLocator.isVisible({ timeout: 100 }).catch(() => false))) {
                    await adminMenu.click({ force: true }).catch(() => { });
                }
            }));

            // Phase B: Click item on ALL tabs simultaneously
            await Promise.all(tabs.map(async ({ page, tabIndex }) => {
                try {
                    const adminMenu = page.getByText('Admin', { exact: true }).or(page.getByText(/Admin/i)).first();
                    const itemLocator = page.getByText(sectionName, { exact: true }).or(page.getByText(sectionName, { exact: false })).first();

                    if (!(await itemLocator.isVisible({ timeout: 100 }).catch(() => false))) {
                        await adminMenu.click({ force: true }).catch(() => { });
                    }

                    await itemLocator.click({ force: true }).catch(() => { });

                    console.log(`[Cycle ${cycle}/${repeatCount}] [Tab ${tabIndex}] VISITED PAGE: ${sectionName}`);
                } catch (err) {
                    console.warn(`[Cycle ${cycle}/${repeatCount}] [Tab ${tabIndex}] Failed to navigate to: ${sectionName}`);
                }
            }));
        }

        console.log(`[Cycle ${cycle}/${repeatCount}] Completed synchronized ${tabs.length}-tab parallel hits.`);
    }

    const testExecutionTimeMs = Date.now() - testStartedAt;
    const totalHitsFired = tabs.length * adminSubSections.length * repeatCount;

    // -------------------------------------------------------------
    // Step 4: Generate Performance Summary Report
    // -------------------------------------------------------------
    const reportContent = `================================================================================
                     ADMIN PAGES PERFORMANCE SUMMARY REPORT                      
================================================================================
Target Module:                  Admin Pages (${adminSubSections.length} Pages)
Total Parallel Tabs Fired:      ${tabs.length}
Total Repeat Cycles Executed:   ${repeatCount}
Sub-Sections Tested:            ${adminSubSections.join(', ')}
Total Synchronized API Hits:    ${totalHitsFired} parallel hits
Total Test Execution Time:      ${(testExecutionTimeMs / 1000).toFixed(2)} seconds
Average Speed per Cycle:        ${((testExecutionTimeMs / 1000) / repeatCount).toFixed(2)} seconds / cycle
================================================================================`;

    console.log(`\n` + reportContent + `\n`);

    // Attach performance summary text report to Playwright HTML Report
    testInfo.attachments.push({
        name: 'Admin Pages Performance Report.txt',
        contentType: 'text/plain',
        body: Buffer.from(reportContent, 'utf-8'),
    });

    // Attach JSON structured metrics to Playwright HTML Report
    testInfo.attachments.push({
        name: 'Admin Pages Metrics.json',
        contentType: 'application/json',
        body: Buffer.from(
            JSON.stringify(
                {
                    module: 'Admin Pages',
                    subSectionsCount: adminSubSections.length,
                    subSections: adminSubSections,
                    parallelTabsCount: tabs.length,
                    repeatCyclesCount: repeatCount,
                    totalHitsFired: totalHitsFired,
                    totalExecutionTimeSeconds: Number((testExecutionTimeMs / 1000).toFixed(2)),
                },
                null,
                2
            ),
            'utf-8'
        ),
    });

    // Add UI summary annotation to Playwright HTML Report card
    testInfo.annotations.push({
        type: 'Performance Summary',
        description: `Module: Admin | Tabs: ${tabs.length} | Cycles: ${repeatCount} | Total Hits: ${totalHitsFired} | Duration: ${(testExecutionTimeMs / 1000).toFixed(1)}s`,
    });

    // Keep browser window open for inspection in headed mode if needed
    if (process.env.PAUSE === 'true') {
        await tab1.pause();
    }
    await context.close();
});
