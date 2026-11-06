// Tells Bing (and through it DuckDuckGo and Yahoo) about new or changed pages, via IndexNow. No account needed:
// the key in site.config.json is published as /<key>.txt to prove the site is ours. Never fails the run.
import { ALL_CATEGORIES, dealPath, isActive, loadConfig, readJson, writeJson } from './lib/core.mjs';

const config = loadConfig();
const { hostname } = new URL(config.baseUrl);
if (!config.indexNowKey || hostname.endsWith('github.io')) {
  console.log('IndexNow skipped (no key or no custom domain).');
  process.exit(0);
}

const now = Date.now();
const deals = readJson('data/deals.json', []).filter((d) => isActive(d, config, now));
const state = readJson('data/indexnow.json', { submitted: [] });
const already = new Set(state.submitted);

// Main pages change every run; deal pages are sent once, when they first appear.
const usedCategories = new Set(deals.map((d) => d.category));
const main = ['/', '/cupones/', ...ALL_CATEGORIES.filter((c) => usedCategories.has(c.slug)).map((c) => `/categoria/${c.slug}/`)];
const fresh = deals.map(dealPath).filter((p) => !already.has(p));
const urlList = [...main, ...fresh].map((p) => config.baseUrl + p).slice(0, 10000);

// Bing verifies the site by downloading the key file; report whether it is reachable over https.
try {
  const check = await fetch(`${config.baseUrl}/${config.indexNowKey}.txt`, { signal: AbortSignal.timeout(15000) });
  console.log(`Key file ${config.baseUrl}/${config.indexNowKey}.txt -> HTTP ${check.status}`);
} catch (err) {
  console.warn(`! Key file not reachable over ${new URL(config.baseUrl).protocol} (${err.cause?.code ?? err.message}). Is HTTPS enabled for the domain?`);
}

try {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: hostname, key: config.indexNowKey, keyLocation: `${config.baseUrl}/${config.indexNowKey}.txt`, urlList }),
    signal: AbortSignal.timeout(20000),
  });
  console.log(`IndexNow: sent ${urlList.length} URLs (${fresh.length} new deals) -> HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  if (res.ok) {
    // Remember only pages that still exist, so the file doesn't grow forever.
    const live = new Set(deals.map(dealPath));
    writeJson('data/indexnow.json', { submitted: [...already, ...fresh].filter((p) => live.has(p)) });
  }
} catch (err) {
  console.warn(`! IndexNow failed: ${err.message}`);
}
