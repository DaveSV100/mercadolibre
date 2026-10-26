// Updates data/deals.json from Mercado Libre's public deals pages and data/manual.json.
// Never fails the pipeline: if Mercado Libre can't be read, the previous deals are kept.
import { categorize, itemIdFromUrl, loadConfig, readJson, writeJson } from './lib/core.mjs';
import { describePage, fetchHtml, parseListingPage, parseProductPage } from './lib/mercadolibre.mjs';

const config = loadConfig();
const { market } = config;
const now = new Date();
const nowIso = now.toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(1500 + Math.random() * 1500);

const existing = readJson('data/deals.json', []);
const byId = new Map(existing.map((d) => [d.id, d]));
const errors = [];

function upsert(deal, source) {
  const prev = byId.get(deal.id);
  const merged = {
    ...prev,
    ...Object.fromEntries(Object.entries(deal).filter(([, v]) => v !== null && v !== undefined)),
    source,
    category: deal.category ?? prev?.category ?? categorize(deal.title),
    firstSeen: prev?.firstSeen ?? nowIso,
    lastSeen: nowIso,
    lowestPrice: Math.min(deal.price, prev?.lowestPrice ?? Infinity),
  };
  byId.set(deal.id, merged);
}

// 1) Public deals pages ("Ofertas del día" + lightning deals).
const listingUrls = [];
for (let page = 1; page <= config.fetch.pages; page++) {
  listingUrls.push(`https://www.${market.domain}/ofertas${page > 1 ? `?page=${page}` : ''}`);
}
if (config.fetch.includeLightning) listingUrls.push(`https://www.${market.domain}/ofertas?promotion_type=lightning`);

let scraped = 0;
for (const url of listingUrls) {
  try {
    const html = await fetchHtml(url);
    const deals = parseListingPage(html, market);
    console.log(`${url} -> ${deals.length} deals`);
    if (!deals.length) console.log(describePage(html));
    for (const deal of deals) {
      if (deal.discount < config.fetch.minDiscount) continue;
      if (url.includes('lightning')) deal.lightning = true;
      upsert(deal, 'ofertas');
      scraped++;
    }
  } catch (err) {
    errors.push(`${url}: ${err.message}`);
    console.warn(`! ${url}: ${err.message}`);
  }
  await pause();
}

// 2) Products added by hand. Entries with title + price need no fetch at all.
const manual = readJson('data/manual.json', []);
for (const entry of manual) {
  if (!entry.url) continue;
  try {
    let deal = { ...entry, manualUrl: entry.url };
    if (!entry.title || !entry.price) {
      const fetched = parseProductPage(await fetchHtml(entry.url), entry.url, market);
      deal = { ...fetched, ...Object.fromEntries(Object.entries(deal).filter(([, v]) => v !== null && v !== '')) };
      await pause();
    }
    deal.id ??= itemIdFromUrl(entry.url, market) ?? `MAN${Buffer.from(entry.url).toString('base64url').slice(-10)}`;
    deal.url = deal.url ?? entry.url;
    if (!deal.title || !deal.price) throw new Error('could not read title/price; add them to manual.json by hand');
    deal.discount ??= deal.originalPrice > deal.price ? Math.round((1 - deal.price / deal.originalPrice) * 100) : 0;
    deal.currency ??= market.currency;
    upsert(deal, 'manual');
  } catch (err) {
    errors.push(`manual ${entry.url}: ${err.message}`);
    console.warn(`! manual ${entry.url}: ${err.message}`);
  }
}

// 3) Drop old deals (and hand-added ones removed from manual.json); keep the file a reasonable size.
const cutoff = now.getTime() - config.deals.keepDays * 864e5;
const manualUrls = new Set(manual.map((m) => m.url));
const kept = [...byId.values()]
  .filter((d) => (d.source === 'manual' ? manualUrls.has(d.manualUrl) : Date.parse(d.lastSeen) > cutoff))
  .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || b.discount - a.discount)
  .slice(0, config.fetch.maxStoredDeals);

writeJson('data/deals.json', kept);
writeJson('data/last-run.json', { at: nowIso, scraped, stored: kept.length, errors });

console.log(`Scraped ${scraped} deals, stored ${kept.length}, ${errors.length} errors.`);
if (!scraped) console.warn('! No deals read from Mercado Libre this run (blocked or page layout changed). Previous deals kept.');
