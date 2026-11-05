import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES, affiliateUrl, categorize, categoryFromMercadoLibre, itemIdFromUrl, slugify } from '../scripts/lib/core.mjs';
import { dealFromItem, dealFromProduct, isProductUrl } from '../scripts/lib/mlapi.mjs';

const MX = COUNTRIES.MX;

test('maps a discounted search result to a deal', () => {
  const d = dealFromItem({
    id: 'MLM123', title: 'Freidora de Aire 5L', price: 999, original_price: 1999, currency_id: 'MXN',
    thumbnail: 'http://http2.mlstatic.com/D_123-I.jpg', permalink: 'https://articulo.mercadolibre.com.mx/MLM-123-freidora',
    shipping: { free_shipping: true }, tags: ['lightning_deal'],
  });
  assert.deepEqual(d, {
    id: 'MLM123', title: 'Freidora de Aire 5L', url: 'https://articulo.mercadolibre.com.mx/MLM-123-freidora',
    image: 'https://http2.mlstatic.com/D_123-O.jpg', price: 999, originalPrice: 1999, discount: 50, currency: 'MXN',
    freeShipping: true, lightning: true, category: 'electrodomesticos',
  });
});

test('uses sale_price when present and skips items without a discount', () => {
  assert.equal(dealFromItem({ id: 'MLM1', title: 'x', price: 100, sale_price: { amount: 80, regular_amount: 100 } }).discount, 20);
  assert.equal(dealFromItem({ id: 'MLM2', title: 'x', price: 100, original_price: null }), null);
  assert.equal(dealFromItem({ id: 'MLM3', title: 'x', price: 100, original_price: 90 }), null);
});

test('maps a catalog product using its cheapest listing', () => {
  const product = { id: 'MLM555', name: 'Audífonos Bluetooth', permalink: '', pictures: [{ url: 'https://img/x-F.jpg' }] };
  const listings = [
    { item_id: 'MLM1', price: 450, original_price: 600, currency_id: 'MXN', shipping: { free_shipping: true } },
    { item_id: 'MLM2', price: 300, original_price: 600, currency_id: 'MXN', shipping: { free_shipping: false } },
  ];
  const d = dealFromProduct(product, listings, MX);
  assert.deepEqual([d.id, d.url, d.price, d.discount, d.freeShipping, d.image, d.category],
    ['MLM555', 'https://www.mercadolibre.com.mx/p/MLM555', 300, 50, false, 'https://img/x-F.jpg', 'electronica']);
  // The cheapest listing has no discount, so the product is not a deal.
  assert.equal(dealFromProduct(product, [{ price: 280, original_price: null }, ...listings], MX), null);
  assert.equal(dealFromProduct(product, [], MX), null);
});

test('helpers', () => {
  assert.equal(itemIdFromUrl('https://articulo.mercadolibre.com.mx/MLM-123456-foo', MX), 'MLM123456');
  assert.equal(isProductUrl('https://www.mercadolibre.com.mx/cafetera/p/MLM555666'), true);
  assert.equal(categorize('Cosa rara'), 'otras');
  assert.equal(categoryFromMercadoLibre('Accesorios para Vehículos', 'Cargador 12v'), 'autos');
  assert.equal(categoryFromMercadoLibre('Otras Categorías', 'Freidora de aire'), 'electrodomesticos');
  assert.equal(slugify('Audífonos Ñandú 2×1!'), 'audifonos-nandu-2-1');
  const cfg = { affiliate: { params: { matt_word: 'yo', matt_tool: '' } } };
  assert.equal(affiliateUrl({ id: 'MLM1', url: 'https://www.mercadolibre.com.mx/p/MLM1' }, cfg), 'https://www.mercadolibre.com.mx/p/MLM1?matt_word=yo');
  assert.equal(affiliateUrl({ id: 'MLM1', url: 'https://x/p/MLM1' }, cfg, { MLM1: 'https://meli.la/abc' }), 'https://meli.la/abc');
});

test('parses pasted coupon text into cards', async () => {
  const { parseCouponText } = await import('../scripts/lib/coupons.mjs');
  const { coupons, notes } = parseCouponText('Copia cupones:\n\n🎟️Cupón: PREDDHOT\n10% de descuento\nCompra minima: $700\nDescuento máximo: $90\n\n*CUPONES ESPECIALES*\n🎟️Cupón: PREDDWOW\n$1.200 de descuento\nCompra minima: $12.000\nProductos que aplican: https://listado.mercadolibre.com.mx/_Container_x\nVigencia: Hasta 30 nov\n*Recuerda validar en los productos que aplican*');
  assert.deepEqual(coupons.map((c) => [c.code, c.benefit, c.minPurchase, c.maxDiscount, c.featured]),
    [['PREDDHOT', '10%', '$700', '$90', false], ['PREDDWOW', '$1,200', '$12,000', null, true]]);
  assert.equal(coupons[1].appliesUrl, 'https://listado.mercadolibre.com.mx/_Container_x');
  assert.equal(coupons[1].validity, 'Hasta 30 nov');
  assert.deepEqual(notes, ['Recuerda validar en los productos que aplican']);
});
