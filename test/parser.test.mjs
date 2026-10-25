import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COUNTRIES, affiliateUrl, categorize, itemIdFromUrl, slugify } from '../scripts/lib/core.mjs';
import { parseListingPage, parseProductPage } from '../scripts/lib/mercadolibre.mjs';

const MX = COUNTRIES.MX;
const html = fs.readFileSync(new URL('./fixtures-listing.html', import.meta.url), 'utf8');

test('parses discounted cards and skips ads and full-price items', () => {
  const deals = parseListingPage(html, MX);
  assert.equal(deals.length, 2);
  const [a, b] = deals;
  assert.equal(a.id, 'MLM12345678');
  assert.equal(a.title, 'Audífonos Inalámbricos Pro & Bluetooth');
  assert.equal(a.url, 'https://www.mercadolibre.com.mx/audifonos-inalambricos-pro/p/MLM12345678');
  assert.equal(a.image, 'https://http2.mlstatic.com/D_Q_NP_123-MLM-O.webp');
  assert.equal(a.price, 1299.5);
  assert.equal(a.originalPrice, 2599);
  assert.equal(a.discount, 50);
  assert.equal(a.freeShipping, true);
  assert.equal(a.lightning, true);
  assert.equal(a.rating, 4.7);
  assert.equal(b.id, 'MLM87654321');
  assert.equal(b.price, 899);
  assert.equal(b.originalPrice, 1499);
  assert.equal(b.discount, 40);
});

test('parses a product page via JSON-LD', () => {
  const page = `<meta property="og:title" content="Cafetera X | Mercado Libre"><script type="application/ld+json">{"@type":"Product","name":"Cafetera X","image":"https://img/x.jpg","offers":{"price":999,"priceCurrency":"MXN"}}</script>
  <s class="andes-money-amount andes-money-amount--previous"><span class="andes-money-amount__fraction">1,599</span></s>`;
  const d = parseProductPage(page, 'https://www.mercadolibre.com.mx/cafetera-x/p/MLM555666?x=1', MX);
  assert.deepEqual([d.id, d.title, d.price, d.originalPrice, d.image], ['MLM555666', 'Cafetera X', 999, 1599, 'https://img/x.jpg']);
});

test('helpers', () => {
  assert.equal(itemIdFromUrl('https://articulo.mercadolibre.com.mx/MLM-123456-foo', MX), 'MLM123456');
  assert.equal(categorize('Freidora de Aire 5L'), 'electrodomesticos');
  assert.equal(categorize('Audífonos Bluetooth'), 'electronica');
  assert.equal(categorize('Cosa rara'), 'otras');
  assert.equal(slugify('Audífonos Ñandú 2×1!'), 'audifonos-nandu-2-1');
  const cfg = { affiliate: { params: { matt_word: 'yo', matt_tool: '' } } };
  assert.equal(affiliateUrl({ id: 'MLM1', url: 'https://www.mercadolibre.com.mx/p/MLM1' }, cfg), 'https://www.mercadolibre.com.mx/p/MLM1?matt_word=yo');
  assert.equal(affiliateUrl({ id: 'MLM1', url: 'https://x/p/MLM1' }, cfg, { MLM1: 'https://meli.la/abc' }), 'https://meli.la/abc');
});
