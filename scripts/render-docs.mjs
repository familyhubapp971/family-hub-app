// Renders every doc source in scripts/doc-src/ to its PDF under documents/
// (docs folders are PDF-only, FHS-552), each one filed by what it is for:
//
//   documents/business/     the pitch and the business model
//   documents/commercial/   the commercial case (tracked in git)
//   documents/impact/       theory of change and impact measurement
//   documents/investments/  investor and accelerator applications
//   documents/qa/           briefs for testers
//
// Only commercial/ is committed. The rest are gitignored and land locally
// for the founder to share, as are their folders.
//
// Usage: node scripts/render-docs.mjs
// The flowing docs (theory-of-change, impact framework) get a printed
// running footer on every page; the paged docs carry their own footers.
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import fs from 'fs';
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
  // Briefs for testers.
  { src: 'fh-beta-tester-brief.html', out: 'beta-tester-brief.pdf', outDir: 'documents/qa' },
  { src: 'fh-qa-brief-overview.html', out: 'qa-brief-overview.pdf', outDir: 'documents/qa' },
  {
    src: 'fh-qa-brief-feature-tour.html',
    out: 'qa-brief-feature-tour.pdf',
    outDir: 'documents/qa',
  },
  // What good we set out to do, and how we would know.
  {
    src: 'fh-theory-of-change.html',
    out: 'theory-of-change.pdf',
    outDir: 'documents/impact',
    margin: { top: '15mm', bottom: '16mm', left: 0, right: 0 },
    footerTitle: 'Theory of Change',
  },
  {
    src: 'fh-impact-measurement-framework.html',
    out: 'impact-measurement-framework.pdf',
    outDir: 'documents/impact',
    margin: { top: '15mm', bottom: '16mm', left: 0, right: 0 },
    footerTitle: 'Impact Measurement Framework',
  },
  // The business itself.
  {
    src: 'fh-business-model-canvas.html',
    out: 'business-model-canvas.pdf',
    outDir: 'documents/business/model-canvases',
    landscape: true,
  },
  {
    src: 'fh-business-model-canvas-hub71.html',
    out: 'business-model-canvas-hub71.pdf',
    outDir: 'documents/business/model-canvases',
    landscape: true,
  },
  {
    src: 'fh-pitch-deck.html',
    out: 'pitch-deck.pdf',
    outDir: 'documents/business/pitch-decks',
    pageSize: { width: '338.66mm', height: '190.5mm' },
  },
  {
    src: 'fh-pitch-deck-hub71.html',
    out: 'pitch-deck-hub71.pdf',
    outDir: 'documents/business/pitch-decks',
    pageSize: { width: '338.66mm', height: '190.5mm' },
  },
  // Commercial case: concise one-page briefs with their own footers.
  {
    src: 'fh-commercial-where-we-fit.html',
    out: 'where-we-fit.pdf',
    outDir: 'documents/commercial',
  },
  {
    src: 'fh-commercial-product-market-fit.html',
    out: 'product-market-fit.pdf',
    outDir: 'documents/commercial',
  },
  {
    src: 'fh-commercial-go-to-market.html',
    out: 'go-to-market.pdf',
    outDir: 'documents/commercial',
  },
  {
    src: 'fh-hub71-answers.html',
    out: 'family-hub-hub71-answers.pdf',
    outDir: 'documents/investments',
    margin: { top: '12mm', bottom: '14mm', left: 0, right: 0 },
    footerTitle: 'Hub71 application',
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
  const outDir = path.join(root, d.outDir ?? 'documents/business');
  fs.mkdirSync(outDir, { recursive: true });
  await page.pdf({
    path: path.join(outDir, d.out),
    ...(d.pageSize ? d.pageSize : { format: 'A4' }),
    landscape: d.landscape ?? false,
    printBackground: true,
    margin: d.margin ?? { top: 0, bottom: 0, left: 0, right: 0 },
    displayHeaderFooter: Boolean(d.footerTitle),
    headerTemplate: '<span></span>',
    footerTemplate: d.footerTitle ? foot(d.footerTitle) : undefined,
  });
  console.log('rendered', path.relative(root, path.join(outDir, d.out)));
}
await browser.close();
