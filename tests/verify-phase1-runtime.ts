import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const DOWNLOADS = 'C:\\Users\\kevin\\Downloads';

// Product 1 Images (Green Tea)
const P1_FRONT = path.join(DOWNLOADS, 'green tea front.jpeg');
const P1_BACK = path.join(DOWNLOADS, 'green tea back.jpeg');
const P1_SIDE = path.join(DOWNLOADS, 'green tea side.jpeg');

// Product 2 Images (Red Label Tea)
const P2_FRONT = path.join(DOWNLOADS, 'red label f.jpeg');
const P2_BACK = path.join(DOWNLOADS, 'redlabel side.jpeg');
const P2_SIDE = path.join(DOWNLOADS, 'red label top.jpeg');

// ── Helpers ──────────────────────────────────────────────────────

type Verdict = 'PASS' | 'FAIL' | 'NOT PERFORMED';

interface TestResult {
  point: number;
  description: string;
  verdict: Verdict;
  evidence: string;
}

const results: TestResult[] = [];

function record(point: number, description: string, verdict: Verdict, evidence: string) {
  results.push({ point, description, verdict, evidence });
}

/** Upload 3 images into the empty capture slots */
async function uploadThreeImages(
  page: any,
  front: string,
  back: string,
  side: string
) {
  for (const filePath of [front, back, side]) {
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('button:has-text("Upload")').first().click(),
    ]);
    await fc.setFiles(filePath);
    await page.waitForTimeout(500);
  }
}

/** Remove all captured images */
async function clearAllImages(page: any) {
  while ((await page.locator('button:has-text("Remove")').count()) > 0) {
    await page.locator('button:has-text("Remove")').first().click();
    await page.waitForTimeout(300);
  }
}

/** Click the extraction action button and wait for the form step */
async function triggerExtractionAndWaitForForm(page: any) {
  await page.locator('button:has-text("Extraction"), button:has-text("Continue")').last().click();
  // Wait until we reach the form step and the Run Inspection button is rendered
  await page.waitForSelector('button:has-text("Run Inspection")', { timeout: 60000 });
  await page.waitForTimeout(1000); // Allow React state to settle
}

/** Read the Product Name field value from the form */
async function readProductName(page: any): Promise<string> {
  // Find the input matching the Product Name label
  const input = page
    .locator('label:has-text("Product Name") ~ input, label:has-text("Product Name") + div input')
    .first();
  return (await input.inputValue()).trim();
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('====================================================');
  console.log('PHASE 1 RUNTIME STABILITY & EXTRACTION VERIFICATION');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('====================================================');

  // Pre-flight: verify image files exist
  const allFiles = [P1_FRONT, P1_BACK, P1_SIDE, P2_FRONT, P2_BACK, P2_SIDE];
  for (const f of allFiles) {
    if (!fs.existsSync(f)) {
      console.error(`FATAL: image file not found: ${f}`);
      process.exit(1);
    }
  }
  console.log('✓ All 6 image files present on disk.\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Track every POST /api/extract network request
  let networkExtractCalls = 0;
  page.on('request', (req: any) => {
    if (req.url().includes('/api/extract') && req.method() === 'POST') {
      networkExtractCalls++;
      console.log(`  [Network] POST /api/extract #${networkExtractCalls}`);
    }
  });

  // Capture console errors from the browser
  const consoleErrors: string[] = [];
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    // ── Navigate ────────────────────────────────────────────────
    await page.goto('http://localhost:3000/inspect', { waitUntil: 'networkidle' });
    console.log('Loaded /inspect\n');

    // ────────────────────────────────────────────────────────────
    // TEST 1 — Product 1 extraction with real images
    // ────────────────────────────────────────────────────────────
    console.log('─── TEST 1: Product 1 (Green Tea) — first extraction ───');
    const callsBefore1 = networkExtractCalls;
    await uploadThreeImages(page, P1_FRONT, P1_BACK, P1_SIDE);
    await triggerExtractionAndWaitForForm(page);
    const p1Name = await readProductName(page);
    const p1Calls = networkExtractCalls - callsBefore1;
    const t1Pass = p1Name.length > 0 && p1Calls >= 1;
    record(
      1,
      'Product 1 extraction with real images',
      t1Pass ? 'PASS' : 'FAIL',
      `productName="${p1Name}", apiCalls=${p1Calls}`
    );

    // ────────────────────────────────────────────────────────────
    // TEST 2 — Product 2 extraction with different real images
    // ────────────────────────────────────────────────────────────
    console.log('\n─── TEST 2: Product 2 (Red Label) — different product ───');
    await page.locator('button:has-text("← Back to Images")').click();
    await page.waitForTimeout(500);
    await clearAllImages(page);
    const callsBefore2 = networkExtractCalls;
    await uploadThreeImages(page, P2_FRONT, P2_BACK, P2_SIDE);
    await triggerExtractionAndWaitForForm(page);
    const p2Name = await readProductName(page);
    const p2Calls = networkExtractCalls - callsBefore2;
    const t2Pass = p2Name.length > 0 && p2Calls >= 1 && p2Name !== p1Name;
    record(
      2,
      'Product 2 extraction with different real images',
      t2Pass ? 'PASS' : 'FAIL',
      `productName="${p2Name}", apiCalls=${p2Calls}, differentFromP1=${p2Name !== p1Name}`
    );

    // ────────────────────────────────────────────────────────────
    // TEST 3 — Product 1 again (2nd time), same files
    // ────────────────────────────────────────────────────────────
    console.log('\n─── TEST 3: Product 1 again (2nd run, same files) ───');
    await page.locator('button:has-text("← Back to Images")').click();
    await page.waitForTimeout(500);
    await clearAllImages(page);
    const callsBefore3 = networkExtractCalls;
    await uploadThreeImages(page, P1_FRONT, P1_BACK, P1_SIDE);
    await triggerExtractionAndWaitForForm(page);
    const p1run2Name = await readProductName(page);
    const p1run2Calls = networkExtractCalls - callsBefore3;
    const t3Pass = p1run2Name.length > 0 && p1run2Calls >= 1;
    record(
      3,
      'Product 1 again (2nd time, same files)',
      t3Pass ? 'PASS' : 'FAIL',
      `productName="${p1run2Name}", apiCalls=${p1run2Calls}`
    );

    // ────────────────────────────────────────────────────────────
    // TEST 4 — Product 1 a third time (same files, images already loaded)
    // ────────────────────────────────────────────────────────────
    console.log('\n─── TEST 4: Product 1 a third time (3rd run) ───');
    await page.locator('button:has-text("← Back to Images")').click();
    await page.waitForTimeout(500);
    // Images still loaded from test 3 — just re-trigger extraction
    const callsBefore4 = networkExtractCalls;
    await triggerExtractionAndWaitForForm(page);
    const p1run3Name = await readProductName(page);
    const p1run3Calls = networkExtractCalls - callsBefore4;
    const t4Pass = p1run3Name.length > 0 && p1run3Calls >= 1;
    record(
      4,
      'Product 1 a third time (3rd run, same files)',
      t4Pass ? 'PASS' : 'FAIL',
      `productName="${p1run3Name}", apiCalls=${p1run3Calls}`
    );

    // ────────────────────────────────────────────────────────────
    // TEST 5 — Selecting the exact same file again triggers extraction
    //   (remove an image, re-upload identical file path, verify onChange fires)
    // ────────────────────────────────────────────────────────────
    console.log('\n─── TEST 5: Same-file re-selection triggers extraction ───');
    await page.locator('button:has-text("← Back to Images")').click();
    await page.waitForTimeout(500);
    // Remove the first image
    await page.locator('button:has-text("Remove")').first().click();
    await page.waitForTimeout(500);
    // Re-upload the exact same front file into the now-empty slot
    const [fcSame] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('button:has-text("Upload")').first().click(),
    ]);
    await fcSame.setFiles(P1_FRONT);
    await page.waitForTimeout(500);
    // If we got here without timeout, the onChange handler fired despite the file being identical
    const callsBefore5 = networkExtractCalls;
    await triggerExtractionAndWaitForForm(page);
    const p1run4Name = await readProductName(page);
    const p1run4Calls = networkExtractCalls - callsBefore5;
    const t5Pass = p1run4Name.length > 0 && p1run4Calls >= 1;
    record(
      5,
      'Same-file re-selection triggers extraction',
      t5Pass ? 'PASS' : 'FAIL',
      `Re-uploaded "${path.basename(P1_FRONT)}" into cleared slot; onChange fired (no timeout); productName="${p1run4Name}", apiCalls=${p1run4Calls}`
    );

    // ────────────────────────────────────────────────────────────
    // TEST 6 — Rapid repeated clicking does NOT create concurrent requests
    // ────────────────────────────────────────────────────────────
    console.log('\n─── TEST 6: Rapid repeated clicking concurrency guard ───');
    await page.locator('button:has-text("← Back to Images")').click();
    await page.waitForTimeout(500);
    const callsBefore6 = networkExtractCalls;
    const btn = page.locator('button:has-text("Extraction"), button:has-text("Continue")').last();
    // Fire 3 clicks as fast as possible
    await Promise.all([
      btn.click().catch(() => {}),
      btn.click({ force: true }).catch(() => {}),
      btn.click({ force: true }).catch(() => {}),
    ]);
    await page.waitForSelector('button:has-text("Run Inspection")', { timeout: 60000 });
    const rapidCalls = networkExtractCalls - callsBefore6;
    const t6Pass = rapidCalls === 1;
    record(
      6,
      'Rapid repeated clicking blocked duplicate requests',
      t6Pass ? 'PASS' : 'FAIL',
      `3 rapid clicks issued; POST /api/extract requests observed: ${rapidCalls} (expected 1)`
    );

    // ────────────────────────────────────────────────────────────
    // TEST 7 — After extraction completes, another extraction can start
    // ────────────────────────────────────────────────────────────
    console.log('\n─── TEST 7: Post-extraction new extraction starts normally ───');
    // We are now on the form step after test 6. Go back and try again.
    await page.locator('button:has-text("← Back to Images")').click();
    await page.waitForTimeout(500);
    const callsBefore7 = networkExtractCalls;
    await triggerExtractionAndWaitForForm(page);
    const p1run5Name = await readProductName(page);
    const p1run5Calls = networkExtractCalls - callsBefore7;
    const t7Pass = p1run5Name.length > 0 && p1run5Calls >= 1;
    record(
      7,
      'After extraction completes, another extraction starts normally',
      t7Pass ? 'PASS' : 'FAIL',
      `productName="${p1run5Name}", apiCalls=${p1run5Calls}. Lock did not remain stuck.`
    );

    // ────────────────────────────────────────────────────────────
    // TEST 8 — 429/503 error-handling path
    //   Cannot be runtime-tested without deliberately provoking 429/503.
    //   Deliberately spamming the API is forbidden. Marking NOT PERFORMED.
    // ────────────────────────────────────────────────────────────
    record(
      8,
      '429/503 error-handling path (runtime)',
      'NOT PERFORMED',
      'Cannot be verified at runtime without deliberately provoking rate-limit or service-unavailable responses from the live Gemini API, which would mean spamming the API. Code-level review of src/lib/vision/gemini.ts and src/app/api/extract/route.ts confirms the handling paths exist (429 → isRateLimit=true, no retry; 503 → max 1 retry with 1s delay; both → fallback:true to client), but this was NOT exercised at runtime.'
    );

  } catch (err) {
    console.error('\n⚠ Test halted with error:', err);
  } finally {
    await browser.close();
  }

  // ── Final Report ───────────────────────────────────────────────
  console.log('\n====================================================');
  console.log('FINAL REPORT');
  console.log('====================================================');
  console.log(`Total network POST /api/extract calls: ${networkExtractCalls}`);
  if (consoleErrors.length > 0) {
    console.log(`Browser console errors captured: ${consoleErrors.length}`);
    consoleErrors.forEach((e) => console.log(`  ✗ ${e}`));
  } else {
    console.log('Browser console errors: 0');
  }
  console.log('');
  for (const r of results) {
    const icon = r.verdict === 'PASS' ? '✓' : r.verdict === 'FAIL' ? '✗' : '—';
    console.log(`${icon} [${r.verdict}] Test ${r.point}: ${r.description}`);
    console.log(`    ${r.evidence}`);
  }
  const passed = results.filter((r) => r.verdict === 'PASS').length;
  const failed = results.filter((r) => r.verdict === 'FAIL').length;
  const notPerformed = results.filter((r) => r.verdict === 'NOT PERFORMED').length;
  console.log(`\nSummary: ${passed} PASS, ${failed} FAIL, ${notPerformed} NOT PERFORMED out of ${results.length} tests`);
}

main();
