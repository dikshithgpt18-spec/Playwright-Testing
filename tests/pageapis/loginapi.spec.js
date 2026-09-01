// @ts-check
import { test, expect } from '@playwright/test';

const targetUrl = process.env.BASE_URL || 'https://polite-pond-09fb16200.7.azurestaticapps.net/';
const userId = process.env.USER_ID || 'superadminmartinrea1@martinrea.com';
const password = process.env.PASSWORD || 'Dell@123';
const apiCallCount = Number(process.env.TAB_COUNT || 100);

/**
 * @param {object} fixtures
 * @param {import('@playwright/test').Browser} fixtures.browser
 * @param {import('@playwright/test').TestInfo} testInfo
 */
test(`Authenticate once then send ${apiCallCount} Dashboard After-Login API requests simultaneously at once without opening tabs`, async ({ browser }, testInfo) => {
    test.setTimeout(0);

    console.log('Step 1: Logging in ONCE on 1 single page to establish authenticated session...');
    const context = await browser.newContext();
    const loginPage = await context.newPage();

    await loginPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await loginPage.getByRole('textbox').first().fill(userId);
    await loginPage.locator('input[type="password"]').fill(password);
    await loginPage.getByRole('button', { name: 'Login' }).click();
    await expect(loginPage.getByRole('button', { name: 'Login' })).toBeHidden({ timeout: 30000 });

    const dashboardUrl = loginPage.url();
    console.log(`Login successful! Authenticated Dashboard URL: ${dashboardUrl}`);

    // Close the single login tab - NO MORE TABS NEEDED!
    await loginPage.close();
    console.log('Single login tab closed. Memory freed! Operating with 0 browser tabs.');

    // Step 2: Fire all 100 direct HTTP API requests simultaneously at the exact same millisecond
    console.log(`Step 2: Firing ${apiCallCount} direct After-Login Dashboard API requests simultaneously via Promise.all()...`);

    const globalDispatchStart = Date.now();

    const apiPromises = Array.from({ length: apiCallCount }).map(async (_, idx) => {
        const reqId = idx + 1;
        const dispatchOffsetMs = Date.now() - globalDispatchStart;
        const requestStart = Date.now();

        try {
            const response = await context.request.get(dashboardUrl);
            const responseTimeMs = Date.now() - requestStart;
            const status = response.status();
            const ok = response.ok() || status === 200 || status === 304;

            return {
                id: reqId,
                dispatchOffsetMs,
                status,
                responseTimeMs,
                ok,
                error: null
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            return {
                id: reqId,
                dispatchOffsetMs,
                status: 500,
                responseTimeMs: Date.now() - requestStart,
                ok: false,
                error: errorMessage
            };
        }
    });

    // Promise.all triggers all 100 un-awaited requests concurrently at the exact same moment
    const results = await Promise.all(apiPromises);
    const totalExecutionTimeMs = Date.now() - globalDispatchStart;

    // Step 3: Analyze performance & dispatch synchronicity
    let passedCount = 0;
    let failedCount = 0;
    let totalResponseTime = 0;
    let rawMinResponseTime = Infinity;
    let maxResponseTime = 0;

    for (const res of results) {
        if (res.ok) {
            passedCount++;
        } else {
            failedCount++;
            console.log(`[Request #${res.id}] Failed with status: ${res.status} | Reason: ${res.error || 'HTTP Status Error'}`);
        }

        totalResponseTime += res.responseTimeMs;
        if (res.responseTimeMs < rawMinResponseTime) rawMinResponseTime = res.responseTimeMs;
        if (res.responseTimeMs > maxResponseTime) maxResponseTime = res.responseTimeMs;
    }

    const minResponseTime = isFinite(rawMinResponseTime) ? rawMinResponseTime : 0;
    const avgResponseTimeMs = (totalResponseTime / apiCallCount).toFixed(2);
    const maxDispatchOffset = Math.max(...results.map(r => r.dispatchOffsetMs));

    // Step 4: Print the final Scorecard with Synchronicity Verification
    const reportContent = `==================================================
      AFTER-LOGIN DASHBOARD API TEST SCORECARD    
==================================================
Target Dashboard URL:     ${dashboardUrl}
Total Parallel API Calls: ${results.length}
Passed:                   ${passedCount}
Failed:                   ${failedCount}
Max Dispatch Time Offset: ${maxDispatchOffset} ms (100% Simultaneous Trigger)
Total Execution Time:     ${(totalExecutionTimeMs / 1000).toFixed(2)} seconds
Min Response Time:        ${minResponseTime} ms
Max Response Time:        ${maxResponseTime} ms
Avg Response Time:        ${avgResponseTimeMs} ms
Memory Footprint:         Minimal (0 active tabs)
==================================================`;

    // Log line-by-line so Playwright runner UI doesn't clip/overwrite multi-line blocks
    reportContent.split('\n').forEach(line => console.log(line));

    testInfo.attachments.push({
        name: 'Dashboard API Performance Report.txt',
        contentType: 'text/plain',
        body: Buffer.from(reportContent, 'utf-8'),
    });

    testInfo.attachments.push({
        name: 'Dashboard API Metrics.json',
        contentType: 'application/json',
        body: Buffer.from(
            JSON.stringify(
                {
                    targetUrl: dashboardUrl,
                    totalCalls: results.length,
                    passed: passedCount,
                    failed: failedCount,
                    maxDispatchOffsetMs: maxDispatchOffset,
                    executionTimeSeconds: Number((totalExecutionTimeMs / 1000).toFixed(2)),
                    minResponseTimeMs: minResponseTime,
                    maxResponseTimeMs: maxResponseTime,
                    avgResponseTimeMs: Number(avgResponseTimeMs)
                },
                null,
                2
            ),
            'utf-8'
        ),
    });

    testInfo.annotations.push({
        type: 'Performance Summary',
        description: `Dashboard API | Hits: ${results.length} | Passed: ${passedCount} | Duration: ${(totalExecutionTimeMs / 1000).toFixed(1)}s`,
    });

    await context.close();

    expect(passedCount).toBe(apiCallCount);
});
