# CLAUDE.md

Automatic Mercado Libre affiliate deals site (InfiniOfertas, ofertas.infinistart.com). Zero-dependency Node 22 ESM.

- `scripts/fetch-deals.mjs` – official ML API (category search with discount, then best sellers) + `data/manual.json`
  → `data/deals.json`. Never fails the run. Do not scrape ML web pages: they redirect bots to account-verification.
- `scripts/lib/mlapi.mjs` – client_credentials token from secrets `ML_CLIENT_ID`/`ML_CLIENT_SECRET`, item/product mapping.
- `scripts/build.mjs` – static site → `dist/` (`--sample` uses `samples/`, noindex, never deploy).
- `scripts/post-telegram.mjs` – posts to Telegram from env secrets; state in `data/posted.json`.
- `.github/workflows/update.yml` – every 2 h on `main`: test → fetch → build → Pages deploy → Telegram → commit data.
- Config: `site.config.json`. The public address comes from GitHub Pages (`SITE_URL` in the workflow); `baseUrl` is
  only the fallback for local builds. User-facing site text is Spanish; owner talks in English.

Checks: `npm test`, `node scripts/build.mjs --sample`. The Claude cloud sandbox cannot reach mercadolibre.com.* unless
the domain is allowed in the environment's network settings, so API changes are verified by running the workflow
and reading its logs.

The owner is non-technical: when they ask to add a product, append to `data/manual.json` (title/price/image can be
given by hand so no fetch is needed); affiliate short links go in `data/affiliate-links.json`.

Official meli.la links can only be made in ML's logged-in link generator (no API). `/enlaces/` (private page) lists the top
deals without one; the owner pastes generated links back, which opens an issue titled "Enlaces de afiliado";
`.github/workflows/save-links.yml` (owner-only) runs `scripts/save-links.mjs` and re-runs the site update.
Telegram posts deals with an official link first; `telegram.onlyOfficialLinks` (off) would post only those.

Coupons: `/publicar/` (private, behind a code whose SHA-256 is `adminCodeSha256`; the code screen only hides the tools,
the real protection is the owner-only check in the workflows) opens an issue titled "Cupón…" or "Quitar cupón";
`.github/workflows/publish-coupon.yml` runs `scripts/save-coupon.mjs` on `data/coupons.json`. The header 🎟️ Cupones
button and `/cupones/` exist only while the coupon post is still valid (through its `expiresAt` day, Mexico City time).
Each new post replaces the previous one; `scripts/lib/coupons.mjs` parses the pasted "🎟️Cupón: CODE" blocks into cards.

Statistics: Umami Cloud (cookieless). The script is added only when `analytics.umamiWebsiteId` is set, never on sample
builds or the owner pages (`track: false`). Clicks are tracked with `data-umami-event` attributes: `ir-a-mercadolibre`
(prop `lugar`, `producto`), `copiar-cupon` (prop `codigo`), `unirse-telegram`, `compartir-whatsapp/telegram`. Entering
the owner code sets `umami.disabled` so the owner's own visits aren't counted. `test/build.test.mjs` fails if a page
disappears from the build.

SEO: titles/descriptions include the month (`monthLabel`), category pages have `CATEGORY_COPY`, the home page ends with a
short `.seo-text` block. `telegramBanner(lugar)` appears on home, deal and coupons pages. `scripts/indexnow.mjs` runs after
each deploy and notifies Bing via IndexNow (key `indexNowKey`, published as /<key>.txt); sent deal pages are remembered in
`data/indexnow.json`.
