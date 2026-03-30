import mammoth from "mammoth";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

function wrapPrintHtml(body: string): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: Georgia, "Times New Roman", serif; font-size: 11pt; color: #111; line-height: 1.45; }
  table { border-collapse: collapse; width: 100%; margin: 0.75em 0; }
  td, th { border: 1px solid #555; padding: 5px 7px; vertical-align: top; }
  p { margin: 0.4em 0; }
</style></head><body>${body}</body></html>`;
}

async function resolveExecutablePath(): Promise<string> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return await chromium.executablePath();
  }
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  return await chromium.executablePath();
}

/**
 * Konvertiert DOCX zu PDF (Mammoth → HTML → Chromium).
 */
export async function docxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  const { value: html } = await mammoth.convertToHtml({ buffer: docxBuffer });
  const full = wrapPrintHtml(html);
  const executablePath = await resolveExecutablePath();
  const useBundledChromium =
    process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME;
  const launchArgs = useBundledChromium
    ? chromium.args
    : ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];

  const browser = await puppeteer.launch({
    executablePath,
    args: launchArgs,
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(full, { waitUntil: "networkidle0", timeout: 60_000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
