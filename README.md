# artvisao

Quick commands for updating brand logos

- Download candidates from Simple Icons CDN:

```bash
node scripts/download-brand-logos.js
```

- Scrape official brand homepages for logo images:

```bash
node scripts/scrape-official-logos.js
```

- Review what would be applied (no changes):

```bash
node scripts/apply-fetched-logos.js --report
```

- Apply fetched logos into `assets/brands/` (creates backups):

```bash
node scripts/apply-fetched-logos.js
```

Notes:
- Use Node 18+ for native `fetch` support. If using an older Node, run these scripts with a compatible runtime or install a fetch polyfill.
- Placed logos are expected under `assets/brands/fetched/` and will be copied to `assets/brands/` when applied.
