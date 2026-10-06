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
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

/* global document, getComputedStyle */

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
  {
    src: 'fh-qa-contractor-agreement.html',
    out: 'qa-contractor-agreement.pdf',
    outDir: 'documents/qa',
    margin: { top: '15mm', bottom: '16mm', left: 0, right: 0 },
    footerTitle: 'QA Contractor Agreement',
    // It forces the schedules onto a new page, which the stretch below
    // cannot see, so it would add a blank last page.
    noStretch: true,
    fillable: true,
  },
  {
    src: 'fh-qa-contractor-notice-to-end.html',
    out: 'qa-contractor-notice-to-end.pdf',
    outDir: 'documents/qa',
    margin: { top: '15mm', bottom: '16mm', left: 0, right: 0 },
    footerTitle: 'Notice to End',
    noStretch: true,
    fillable: true,
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
  // Contract sources are gitignored (they hold personal details), so a fresh
  // clone will not have them.
  if (!fs.existsSync(path.join(root, 'scripts/doc-src', d.src))) {
    console.warn('skipped', d.src, '(local-only source not found)');
    continue;
  }
  await page.goto('file://' + path.join(root, 'scripts/doc-src', d.src), {
    waitUntil: 'networkidle',
  });
  if (d.footerTitle && !d.noStretch) {
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
  const out = path.join(outDir, d.out);
  const pdfOptions = {
    ...(d.pageSize ? d.pageSize : { format: 'A4' }),
    landscape: d.landscape ?? false,
    printBackground: true,
    margin: d.margin ?? { top: 0, bottom: 0, left: 0, right: 0 },
    displayHeaderFooter: Boolean(d.footerTitle),
    headerTemplate: '<span></span>',
    footerTemplate: d.footerTitle ? foot(d.footerTitle) : undefined,
  };
  if (d.fillable) {
    const fields = await markFields(page);
    const spots = await locateMarkers(await page.pdf(pdfOptions));
    // The markers sit outside the layout, so removing them moves nothing,
    // and the final PDF carries no stray marker text.
    await page.evaluate(() =>
      document.querySelectorAll('[data-marker]').forEach((m) => m.remove()),
    );
    await page.pdf({ ...pdfOptions, path: out });
    await addFormFields(out, fields, spots);
  } else {
    await page.pdf({ ...pdfOptions, path: out });
  }
  console.log('rendered', path.relative(root, path.join(outDir, d.out)));
}
await browser.close();

// Chrome prints form blanks as plain lines. To make them typeable, each
// [data-field] element gets an invisible marker word at its bottom-left
// corner; after printing we find where the markers landed on the page and
// lay a real form field over each blank. Needs poppler's pdftotext.
async function markFields(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-field]')].map((el, i) => {
      const r = el.getBoundingClientRect();
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      const m = document.createElement('span');
      m.dataset.marker = '';
      m.textContent = `FHFIELD${i}X`;
      m.style.cssText =
        'position:absolute;left:0;bottom:0;font:4px/1 Arial;color:rgba(0,0,0,0.01);white-space:nowrap';
      el.appendChild(m);
      return {
        name: el.dataset.field,
        type: el.dataset.type,
        value: el.dataset.value,
        width: r.width,
        height: r.height,
      };
    }),
  );
}

async function locateMarkers(pdfBytes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-docs-'));
  const tmp = path.join(dir, 'markers.pdf');
  fs.writeFileSync(tmp, pdfBytes);
  let html;
  try {
    html = execFileSync('pdftotext', ['-bbox', tmp, '-'], { encoding: 'utf8' });
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error('pdftotext not found: brew install poppler');
    throw err;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const spots = new Map();
  html
    .split('<page ')
    .slice(1)
    .forEach((chunk, pageIndex) => {
      for (const w of chunk.matchAll(
        /xMin="([\d.]+)" yMin="[\d.]+" xMax="[\d.]+" yMax="([\d.]+)">FHFIELD(\d+)X</g,
      )) {
        spots.set(Number(w[3]), { pageIndex, x: Number(w[1]), yBottom: Number(w[2]) });
      }
    });
  return spots;
}

async function addFormFields(file, fields, spots) {
  const pdf = await PDFDocument.load(fs.readFileSync(file));
  const form = pdf.getForm();
  const pt = 0.75; // css px to pdf points
  fields.forEach((f, i) => {
    const spot = spots.get(i);
    if (!spot) throw new Error(`form field ${f.name} not found in ${file}`);
    const page = pdf.getPage(spot.pageIndex);
    const y = page.getHeight() - spot.yBottom;
    if (f.type === 'checkbox') {
      const box = form.createCheckBox(f.name);
      box.addToPage(page, { x: spot.x, y, width: f.width * pt, height: f.height * pt });
      if (f.value) {
        box.check();
        box.enableReadOnly();
      }
      return;
    }
    const height = Math.max(f.height * pt, 14);
    const field = form.createTextField(f.name);
    if (f.height > 40) field.enableMultiline();
    field.addToPage(page, {
      x: spot.x,
      y,
      width: f.width * pt,
      height,
      borderWidth: 0,
      backgroundColor: undefined,
    });
    field.setFontSize(9);
    // A pre-filled value is part of the agreed terms, so it is locked.
    if (f.value) {
      field.setText(f.value);
      field.enableReadOnly();
    }
  });
  fs.writeFileSync(file, await pdf.save());
}
