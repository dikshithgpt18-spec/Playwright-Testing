// @ts-check
import { test, expect } from '@playwright/test';

const targetUrl = process.env.BASE_URL || 'https://polite-pond-09fb16200.7.azurestaticapps.net/';
const requestCount = Number(process.env.OPERATION_COUNT || 100);

/**
 * @param {object} fixtures
 * @param {import('@playwright/test').BrowserContext} fixtures.context
 * @param {import('@playwright/test').TestInfo} testInfo
 */
test('100 simultaneous parallel page load performance test 1', async ({ context }, testInfo) => {
    // Disable test timeout so all 100 parallel requests complete
    test.setTimeout(0);

    console.log(`Preparing to fire ${requestCount} PARALLEL page load requests simultaneously...`);

    const batchStartedAt = Date.now();

    /** @type {Array<{ tabIndex: number, status: number, ttfbMs: number, domContentLoadedMs: number, loadCompletedMs: number, totalTimeMs: number }>} */
    const metricsList = [];

    // Helper function to fire a single parallel tab request
    const fireParallelTabRequest = async (tabIndex) => {
        const pageStartedAt = Date.now();
        try {
            const page = await context.newPage().catch(() => null);
            if (!page) return;

            // Fire page load navigation immediately
            const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null);

            // Extract performance metrics
            const metric = await page.evaluate(() => {
                const entry = /** @type {PerformanceNavigationTiming | undefined} */ (
                    performance.getEntriesByType('navigation')[0]
                );
                if (!entry) return null;

                return {
                    responseStartMs: entry.responseStart,
                    domContentLoadedMs: entry.domContentLoadedEventEnd,
                    loadCompletedMs: entry.loadEventEnd,
                };
            }).catch(() => null);

            const totalTabLoadTimeMs = Date.now() - pageStartedAt;

            if (metric) {
                metricsList.push({
                    tabIndex,
                    status: response?.status() || 200,
                    ttfbMs: Math.round(metric.responseStartMs),
                    domContentLoadedMs: Math.round(metric.domContentLoadedMs),
                    loadCompletedMs: Math.round(metric.loadCompletedMs),
                    totalTimeMs: totalTabLoadTimeMs,
                });
            }

            console.log(`[Tab ${tabIndex}/${requestCount}] PARALLEL LOAD HIT: Status ${response?.status() || 200}`);

            // Close tab after metric collection to maintain memory stability
            await page.close().catch(() => { });
        } catch (err) {
            console.warn(`[Tab ${tabIndex}/${requestCount}] Parallel request error:`, err);
        }
    };

    // -------------------------------------------------------------
    // FIRE ALL 100 REQUESTS SIMULTANEOUSLY IN PARALLEL AT ONCE!
    // -------------------------------------------------------------
    console.log(`FIRING ${requestCount} SIMULTANEOUS PARALLEL REQUESTS TO BACKEND AT ONCE...`);

    const parallelPromises = Array.from({ length: requestCount }).map((_, idx) =>
        fireParallelTabRequest(idx + 1)
    );

    await Promise.all(parallelPromises);

    const batchTotalTimeMs = Date.now() - batchStartedAt;

    /**
     * Calculate stats for metric list
     * @param {number[]} values
     */
    const getStats = (values) => {
        if (!values.length) return { min: 0, max: 0, avg: 0, p95: 0, median: 0 };
        const sorted = [...values].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        const avg = sum / sorted.length;
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const p95 = sorted[Math.floor(sorted.length * 0.95)] || max;
        const median = sorted[Math.floor(sorted.length * 0.5)] || avg;
        return { min, max, avg, p95, median };
    };

    const dclStats = getStats(metricsList.map((m) => m.domContentLoadedMs));
    const loadStats = getStats(metricsList.map((m) => m.loadCompletedMs));
    const ttfbStats = getStats(metricsList.map((m) => m.ttfbMs));

    const reportContent = `================================================================================
               100 SIMULTANEOUS PARALLEL PAGE LOAD REPORT 1                     
================================================================================
Target URL:                     ${targetUrl}
Total Parallel Requests Fired:  ${requestCount}
Successful Pages Loaded:        ${metricsList.length} / ${requestCount}
Total Parallel Batch Time:      ${(batchTotalTimeMs / 1000).toFixed(2)} seconds
--------------------------------------------------------------------------------
METRIC SUMMARY (ms):
Metric                   Min        Max        Average     Median     P95
--------------------------------------------------------------------------------
TTFB (Response Start):   ${String(ttfbStats.min).padStart(8)} ms ${String(ttfbStats.max).padStart(8)} ms ${String(ttfbStats.avg.toFixed(1)).padStart(8)} ms ${String(ttfbStats.median.toFixed(1)).padStart(8)} ms ${String(ttfbStats.p95).padStart(8)} ms
DOMContentLoaded:       ${String(dclStats.min).padStart(8)} ms ${String(dclStats.max).padStart(8)} ms ${String(dclStats.avg.toFixed(1)).padStart(8)} ms ${String(dclStats.median.toFixed(1)).padStart(8)} ms ${String(dclStats.p95).padStart(8)} ms
Full Page Load:          ${String(loadStats.min).padStart(8)} ms ${String(loadStats.max).padStart(8)} ms ${String(loadStats.avg.toFixed(1)).padStart(8)} ms ${String(loadStats.median.toFixed(1)).padStart(8)} ms ${String(loadStats.p95).padStart(8)} ms
================================================================================`;

    console.log(`\n` + reportContent + `\n`);

    testInfo.attachments.push({
        name: 'Parallel Page Load Report 1',
        contentType: 'text/plain',
        body: Buffer.from(reportContent, 'utf-8'),
    });
});
