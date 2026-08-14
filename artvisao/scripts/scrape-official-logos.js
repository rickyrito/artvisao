// Script to crawl official brand homepages and attempt to download logo images
// Usage: node scripts/scrape-official-logos.js
// Requires Node 18+ (fetch available)

import fs from 'fs/promises';
import path from 'path';
import { resolveFromScript, ensureDir, exists } from './lib/fs-utils.js';

const outDir = resolveFromScript(import.meta.url, 'assets', 'brands', 'fetched');

const brands = [
  { slug: 'prada', domains: ['https://www.prada.com', 'https://prada.com'] },
  { slug: 'persol', domains: ['https://www.persol.com', 'https://persol.com'] },
  { slug: 'ray-ban', domains: ['https://www.ray-ban.com', 'https://www.rayban.com', 'https://www.ray-ban.com'] },
  { slug: 'police', domains: ['https://www.police.it', 'https://www.police.com'] },
  { slug: 'eschenbach', domains: ['https://www.eschenbach.com', 'https://eschenbach.com'] },
  { slug: 'titan-flex', domains: ['https://www.titanflex.com', 'https://titan-flex.com', 'https://titanflex.com'] },
  { slug: 'hoya', domains: ['https://www.hoya.com', 'https://hoya.com'] },
  { slug: 'persol', domains: ['https://www.persol.com'] },
  { slug: 'new-balance', domains: ['https://www.newbalance.com', 'https://newbalance.com'] },
  { slug: 'converse', domains: ['https://www.converse.com'] },
  { slug: 'maui-jim', domains: ['https://www.mauijim.com'] },
  { slug: 'oakley', domains: ['https://www.oakley.com'] }
];

function absoluteUrl(candidate, base) {
  try { return new URL(candidate, base).toString(); } catch (e) { return null; }
}

function extractCandidates(html, base) {
  const candidates = new Set();

  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogMatch) candidates.add(absoluteUrl(ogMatch[1], base));

  const linkRe = /<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["']/ig;
  let m;
  while ((m = linkRe.exec(html))) candidates.add(absoluteUrl(m[1], base));

  // images whose src, alt, class or id hints at being a logo
  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/ig;
  while ((m = imgRe.exec(html))) {
    const tag = m[0].toLowerCase();
    const src = m[1];
    if (/logo|brand|logotype|logomark/.test(tag) || /logo|brand/.test(src)) {
      candidates.add(absoluteUrl(src, base));
    }
  }

  const dataSrcRe = /data-src=["']([^"']+)["']/ig;
  while ((m = dataSrcRe.exec(html))) candidates.add(absoluteUrl(m[1], base));

  return Array.from(candidates).filter(Boolean);
}

function extensionFor(contentType, url) {
  if (contentType.includes('svg')) return '.svg';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
  const matchExt = url.match(/\.(svg|png|jpe?g)(?:\?|$)/i);
  return matchExt ? '.' + matchExt[1] : '.bin';
}

async function tryDownload(url, outPathNoExt) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return false;

    const finalPath = outPathNoExt + extensionFor(res.headers.get('content-type') || '', url);
    if (await exists(finalPath)) {
      console.log('Exists, skip', finalPath);
      return true;
    }

    const buffer = await res.arrayBuffer();
    await fs.writeFile(finalPath, Buffer.from(buffer));
    console.log('Downloaded', url, '->', finalPath);
    return true;
  } catch (e) {
    return false;
  }
}

async function run() {
  await ensureDir(outDir);
  const results = [];

  for (const b of brands) {
    console.log('\nBrand:', b.slug);
    let got = false;
    for (const domain of b.domains) {
      console.log(' Fetching', domain);
      try {
        const res = await fetch(domain, { cache: 'no-store' });
        if (!res.ok) { console.log('  Status', res.status); continue; }

        const html = await res.text();
        const candidates = extractCandidates(html, domain);
        console.log('  Candidates found:', candidates.length);

        for (const c of candidates) {
          const safeName = b.slug + (c.includes('?') ? '-' + Math.random().toString(36).slice(2, 6) : '');
          const outPath = path.join(outDir, safeName);
          if (await tryDownload(c, outPath)) { got = true; break; }
        }
        if (got) break;
      } catch (e) {
        console.log('  Error fetching', domain, e.message);
      }
    }
    results.push({ brand: b.slug, found: got });
  }

  console.log('\nSummary:');
  results.forEach(r => console.log(r.brand, '->', r.found ? 'found' : 'missing'));
}

run().catch(e => { console.error(e); process.exit(1); });
