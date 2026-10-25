# CLAUDE.md

Automatic Mercado Libre affiliate deals site (InfiniOfertas, ofertas.infinistart.com). Zero-dependency Node 22 ESM.

- `scripts/fetch-deals.mjs` – scrapes `/ofertas` listing pages + `data/manual.json` → `data/deals.json`. Never fails the run.
- `scripts/lib/mercadolibre.mjs` – HTML parsers (poly-card layout). Fixture + tests in `test/`.
- `scripts/build.mjs` – static site → `dist/` (`--sample` uses `samples/`, noindex, never deploy).
- `scripts/post-telegram.mjs` – posts to Telegram from env secrets; state in `data/posted.json`.
- `.github/workflows/update.yml` – every 2 h on `main`: test → fetch → build → Pages deploy → Telegram → commit data.
- Config: `site.config.json`. User-facing site text is Spanish; owner talks in English.

Checks: `npm test`, `node scripts/build.mjs --sample`. The Claude cloud sandbox cannot reach mercadolibre.com.* unless
the domain is allowed in the environment's network settings, so scraper changes are verified against fixtures.

The owner is non-technical: when they ask to add a product, append to `data/manual.json` (title/price/image can be
given by hand so no fetch is needed); affiliate short links go in `data/affiliate-links.json`.
