/** Faz 6 — Puppeteer HTML→PDF üretimi (eşzamanlı tek iş) */

import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_VIEWS_DIR = path.join(__dirname, '../views/pdf');

let browserPromise = null;
let queue = Promise.resolve();

/** PDF işlerini sıraya alır — §8 eşzamanlı tek iş kuralı */
export function enqueuePdfJob(fn) {
  const job = queue.then(async () => fn());
  queue = job.catch(() => {});
  return job;
}

async function getBrowser() {
  if (!browserPromise) {
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    browserPromise = puppeteer.launch(launchOptions);
  }
  return browserPromise;
}

export async function renderPdfTemplate(templateName, data) {
  const filePath = path.join(PDF_VIEWS_DIR, `${templateName}.ejs`);
  return ejs.renderFile(filePath, data, { views: [PDF_VIEWS_DIR] });
}

export async function htmlToPdfBuffer(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
    });
  } finally {
    await page.close();
  }
}

export async function generatePdfFromTemplate(templateName, data) {
  const html = await renderPdfTemplate(templateName, data);
  return htmlToPdfBuffer(html);
}

export function pdfContentDisposition(filename) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function closePdfBrowser() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch {
    // Tarayıcı hiç açılmadıysa sessizce geç
  } finally {
    browserPromise = null;
  }
}
