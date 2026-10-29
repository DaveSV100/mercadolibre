// Updates data/deals.json from Mercado Libre's official API and data/manual.json.
// Never fails the pipeline: if the API can't be reached, the previous deals are kept.
import { categorize, itemIdFromUrl, loadConfig, readJson, writeJson } from './lib/core.mjs';
import { apiClient, getToken, lookupUrl, productDeal } from './lib/mlapi.mjs';

const config = loadConfig();
const { market } = config;
const site = market.prefix;
const now = new Date();
const nowIso = now.toISOString();

const existing = readJson('data/deals.json', []);
const byId = new Map(existing.map((d) => [d.id, d]));
const errors = [];
const warn = (msg) => { errors.push(msg); console.warn(`! ${msg}`); };

function upsert(deal, source) {
  const prev = byId.get(deal.id);
  byId.set(deal.id, {
    ...prev,
    ...Object.fromEntries(Object.entries(deal).filter(([, v]) => v !== null && v !== undefined)),
    source,
    category: deal.category ?? prev?.category ?? categorize(deal.title),
    firstSeen: prev?.firstSeen ?? nowIso,
    lastSeen: nowIso,
    lowestPrice: Math.min(deal.price, prev?.lowestPrice ?? Infinity),
  });
}

let api = null;
try {
  api = apiClient(await getToken());
  console.log('Connected to the Mercado Libre API.');
} catch (err) {
  warn(`API login failed: ${err.message}`);
}

let found = 0;
const add = (deal) => {
  if (!deal || deal.discount < config.fetch.minDiscount) return;
  upsert(deal, 'api');
  found++;
};

if (api) {
  let categories = [];
  try {
    categories = (await api(`/sites/${site}/categories`)).slice(0, config.fetch.maxCategories);
    console.log(`${categories.length} categories.`);
  } catch (err) {
    warn(`categories: ${err.message}`);
  }

  // Best sellers of each category; keep the ones whose cheapest listing is discounted.
  // (Search and single listings are not available to this app: 403.)
  for (const cat of categories) {
    try {
      const { content = [] } = await api(`/highlights/${site}/category/${cat.id}`);
      const products = content.filter((c) => c.type === 'PRODUCT').slice(0, config.fetch.highlightsPerCategory);
      const before = found;
      for (const p of products) {
        try { add(await productDeal(api, p.id, market)); } catch (err) { if (err.status === 401) throw err; }
      }
      console.log(`best sellers ${cat.name}: ${products.length} products, ${found - before} deals`);
    } catch (err) {
      if (err.status === 404) continue; // categories without best sellers (cars, real estate, services)
      warn(`best sellers ${cat.name}: ${err.message}`);
      if (err.status === 401 || err.status === 403) break;
    }
  }
}

// 3) Products added by hand. Entries with title + price need no lookup.
const manual = readJson('data/manual.json', []);
for (const entry of manual) {
  if (!entry.url) continue;
  try {
    let deal = { ...entry, manualUrl: entry.url };
    if (!entry.title || !entry.price) {
      if (!api) throw new Error('API not available to look up this link');
      const looked = await lookupUrl(api, entry.url, market);
      deal = { ...looked, ...Object.fromEntries(Object.entries(deal).filter(([, v]) => v !== null && v !== '')) };
    }
    deal.id ??= itemIdFromUrl(entry.url, market) ?? `MAN${Buffer.from(entry.url).toString('base64url').slice(-10)}`;
    deal.url ??= entry.url;
    if (!deal.title || !deal.price) throw new Error('could not read title/price; add them to manual.json by hand');
    deal.discount ??= deal.originalPrice > deal.price ? Math.round((1 - deal.price / deal.originalPrice) * 100) : 0;
    deal.currency ??= market.currency;
    upsert(deal, 'manual');
  } catch (err) {
    warn(`manual ${entry.url}: ${err.message}`);
  }
}

// 4) Drop old deals (and hand-added ones removed from manual.json); keep the file a reasonable size.
const cutoff = now.getTime() - config.deals.keepDays * 864e5;
const manualUrls = new Set(manual.map((m) => m.url));
const kept = [...byId.values()]
  .filter((d) => (d.source === 'manual' ? manualUrls.has(d.manualUrl) : Date.parse(d.lastSeen) > cutoff))
  .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || b.discount - a.discount)
  .slice(0, config.fetch.maxStoredDeals);

writeJson('data/deals.json', kept);
writeJson('data/last-run.json', { at: nowIso, found, stored: kept.length, errors });

console.log(`Found ${found} deals, stored ${kept.length}, ${errors.length} errors.`);
if (!found) console.warn('! No deals found this run. Previous deals kept.');
