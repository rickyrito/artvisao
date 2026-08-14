#!/usr/bin/env node
// Copy SVG/PNG/JPG files from assets/brands/fetched/ to assets/brands/
// Usage:
//   node scripts/apply-fetched-logos.js         # copies files (backs up existing)
//   node scripts/apply-fetched-logos.js --report # only lists files and what would be done

import fs from 'fs/promises';
import path from 'path';
import { resolveFromScript, ensureDir, exists } from './lib/fs-utils.js';

const fetchedDir = resolveFromScript(import.meta.url, 'assets', 'brands', 'fetched');
const targetDir = resolveFromScript(import.meta.url, 'assets', 'brands');
const backupBase = path.join(targetDir, 'backup');

const args = process.argv.slice(2);
const reportOnly = args.includes('--report') || args.includes('-r');

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function listFetched() {
  try {
    const items = await fs.readdir(fetchedDir);
    return items.filter(f => /\.(svg|png|jpe?g)$/i.test(f));
  } catch (e) {
    return [];
  }
}

async function run() {
  const found = await listFetched();
  if (found.length === 0) {
    console.log('No fetched logos found in', fetchedDir);
    return;
  }
  console.log('Found', found.length, 'fetched files:');
  found.forEach(f => console.log(' -', f));

  const report = [];

  for (const file of found) {
    const src = path.join(fetchedDir, file);
    const dest = path.join(targetDir, file);
    const destExists = await exists(dest);

    if (reportOnly) {
      report.push({ file, action: destExists ? 'would-backup-and-replace' : 'would-copy' });
      continue;
    }

    if (destExists) {
      const backupDir = path.join(backupBase, nowStamp());
      await ensureDir(backupDir);
      const backupPath = path.join(backupDir, file);
      await fs.copyFile(dest, backupPath);
      console.log('Backed up', dest, '->', backupPath);
    }
    await fs.copyFile(src, dest);
    console.log('Copied', src, '->', dest);
    report.push({ file, action: destExists ? 'backed-up-and-replaced' : 'copied' });
  }

  console.log('\nReport:');
  report.forEach(r => console.log(r.file + ' -> ' + r.action));
  if (!reportOnly) console.log('\nBackups (if any) are in', backupBase);
}

run().catch(err => { console.error(err); process.exit(1); });
