const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BRAIN_DIR = '/Users/guy/.gemini/antigravity-ide/brain/d726310f-5825-4e02-883d-58e2e8e0f4ab';
const SCREENSHOTS_DIR = path.join(BRAIN_DIR, 'screenshots');
const RECORDINGS_DIR = path.join(BRAIN_DIR, 'recordings');
const BASE_URL = 'http://localhost:3001';

// iPhone 14 Pro viewport
const MOBILE = { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

async function capture(page, name, description) {
  const file = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✅ Screenshot: ${name} — ${description}`);
  return file;
}

async function captureFullPage(page, name, description) {
  const file = path.join(SCREENSHOTS_DIR, `${name}_full.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`✅ Full-page: ${name} — ${description}`);
  return file;
}

(async () => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  
  // Set up context with video recording
  const context = await browser.newContext({
    viewport: { width: MOBILE.width, height: MOBILE.height },
    deviceScaleFactor: MOBILE.deviceScaleFactor,
    isMobile: MOBILE.isMobile,
    hasTouch: MOBILE.hasTouch,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    recordVideo: {
      dir: RECORDINGS_DIR,
      size: { width: 393, height: 852 }
    }
  });

  const page = await context.newPage();

  // ── 1. HOMEPAGE ──
  console.log('\n📱 Testing Homepage...');
  await page.goto(`${BASE_URL}/`);
  await page.waitForLoadState('networkidle');
  await capture(page, '01_home_top', 'Homepage hero + tool grid (mobile)');
  await captureFullPage(page, '01_home', 'Homepage full page');
  await page.waitForTimeout(1000);

  // ── 2. HEADER — hamburger menu open ──
  console.log('\n📱 Testing Mobile Menu...');
  await page.click('button[aria-label="Toggle mobile menu"]');
  await page.waitForTimeout(800);
  await capture(page, '02_header_menu_open', 'Mobile hamburger menu open');
  
  // Close menu before proceeding
  await page.click('button[aria-label="Toggle mobile menu"]');
  await page.waitForTimeout(400);

  // ── 3. PDF TO MARKDOWN PAGE ──
  console.log('\n📱 Navigating to PDF to Markdown...');
  await page.goto(`${BASE_URL}/pdf-to-markdown`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await capture(page, '03_pdf_top', 'PDF to Markdown — top viewport');
  await captureFullPage(page, '03_pdf', 'PDF to Markdown — full page scroll');

  // ── 4. MERGE MARKDOWN PAGE ──
  console.log('\n📱 Navigating to Merge Markdown...');
  await page.goto(`${BASE_URL}/merge-markdown`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await capture(page, '04_merge_empty', 'Merge — empty state + mobile toolbar');
  await captureFullPage(page, '04_merge_empty_full', 'Merge — full empty page');

  // Scroll down to see sticky bar
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  await page.waitForTimeout(1000);
  await capture(page, '04b_merge_sticky_bar', 'Merge — sticky bottom action bar visible');

  // ── 5. HELP PAGE ──
  console.log('\n📱 Navigating to Help...');
  await page.goto(`${BASE_URL}/help`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await capture(page, '05_help_top', 'Help page — viewport top');
  await captureFullPage(page, '05_help', 'Help page — full scroll');

  // ── 6. ABOUT PAGE ──
  console.log('\n📱 Navigating to About...');
  await page.goto(`${BASE_URL}/about`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await capture(page, '06_about_top', 'About page — viewport top');
  await captureFullPage(page, '06_about', 'About page — full scroll');

  // ── 7. 404 PAGE ──
  console.log('\n📱 Testing 404 page...');
  await page.goto(`${BASE_URL}/this-does-not-exist`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await capture(page, '07_404', '404 Not Found page');

  // Close context to finish saving video
  await context.close();

  // ── 8. TABLET viewport (768px iPad) ──
  console.log('\n📱 Testing iPad viewport...');
  const ipadContext = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: true
  });
  const ipadPage = await ipadContext.newPage();
  
  await ipadPage.goto(`${BASE_URL}/`);
  await ipadPage.waitForLoadState('networkidle');
  await capture(ipadPage, '08_ipad_home', 'Homepage — iPad 768px (2-column grid)');

  await ipadPage.goto(`${BASE_URL}/merge-markdown`);
  await ipadPage.waitForLoadState('networkidle');
  await capture(ipadPage, '09_ipad_merge', 'Merge — iPad 768px (sidebar appears)');

  await ipadContext.close();
  await browser.close();
  
  console.log('\n🎉 All screenshots and recordings captured successfully!');
  console.log(`📁 Screenshots saved to: ${SCREENSHOTS_DIR}`);
  console.log(`📁 Video saved to: ${RECORDINGS_DIR}`);
  
  // Find the video file and rename/copy it to a standard name
  const files = fs.readdirSync(RECORDINGS_DIR);
  const videoFile = files.find(f => f.endsWith('.webm'));
  if (videoFile) {
    const oldPath = path.join(RECORDINGS_DIR, videoFile);
    const newPath = path.join(RECORDINGS_DIR, 'mobile_walkthrough.webm');
    fs.renameSync(oldPath, newPath);
    console.log(`🎥 Walkthrough video renamed to: ${newPath}`);
  }
})();
