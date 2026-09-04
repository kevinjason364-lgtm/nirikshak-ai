import { chromium } from 'playwright';
import path from 'path';

const DOWNLOADS = 'C:\\Users\\kevin\\Downloads';
const FRONT = path.join(DOWNLOADS, 'green tea front.jpeg');
const BACK = path.join(DOWNLOADS, 'green tea back.jpeg');

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3000');

    // Navigate to inspection
    await page.getByRole('button', { name: /start inspection/i }).click();

    // Test 1: Upload images
    const [fileChooser1] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('button:has-text("Upload")').nth(0).click() // First slot 'front'
    ]);
    await fileChooser1.setFiles(FRONT);

    const [fileChooserBack] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('button:has-text("Upload")').nth(0).click() // Second slot 'back'
    ]);
    await fileChooserBack.setFiles(BACK);

    // Test 2: Repeat upload same file
    await page.locator('button:has-text("Remove")').first().click();
    const [fileChooserRepeat] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('button:has-text("Upload")').nth(0).click() // First slot 'front' upload
    ]);
    await fileChooserRepeat.setFiles(FRONT);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  runTest().catch(console.error);
}

