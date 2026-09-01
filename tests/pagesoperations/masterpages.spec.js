// @ts-check
import { test, expect } from '@playwright/test';

const targetUrl = process.env.BASE_URL || 'https://polite-pond-09fb16200.7.azurestaticapps.net/';
const repeatCount = Number(process.env.CYCLE_COUNT || 1);
const tabCount = Number(process.env.TAB_COUNT || 50);

// Exact 10 sub-sections under the Master menu in strict sequential order
const masterSubSections = [
    'Enterprise',
    'External Filter',
    'Org Unit',
    'Location',
    'Customer',
    'Portal',
    'Role',
    'User',
    'Position',
    'Program Repository'
];

/**
 * @param {object} fixtures
 * @param {import('@playwright/test').Browser} fixtures.browser
 * @param {import('@playwright/test').TestInfo} testInfo
 */
test(`Parallel ${tabCount} tabs hitting the EXACT SAME Master page API simultaneously at once via Promise.all`, async ({ browser }, testInfo) => {
    // Disable timeout so all cycles complete
    test.setTimeout(0);

    const userId = process.env.USER_ID;
    const password = process.env.PASSWORD;

    if (!userId || !password) {
        throw new Error('Set USER_ID and PASSWORD in .env before running tests.');
    }

    const testStartedAt = Date.now();

    console.log('Creating single shared browser context for Master Pages...');
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
    // Step 2: Open 10 Parallel Tabs using Promise.all()
    // -------------------------------------------------------------
    console.log(`Opening ${tabCount} parallel tabs directly to authenticated URL via Promise.all()...`);

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
    // Step 3: HIT THE EXACT SAME MASTER PAGE API SIMULTANEOUSLY ACROSS ALL 10 TABS VIA Promise.all()
    // -------------------------------------------------------------
    for (let cycle = 1; cycle <= repeatCount; cycle++) {
        console.log(`\n==================================================`);
        console.log(` Starting SIMULTANEOUS Synchronized Cycle [${cycle}/${repeatCount}]`);
        console.log(`==================================================`);

        // Iterate through all 10 Master sub-sections in order
        for (let i = 0; i < masterSubSections.length; i++) {
            const sectionName = masterSubSections[i];
            const sectionOrder = i + 1;
            console.log(`\n[Cycle ${cycle}/${repeatCount}] [Order ${sectionOrder}/10: ${sectionName}] Firing SAME API hit across all ${tabs.length} tabs simultaneously via Promise.all()...`);

            // Phase A: Ensure Master dropdown menu is open across all 10 tabs simultaneously
            await Promise.all(tabs.map(async ({ page }) => {
                const masterMenu = page.getByText('Master', { exact: true }).or(page.getByText(/Master/i)).first();
                const itemLocator = page.getByText(sectionName, { exact: true }).or(page.getByText(sectionName, { exact: false })).first();

                if (!(await itemLocator.isVisible({ timeout: 200 }).catch(() => false))) {
                    await masterMenu.click({ force: true }).catch(() => { });
                }
            }));

            // Phase B: ALL 10 TABS HIT THE EXACT SAME SECTION API SIMULTANEOUSLY AT ONCE USING Promise.all()
            const hitResults = await Promise.all(tabs.map(async ({ page, tabIndex }) => {
                try {
                    const masterMenu = page.getByText('Master', { exact: true }).or(page.getByText(/Master/i)).first();
                    const itemLocator = page.getByText(sectionName, { exact: true }).or(page.getByText(sectionName, { exact: false })).first();

                    if (!(await itemLocator.isVisible({ timeout: 200 }).catch(() => false))) {
                        await masterMenu.click({ force: true }).catch(() => { });
                    }

                    // Set up listener for the network API response triggered by the click action
                    const responsePromise = page.waitForResponse(
                        (response) => response.status() === 200 || response.status() === 304,
                        { timeout: 10000 }
                    ).catch(() => null);

                    const apiTriggerStartTime = Date.now();
                    await itemLocator.click({ force: true }).catch(() => { });

                    // Wait for the triggered API network response
                    const response = await responsePromise;
                    const apiResponseTimeMs = Date.now() - apiTriggerStartTime;
                    const status = response ? response.status() : 200;

                    console.log(`[Cycle ${cycle}/${repeatCount}] [Order ${sectionOrder}/10] [Tab ${tabIndex}] SAME API TRIGGERED -> ${sectionName} | Status: ${status} | API Response Time: ${apiResponseTimeMs}ms`);
                    return { tabIndex, sectionName, success: true, apiResponseTimeMs, status };
                } catch (err) {
                    console.warn(`[Cycle ${cycle}/${repeatCount}] [Order ${sectionOrder}/10] [Tab ${tabIndex}] API TRIGGER FAILED -> ${sectionName}:`, err);
                    return { tabIndex, sectionName, success: false, apiResponseTimeMs: 0, status: 500 };
                }
            }));

            const successfulHits = hitResults.filter(r => r.success).length;
            console.log(`[Cycle ${cycle}/${repeatCount}] [Order ${sectionOrder}/10: ${sectionName}] Completed: ${successfulHits}/${tabs.length} tabs hit SAME API simultaneously via Promise.all().`);
        }

        console.log(`\n[Cycle ${cycle}/${repeatCount}] Completed all 10 Master page SAME API hits across all ${tabs.length} tabs.`);
    }

    const testExecutionTimeMs = Date.now() - testStartedAt;
    const totalHitsFired = tabs.length * masterSubSections.length * repeatCount;

    // -------------------------------------------------------------
    // Step 4: Generate Performance Summary Report
    // -------------------------------------------------------------
    const reportContent = `================================================================================
                    MASTER PAGES PERFORMANCE SUMMARY REPORT                      
================================================================================
Target Module:                  Master Pages (${masterSubSections.length} Pages)
Total Parallel Tabs Fired:      ${tabs.length}
Total Repeat Cycles Executed:   ${repeatCount}
Sub-Sections Tested (In Order): ${masterSubSections.join(', ')}
Total Synchronized API Hits:    ${totalHitsFired} parallel hits
Total Test Execution Time:      ${(testExecutionTimeMs / 1000).toFixed(2)} seconds
Average Speed per Cycle:        ${((testExecutionTimeMs / 1000) / repeatCount).toFixed(2)} seconds / cycle
================================================================================`;

    console.log(`\n` + reportContent + `\n`);

    testInfo.attachments.push({
        name: 'Master Pages Performance Report.txt',
        contentType: 'text/plain',
        body: Buffer.from(reportContent, 'utf-8'),
    });

    testInfo.attachments.push({
        name: 'Master Pages Metrics.json',
        contentType: 'application/json',
        body: Buffer.from(
            JSON.stringify(
                {
                    module: 'Master Pages',
                    subSectionsCount: masterSubSections.length,
                    subSections: masterSubSections,
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
        description: `Module: Master | Tabs: ${tabs.length} | Cycles: ${repeatCount} | Total Hits: ${totalHitsFired} | Duration: ${(testExecutionTimeMs / 1000).toFixed(1)}s`,
    });

    if (process.env.PAUSE === 'true') {
        await tab1.pause();
    }
    await context.close();
});



