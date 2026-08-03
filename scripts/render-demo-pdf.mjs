// Renders scripts/demo-src/whats-shipped.src.html to
// documents/demo/whats-shipped.pdf (the committed artefact — docs
// folders are PDF-only per founder request, FHS-552).
//
// Usage: node scripts/render-demo-pdf.mjs
// Requires tests/e2e dependencies installed (pnpm install).
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
const requireE2e = createRequire(path.join(root, 'tests/e2e/package.json'));
const { chromium } = requireE2e('@playwright/test');

const src = path.join(root, 'scripts/demo-src/whats-shipped.src.html');
const out = path.join(root, 'documents/demo/whats-shipped.pdf');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + src, { waitUntil: 'networkidle' });
await page.pdf({
  path: out,
  format: 'A4',
  printBackground: true,
  margin: { top: '8mm', bottom: '8mm', left: '6mm', right: '6mm' },
});
await browser.close();
console.log('rendered', path.relative(root, out));
