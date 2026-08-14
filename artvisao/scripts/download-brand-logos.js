// Script para descarregar SVGs de Simple Icons e guardá-los em assets/brands/
// Requisitos: Node.js 18+ (inclui fetch nativo) ou adapte para usar node-fetch

import fs from 'fs/promises';
import path from 'path';
import { resolveFromScript, ensureDir, exists } from './lib/fs-utils.js';

const outDir = resolveFromScript(import.meta.url, 'assets', 'brands', 'fetched');

const brands = [
  { name: 'Eschenbach', slugs: ['eschenbach'] },
  { name: 'TitanFlex', slugs: ['titanflex', 'titan-flex'] },
  { name: 'Hoya', slugs: ['hoya'] },
  { name: 'Prada', slugs: ['prada'] },
  { name: 'Persol', slugs: ['persol'] },
  { name: 'Ray-Ban', slugs: ['rayban', 'ray-ban'] },
  { name: 'Police', slugs: ['police'] },
  { name: 'Carolina Herrera', slugs: ['carolina-herrera', 'carolinaherrera'] },
  { name: 'New Balance', slugs: ['newbalance', 'new-balance'] },
  { name: 'Converse', slugs: ['converse'] },
  { name: 'Maui Jim', slugs: ['mauijim', 'maui-jim'] },
  { name: 'Oakley', slugs: ['oakley'] }
];

async function tryFetch(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const text = await res.text();
    return text && text.includes('<svg') ? text : null;
  } catch (e) {
    return null;
  }
}

async function run() {
  await ensureDir(outDir);
  const found = [];
  const failed = [];

  for (const b of brands) {
    let saved = false;
    for (const s of b.slugs) {
      const url = `https://cdn.simpleicons.org/${s}`;
      console.log('Trying', url);
      const svg = await tryFetch(url);
      if (!svg) continue;

      const outPath = path.join(outDir, `${s}.svg`);
      if (await exists(outPath)) {
        console.log('Already exists, skipping', outPath);
        found.push({ brand: b.name, slug: s, path: outPath, skipped: true });
      } else {
        await fs.writeFile(outPath, svg, 'utf8');
        console.log('Saved', outPath);
        found.push({ brand: b.name, slug: s, path: outPath });
      }
      saved = true;
      break;
    }
    if (!saved) {
      console.log('Not found on CDN for', b.name);
      failed.push(b.name);
    }
  }

  console.log('\nSummary:');
  console.log('Found:', found.map(f => `${f.brand} -> ${f.slug}`).join(', ') || 'none');
  console.log('Missing:', failed.join(', ') || 'none');
}

run().catch(err => { console.error(err); process.exit(1); });
