// Script to crawl official brand homepages and attempt to download logo images
// Usage: node scripts/scrape-official-logos.js
// Requires Node 18+ (fetch available)

import fs from 'fs/promises';
import path from 'path';

const outDir = new URL('../assets/brands/fetched/', import.meta.url).pathname.replace(/^\/+([A-Za-z]:)?/, (m)=>m);

const brands = [
  { slug: 'prada', domains: ['https://www.prada.com','https://prada.com'] },
  { slug: 'persol', domains: ['https://www.persol.com','https://persol.com'] },
  { slug: 'ray-ban', domains: ['https://www.ray-ban.com','https://www.rayban.com','https://www.ray-ban.com'] },
  { slug: 'police', domains: ['https://www.police.it','https://www.police.com'] },
  { slug: 'eschenbach', domains: ['https://www.eschenbach.com','https://eschenbach.com'] },
  { slug: 'titan-flex', domains: ['https://www.titanflex.com','https://titan-flex.com','https://titanflex.com'] },
  { slug: 'hoya', domains: ['https://www.hoya.com','https://hoya.com'] },
  { slug: 'persol', domains: ['https://www.persol.com'] },
  { slug: 'new-balance', domains: ['https://www.newbalance.com','https://newbalance.com'] },
  { slug: 'converse', domains: ['https://www.converse.com'] },
  { slug: 'maui-jim', domains: ['https://www.mauijim.com'] },
  { slug: 'oakley', domains: ['https://www.oakley.com'] }
];

async function ensureDir(dir){
  try{ await fs.mkdir(dir, { recursive: true }); } catch(e){}
}

function absoluteUrl(candidate, base){
  try{ return new URL(candidate, base).toString(); }catch(e){return null}
}

function extractCandidates(html, base){
  const candidates = new Set();
  // og:image
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogMatch) candidates.add(absoluteUrl(ogMatch[1], base));
  // link rel icons
  const linkRe = /<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["']/ig;
  let m;
  while ((m = linkRe.exec(html))){ candidates.add(absoluteUrl(m[1], base)); }
  // images with logo in src, alt, class or id
  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/ig;
  while ((m = imgRe.exec(html))){
    const tag = m[0].toLowerCase();
    const src = m[1];
    if (/logo|brand|logotype|logomark/.test(tag) || /logo|brand/.test(src)){
      candidates.add(absoluteUrl(src, base));
    }
  }
  // look for svg inline references (data-src etc)
  const dataSrcRe = /data-src=["']([^"']+)["']/ig;
  while ((m = dataSrcRe.exec(html))){ candidates.add(absoluteUrl(m[1], base)); }
  return Array.from(candidates).filter(Boolean);
}

async function tryDownload(url, outPath){
  try{
    const res = await fetch(url, {cache: 'no-store'});
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') || '';
    let ext = '';
    if (ct.includes('svg')) ext = '.svg';
    else if (ct.includes('png')) ext = '.png';
    else if (ct.includes('jpeg') || ct.includes('jpg')) ext = '.jpg';
    else {
      // try extension from url
      const matchExt = url.match(/\.(svg|png|jpe?g)(?:\?|$)/i);
      if (matchExt) ext = '.' + matchExt[1];
      else ext = '.bin';
    }
    const finalPath = outPath + ext;
    // do not overwrite
    try{ await fs.access(finalPath); console.log('Exists, skip', finalPath); return true; } catch(e){}
    const buffer = await res.arrayBuffer();
    await fs.writeFile(finalPath, Buffer.from(buffer));
    console.log('Downloaded', url, '->', finalPath);
    return true;
  }catch(e){ return false; }
}

async function run(){
  await ensureDir(outDir);
  const results = [];
  for (const b of brands){
    console.log('\nBrand:', b.slug);
    let got = false;
    for (const domain of b.domains){
      console.log(' Fetching', domain);
      try{
        const res = await fetch(domain, {cache: 'no-store'});
        if (!res.ok){ console.log('  Status', res.status); continue; }
        const html = await res.text();
        const cands = extractCandidates(html, domain);
        console.log('  Candidates found:', cands.length);
        for (const c of cands){
          const safeName = b.slug + (c.includes('?')? '-' + Math.random().toString(36).slice(2,6): '');
          const outPath = path.join(outDir, safeName);
          const ok = await tryDownload(c, outPath);
          if (ok){ got = true; break; }
        }
        if (got) break;
      }catch(e){ console.log('  Error fetching', domain, e.message); }
    }
    results.push({brand: b.slug, found: got});
  }
  console.log('\nSummary:');
  results.forEach(r=> console.log(r.brand, '->', r.found ? 'found' : 'missing'));
}

run().catch(e=>{ console.error(e); process.exit(1); });
