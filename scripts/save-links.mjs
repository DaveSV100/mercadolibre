// Stores official affiliate links sent from the site's /enlaces/ page (as a GitHub issue body) in data/affiliate-links.json.
import { readJson, writeJson } from './lib/core.mjs';

const body = process.env.ISSUE_BODY ?? '';
const json = body.match(/```json\s*([\s\S]*?)```/)?.[1] ?? body;
const incoming = JSON.parse(json);
const links = readJson('data/affiliate-links.json', {});
let added = 0;
for (const [id, url] of Object.entries(incoming)) {
  if (!/^[A-Z]{3}\d+$/.test(id) || !/^https:\/\/meli\.la\/[A-Za-z0-9]+$/.test(url)) throw new Error(`Invalid entry: ${id} -> ${url}`);
  if (links[id] !== url) added++;
  links[id] = url;
}
writeJson('data/affiliate-links.json', links);
console.log(`Saved ${added} new links (${Object.keys(links).length} in total).`);
