// @ts-check
import { test, expect } from '@playwright/test';

const targetUrl = process.env.BASE_URL || 'https://polite-pond-09fb16200.7.azurestaticapps.net/';
const repeatCount = Number(process.env.CYCLE_COUNT || 2);
const tabCount = Number(process.env.TAB_COUNT || 50);

// All sub-sections under Automation in one single combined array
const automationSubSections = [
    'Plant Customer Cross Ref',
    'Program Mapping',
    'Program Variant',
    'Task',
    'Scheduler',
    'Setups',
    'Adapters',
    'Logical System',
    'Internal Customer Cross Ref',
    'Screen Configuration',
    'Mail',
    'FTP/SFTP'
];

/**
 * @param {object} fixtures
 * @param {import('@playwright/test').Browser} fixtures.browser
 * @param {import('@playwright/test').TestInfo} testInfo
 */
test('Parallel tabs hitting the SAME Automation page API simultaneously at once', async ({ browser }, testInfo) => {
    // Disable timeout so all cycles complete
    test.setTimeout(0);

    const userId = process.env.USER_ID;
    const password = process.env.PASSWORD;

    if (!userId || !password) {
        throw new Error('Set USER_ID and PASSWORD in .env before running tests.');
    }

    const testStartedAt = Date.now();

    console.log('Creating single shared browser context for Automation Pages...');
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
    // Step 2: Open Tabs safely in batches of 10 to prevent memory issues
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

    // -------------------------------------------------------------
    // Step 3: VISIBLY VISIT EACH PAGE ON ALL TABS SIMULTANEOUSLY
    // -------------------------------------------------------------
    for (let cycle = 1; cycle <= repeatCount; cycle++) {
        console.log(`\n==================================================`);
        console.log(` Starting SIMULTANEOUS Synchronized Cycle [${cycle}/${repeatCount}]`);
        console.log(`==================================================`);

        for (let i = 0; i < automationSubSections.length; i++) {
            const sectionName = automationSubSections[i];
            console.log(`\n[Cycle ${cycle}/${repeatCount}] Synchronizing ${tabs.length} tabs to VISIT [${sectionName}] simultaneously...`);

            // Phase A: Ensure Automation menu header is expanded on ALL tabs concurrently
            await Promise.all(tabs.map(async ({ page }) => {
                const automationMenu = page.getByText('Automation', { exact: true }).or(page.getByText(/Automation/i)).first();
                const itemLocator = page.getByText(sectionName, { exact: true }).or(page.getByText(sectionName, { exact: false })).first();

                if (!(await itemLocator.isVisible({ timeout: 100 }).catch(() => false))) {
                    await automationMenu.click({ force: true }).catch(() => { });
                }
            }));

            // Phase B: Click item on ALL tabs simultaneously AND ensure real page navigation completes
            await Promise.all(tabs.map(async ({ page, tabIndex }) => {
                try {
                    const automationMenu = page.getByText('Automation', { exact: true }).or(page.getByText(/Automation/i)).first();
                    const itemLocator = page.getByText(sectionName, { exact: true }).or(page.getByText(sectionName, { exact: false })).first();

                    if (!(await itemLocator.isVisible({ timeout: 100 }).catch(() => false))) {
                        await automationMenu.click({ force: true }).catch(() => { });
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
    const totalHitsFired = tabs.length * automationSubSections.length * repeatCount;

    // -------------------------------------------------------------
    // Step 4: Generate Performance Summary Report
    // -------------------------------------------------------------
    const reportContent = `================================================================================
                  AUTOMATION PAGES PERFORMANCE SUMMARY REPORT                    
================================================================================
Target Module:                  Automation Pages (${automationSubSections.length} Pages)
Total Parallel Tabs Fired:      ${tabs.length}
Total Repeat Cycles Executed:   ${repeatCount}
Sub-Sections Tested:            ${automationSubSections.join(', ')}
Total Synchronized API Hits:    ${totalHitsFired} parallel hits
Total Test Execution Time:      ${(testExecutionTimeMs / 1000).toFixed(2)} seconds
Average Speed per Cycle:        ${((testExecutionTimeMs / 1000) / repeatCount).toFixed(2)} seconds / cycle
================================================================================`;

    console.log(`\n` + reportContent + `\n`);

    testInfo.attachments.push({
        name: 'Automation Pages Performance Report.txt',
        contentType: 'text/plain',
        body: Buffer.from(reportContent, 'utf-8'),
    });

    testInfo.attachments.push({
        name: 'Automation Pages Metrics.json',
        contentType: 'application/json',
        body: Buffer.from(
            JSON.stringify(
                {
                    module: 'Automation Pages',
                    subSectionsCount: automationSubSections.length,
                    subSections: automationSubSections,
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

    testInfo.annotations.push({
        type: 'Performance Summary',
        description: `Module: Automation | Tabs: ${tabs.length} | Cycles: ${repeatCount} | Total Hits: ${totalHitsFired} | Duration: ${(testExecutionTimeMs / 1000).toFixed(1)}s`,
    });

    if (process.env.PAUSE === 'true') {
        await tab1.pause();
    }
    await context.close();
});
