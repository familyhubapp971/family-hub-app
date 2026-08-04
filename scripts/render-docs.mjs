// Renders every business-doc source in scripts/doc-src/ to its PDF in
// documents/business/ (docs folders are PDF-only, FHS-552).
//
// Usage: node scripts/render-docs.mjs
// The flowing docs (theory-of-change, impact framework) get a printed
// running footer on every page; the paged docs carry their own footers.
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/* global document */

const root = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
const requireE2e = createRequire(path.join(root, 'tests/e2e/package.json'));
const { chromium } = requireE2e('@playwright/test');

const foot = (title) => `
  <div style="width:100%; font-family:Nunito,Arial,sans-serif; font-size:7px;
    font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:#555;
    padding:0 15mm 6mm; display:flex; justify-content:space-between;">
    <span>Family Hub &middot; ${title}</span>
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;

const DOCS = [
  { src: 'family-hub-qa-brief-overview.html', out: 'family-hub-qa-brief-overview.pdf' },
  { src: 'family-hub-qa-brief-feature-tour.html', out: 'family-hub-qa-brief-feature-tour.pdf' },
  {
    src: 'theory-of-change.html',
    out: 'theory-of-change.pdf',
    margin: { top: '15mm', bottom: '16mm', left: 0, right: 0 },
    footerTitle: 'Theory of Change',
  },
  {
    src: 'impact-measurement-framework.html',
    out: 'impact-measurement-framework.pdf',
    margin: { top: '15mm', bottom: '16mm', left: 0, right: 0 },
    footerTitle: 'Impact Measurement Framework',
  },
  { src: 'business-model-canvas.html', out: 'business-model-canvas.pdf', landscape: true },
  {
    src: 'family-hub-pitch-deck.html',
    out: 'family-hub-pitch-deck.pdf',
    pageSize: { width: '338.66mm', height: '190.5mm' },
  },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const d of DOCS) {
  await page.goto('file://' + path.join(root, 'scripts/doc-src', d.src), {
    waitUntil: 'networkidle',
  });
  if (d.footerTitle) {
    // Flowing docs: stretch the body to a whole number of printed pages
    // and push the in-document <footer> endnote to the last page bottom.
    await page.evaluate(() => {
      const mm = 3.7795275591; // css px per mm at 96dpi
      const perPage = (297 - 15 - 16) * mm;
      document.body.style.display = 'flex';
      document.body.style.flexDirection = 'column';
      const foot = document.querySelector('footer');
      if (foot) foot.style.marginTop = 'auto';
      const pages = Math.max(1, Math.ceil(document.body.scrollHeight / perPage));
      document.body.style.minHeight = `${pages * perPage - 6}px`;
    });
  }
  await page.pdf({
    path: path.join(root, 'documents/business', d.out),
    ...(d.pageSize ? d.pageSize : { format: 'A4' }),
    landscape: d.landscape ?? false,
    printBackground: true,
    margin: d.margin ?? { top: 0, bottom: 0, left: 0, right: 0 },
    displayHeaderFooter: Boolean(d.footerTitle),
    headerTemplate: '<span></span>',
    footerTemplate: d.footerTitle ? foot(d.footerTitle) : undefined,
  });
  console.log('rendered', d.out);
}
await browser.close();
