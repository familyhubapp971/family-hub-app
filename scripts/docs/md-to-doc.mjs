// Turns a strategy note (Markdown) into a house-style HTML page for
// render-docs.mjs, so the note stays the single source and its PDF can
// never drift from it. Covers only what our notes use: headings, the bold
// meta block, paragraphs, quotes, lists, tables, rules, and inline bold,
// italic, code and links.
import fs from 'node:fs';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(text) {
  const codes = [];
  let s = esc(text).replace(/`([^`]+)`/g, (_, c) => `\uE000${codes.push(c) - 1}\uE000`);
  s = s
    .replace(/\\([[\]])/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])_([^_]+)_(?=[^\w]|$)/g, '$1<em>$2</em>');
  return s.replace(/\uE000(\d+)\uE000/g, (_, i) => `<code>${codes[i]}</code>`);
}

const isTable = (l) => l.trim().startsWith('|');
const isQuote = (l) => l.startsWith('>');
const listMark = (l) => l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
const cells = (l) =>
  l
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

function blocks(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (/^---+\s*$/.test(line)) {
      out.push('<hr />');
      i++;
    } else if (/^#{1,4}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length;
      out.push(`<h${level}>${inline(line.replace(/^#+\s*/, ''))}</h${level}>`);
      i++;
    } else if (isTable(line)) {
      const rows = [];
      while (i < lines.length && isTable(lines[i])) rows.push(lines[i++]);
      const [head, , ...body] = rows;
      out.push(
        '<div class="table"><table><thead><tr>' +
          cells(head)
            .map((c) => `<th>${inline(c)}</th>`)
            .join('') +
          '</tr></thead><tbody>' +
          body
            .map(
              (r) =>
                '<tr>' +
                cells(r)
                  .map((c) => `<td>${inline(c)}</td>`)
                  .join('') +
                '</tr>',
            )
            .join('') +
          '</tbody></table></div>',
      );
    } else if (isQuote(line)) {
      const q = [];
      while (i < lines.length && isQuote(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`);
    } else if (listMark(line)) {
      const ordered = /\d/.test(listMark(line)[2]);
      const items = [];
      while (i < lines.length && lines[i].trim()) {
        const m = listMark(lines[i]);
        if (m && !m[1]) items.push(m[3]);
        else items[items.length - 1] += ' ' + lines[i].trim();
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${tag}>`);
    } else {
      const para = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#|---|>|\|)/.test(lines[i]) &&
        !listMark(lines[i])
      )
        para.push(lines[i++]);
      // The bold "Status: / Updated:" block keeps one fact per line.
      const meta = para.every((l) => /^\*\*[^*]+:\*\*/.test(l));
      out.push(
        meta
          ? `<p class="meta">${para.map(inline).join('<br />')}</p>`
          : `<p>${inline(para.join(' '))}</p>`,
      );
    }
  }
  return out;
}

// `skip` names H2 or H3 sections left out of the PDF (internal detail a
// reader of the shared PDF does not need); the note itself keeps them.
export function mdToDocHtml(file, skip = []) {
  let dropLevel = 0;
  const html = blocks(fs.readFileSync(file, 'utf8')).filter((b) => {
    const level = Number(b.match(/^<h([23])>/)?.[1] ?? 0);
    if (level && (!dropLevel || level <= dropLevel)) {
      dropLevel = skip.includes(b.replace(/<[^>]+>/g, '')) ? level : 0;
    }
    return !dropLevel;
  });
  const title = html[0].replace(/<[^>]+>/g, '');
  // The title and meta block form the purple hero panel.
  const heroEnd = html[1]?.startsWith('<p class="meta">') ? 2 : 1;
  const hero = html.slice(0, heroEnd).join('');
  const body = html.slice(heroEnd).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>${title}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;500;600;700;800;900&display=swap" />
<style>
  :root { --bg:#f6f1fa; --ink:#191919; --soft:#4a4a4a; --rule:#d9ccec; --purple:#3d1065; --yellow:#ffd21e; --tint:#fff6d9; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; width:210mm; background:var(--bg); color:var(--ink);
    font-family:'Nunito',sans-serif; font-weight:500; font-size:11px; line-height:1.6; }
  .page { padding: 4mm 15mm 0; }
  h1, h2, h3, h4 { font-family:'Fredoka One',cursive; font-weight:400; margin:0; break-after:avoid; }
  .hero { background:var(--purple); color:#fff; border:2px solid #000; border-radius:18px;
    box-shadow:5px 5px 0 #000; padding:20px 24px; margin-bottom:8mm; }
  .hero h1 { color:#fff; font-size:28px; line-height:1.15; margin-bottom:12px; }
  .hero .meta { margin:0; font-size:10.5px; color:#e9dcf5; }
  .hero .meta strong { color:var(--yellow); }
  h2 { font-size:19px; margin:6mm 0 9px; padding-bottom:6px; border-bottom:2px solid #000; }
  h3 { font-size:14.5px; margin:16px 0 6px; }
  p { margin:0 0 9px; }
  h3 + p { break-after:avoid; }
  ul, ol { margin:0 0 10px; padding-left:20px; }
  li { margin-bottom:5px; break-inside:avoid; }
  hr { display:none; }
  a { color:inherit; text-decoration:underline; text-decoration-color:#b9a3d6; }
  code { font-family:ui-monospace,Menlo,monospace; font-size:9.5px; background:#ece3f5;
    border-radius:4px; padding:1px 4px; }
  blockquote { background:var(--tint); border:2px solid #000; border-radius:14px;
    box-shadow:3px 3px 0 #000; margin:8px 0 10px; padding:10px 16px; font-size:12px; break-inside:avoid; }
  .table { border:2px solid #000; border-radius:14px; box-shadow:3px 3px 0 #000;
    overflow:hidden; background:#fff; margin:8px 0 14px; break-inside:avoid; }
  table { width:100%; border-collapse:collapse; font-size:10px; }
  th { background:var(--yellow); text-align:left; font-weight:900; padding:7px 10px; border-bottom:2px solid #000; }
  td { padding:7px 10px; border-top:1px solid var(--rule); vertical-align:top; }
  tr { break-inside:avoid; }
</style></head><body><div class="page">
<div class="hero">${hero}</div>
${body}
</div></body></html>`;
}
