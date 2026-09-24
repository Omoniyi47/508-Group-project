import { env } from '../config/env.js';

// Render's Node runtime (and most minimal Linux containers) lack the shared
// libraries a locally-downloaded Chromium needs to launch, so the full
// `puppeteer` package's bundled browser only works in local development.
// In production we drive `puppeteer-core` against `@sparticuz/chromium`'s
// binary instead, which is built for exactly this kind of constrained
// container. Both browser packages are loaded dynamically so neither one
// has to be installed in every environment.
async function launchBrowser() {
  if (env.isProduction) {
    const [{ default: chromium }, { default: puppeteerCore }] = await Promise.all([
      import('@sparticuz/chromium'),
      import('puppeteer-core'),
    ]);
    // Matches @sparticuz/chromium's own documented usage: this version doesn't
    // expose `defaultViewport`/`headless` properties, so `headless: 'shell'` is
    // passed explicitly and merged into the launch args via puppeteer-core's helper.
    return puppeteerCore.launch({
      args: await puppeteerCore.defaultArgs({ args: chromium.args, headless: 'shell' }),
      executablePath: await chromium.executablePath(),
      headless: 'shell',
    });
  }
  const { default: puppeteer } = await import('puppeteer');
  return puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
}

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchBrowser();
  }

  const browser = await browserPromise;
  if (!browser.connected) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}

export async function renderHtmlToPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({ format: 'A4', printBackground: true });
  } finally {
    await page.close();
  }
}

export async function closePdfBrowser() {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser.close();
}
