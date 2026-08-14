// Shared helpers for the brand-logo scripts (download / scrape / apply).

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export function resolveFromScript(scriptImportMetaUrl, ...segments) {
  var scriptDir = path.dirname(fileURLToPath(scriptImportMetaUrl));
  return path.join(scriptDir, '..', ...segments);
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch (e) {
    return false;
  }
}
