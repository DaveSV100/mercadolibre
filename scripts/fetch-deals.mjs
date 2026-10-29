// Updates data/deals.json from Mercado Libre's official API and data/manual.json.
// Never fails the pipeline: if the API can't be reached, the previous deals are kept.
import { categorize, itemIdFromUrl, loadConfig, readJson, writeJson } from './lib/core.mjs';
import { apiClient, dealFromItem, dealFromProduct, getToken, lookupUrl } from './lib/mlapi.mjs';

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

  // 1) Search each category for discounted items.
  let searchBlocked = false;
  for (const cat of categories) {
    try {
      const { results = [] } = await api(`/sites/${site}/search?category=${cat.id}&discount=10-100&limit=50`);
      const before = found;
      results.forEach((r) => add(dealFromItem(r)));
      console.log(`search ${cat.name}: ${results.length} results, ${found - before} deals`);
    } catch (err) {
      warn(`search ${cat.name}: ${err.message}`);
      if (err.status === 401 || err.status === 403) { searchBlocked = true; break; }
    }
  }

  // 2) Best sellers per category (used when search is not available or finds little).
  if (searchBlocked || found < 30) {
    for (const cat of categories) {
      try {
        const { content = [] } = await api(`/highlights/${site}/category/${cat.id}`);
        const top = content.slice(0, config.fetch.highlightsPerCategory);
        const before = found;
        const itemIds = top.filter((c) => c.type === 'ITEM').map((c) => c.id);
        for (let i = 0; i < itemIds.length; i += 20) {
          const batch = await api(`/items?ids=${itemIds.slice(i, i + 20).join(',')}`);
          batch.forEach((b) => b.code === 200 && add(dealFromItem(b.body)));
        }
        for (const c of top.filter((x) => x.type === 'PRODUCT')) {
          try { add(dealFromProduct(await api(`/products/${c.id}`))); } catch { /* product without an offer */ }
        }
        console.log(`best sellers ${cat.name}: ${top.length} products, ${found - before} deals`);
      } catch (err) {
        warn(`best sellers ${cat.name}: ${err.message}`);
        if (err.status === 401 || err.status === 403) break;
      }
    }
  }

  // When nothing matched, show what the API returns so the mapping can be fixed from the run log.
  if (!found && categories.length) {
    const show = async (path) => {
      try { console.log(`sample ${path}: ${JSON.stringify(await api(path)).slice(0, 1500)}`); } catch (err) { console.log(`sample ${err.message}`); }
    };
    const { content = [] } = await api(`/highlights/${site}/category/${categories[0].id}`).catch(() => ({}));
    console.log(`sample highlights: ${JSON.stringify(content.slice(0, 3))}`);
    const product = content.find((c) => c.type === 'PRODUCT');
    const item = content.find((c) => c.type === 'ITEM');
    if (product) {
      await show(`/products/${product.id}`);
      await show(`/products/${product.id}/items?limit=2`);
    }
    if (item) {
      await show(`/items/${item.id}`);
      await show(`/items/${item.id}/sale_price`);
      await show(`/items/${item.id}/prices`);
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
