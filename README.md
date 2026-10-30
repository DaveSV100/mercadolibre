# InfiniOfertas

An automatic Mercado Libre deals website: **ofertas.infinistart.com**.

Every 2 hours, for free, GitHub:
1. asks Mercado Libre's official API for discounted products in every category (and the best sellers),
2. keeps the products with a real discount (15%+ by default),
3. adds your affiliate tracking to every link,
4. rebuilds the website (fast, SEO-ready: sitemap, Google product markup, one page per deal and per category),
5. publishes it on GitHub Pages,
6. posts the best new deals (25%+) to your Telegram channel.

Visitors with the site open get a "Hay ofertas nuevas · Actualizar" notice when a new version is published.
For WhatsApp, open **/compartir/** on your phone: every deal has its own WhatsApp button, so each one is sent with its photo.

## One-time setup (all in GitHub, from a computer or the GitHub app)

1. **Turn on the website**: repo **Settings → Pages → Source: GitHub Actions**.
2. **Connect the domain**: in your DNS (where you bought infinistart.com) add a `CNAME` record
   `ofertas` → `davesv100.github.io`. Then **Settings → Pages → Custom domain**: `ofertas.infinistart.com`, and tick **Enforce HTTPS** when it becomes available.
   The next run picks up the new address by itself. Until then the site lives at https://davesv100.github.io/mercadolibre/.
3. **Affiliate tracking** (required to earn commission): create one link in the Afiliados portal, open it, and copy the
   final address. Put the tracking values you see (for example `matt_word` and `matt_tool`) in `site.config.json → affiliate.params`.
   Or just send that link to Claude and ask it to configure it.
4. **Telegram** (optional): create a bot with @BotFather, add it as admin of your channel, then in
   **Settings → Secrets and variables → Actions** add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (e.g. `@infiniofertas`).
5. Put your Telegram/WhatsApp invite links in `site.config.json → social` so the join buttons appear.
6. Channel photo and description: **Actions → Configurar Telegram → Run workflow** (uses `brand/telegram-avatar.png`).

## Day to day

| I want to… | Do this |
|---|---|
| Refresh right now | GitHub → **Actions → Actualizar ofertas → Run workflow** (works in the GitHub mobile app) |
| Add a specific product | Add `{ "url": "https://..." }` to `data/manual.json` (or ask Claude) |
| Use a short link from the Afiliados portal | Add `"MLM123456": "https://meli.la/..."` to `data/affiliate-links.json` |
| Add a coupon | Add `{ "title": "...", "code": "...", "url": "...", "expiresAt": "2026-12-31" }` to `data/coupons.json` |
| Change country | `site.config.json → country`: MX, AR, CO, CL, PE or UY |
| Change how often it runs | `.github/workflows/update.yml → cron` |
| Fewer/more Telegram posts | `site.config.json → telegram` |

## Run it on a computer

```bash
npm run preview     # website with SAMPLE products at http://localhost:8080
npm run update      # fetch real deals + build into dist/
npm test
node scripts/post-telegram.mjs --dry-run   # show what would be posted
```

No dependencies to install; only Node.js 20+.

## Good to know

- Products come from Mercado Libre's official API using the app created at developers.mercadolibre.com.mx; its
  App ID and Secret Key are the GitHub secrets `ML_CLIENT_ID` and `ML_CLIENT_SECRET`. If the API can't be reached,
  the run keeps the previous deals and logs a warning. (Reading the public web pages directly is blocked by
  Mercado Libre's bot protection, so the site doesn't do that.)
- Automatic posting to WhatsApp groups has no free official method and unofficial bots risk a ban, so WhatsApp uses
  the one-tap `/compartir/` page.
- The site says clearly that it is independent and uses affiliate links (required by the program and by Google).
