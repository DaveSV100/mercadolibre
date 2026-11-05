// Applies a coupon change sent from the site's /publicar/ page (as a GitHub issue body) to data/coupons.json.
import { readJson, writeJson } from './lib/core.mjs';

const body = process.env.ISSUE_BODY ?? '';
const req = JSON.parse(body.match(/```json\s*([\s\S]*?)```/)?.[1] ?? body);
let coupons = readJson('data/coupons.json', []);

if (req.action === 'add') {
  const text = String(req.text ?? '').trim();
  if (!text || text.length > 3000) throw new Error('The coupon text is empty or too long.');
  if (req.expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(req.expiresAt)) throw new Error(`Invalid date: ${req.expiresAt}`);
  if (req.url && !/^https:\/\/[^\s"<>]+$/.test(req.url)) throw new Error(`Invalid link: ${req.url}`);
  const coupon = { id: Date.now().toString(36), text, expiresAt: req.expiresAt || null, url: req.url || null, createdAt: new Date().toISOString() };
  // A new post replaces the previous ones: the site shows only the latest coupons.
  coupons = [coupon];
  console.log(`Cupones publicados${coupon.expiresAt ? ` (válidos hasta ${coupon.expiresAt})` : ''}; los anteriores se reemplazaron.`);
} else if (req.action === 'remove') {
  const before = coupons.length;
  coupons = coupons.filter((c) => c.id !== req.id);
  if (coupons.length === before) throw new Error(`No coupon with id ${req.id}`);
  console.log('Cupón quitado.');
} else {
  throw new Error(`Unknown action: ${req.action}`);
}

writeJson('data/coupons.json', coupons);
