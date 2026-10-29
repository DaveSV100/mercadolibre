# CLAUDE.md

Automatic Mercado Libre affiliate deals site (InfiniOfertas, ofertas.infinistart.com). Zero-dependency Node 22 ESM.

- `scripts/fetch-deals.mjs` – official ML API (category search with discount, then best sellers) + `data/manual.json`
  → `data/deals.json`. Never fails the run. Do not scrape ML web pages: they redirect bots to account-verification.
- `scripts/lib/mlapi.mjs` – client_credentials token from secrets `ML_CLIENT_ID`/`ML_CLIENT_SECRET`, item/product mapping.
- `scripts/build.mjs` – static site → `dist/` (`--sample` uses `samples/`, noindex, never deploy).
- `scripts/post-telegram.mjs` – posts to Telegram from env secrets; state in `data/posted.json`.
- `.github/workflows/update.yml` – every 2 h on `main`: test → fetch → build → Pages deploy → Telegram → commit data.
- Config: `site.config.json`. User-facing site text is Spanish; owner talks in English.

Checks: `npm test`, `node scripts/build.mjs --sample`. The Claude cloud sandbox cannot reach mercadolibre.com.* unless
the domain is allowed in the environment's network settings, so API changes are verified by running the workflow
and reading its logs.

The owner is non-technical: when they ask to add a product, append to `data/manual.json` (title/price/image can be
given by hand so no fetch is needed); affiliate short links go in `data/affiliate-links.json`.
