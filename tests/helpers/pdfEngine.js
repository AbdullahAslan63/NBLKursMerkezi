import puppeteer from 'puppeteer';

/** Puppeteer Chrome kurulu mu — integration testler için */
export async function isPdfEngineAvailable() {
  try {
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    const browser = await puppeteer.launch(launchOptions);
    await browser.close();
    return true;
  } catch {
    return false;
  }
}
