// Mercado Libre's official API (https://developers.mercadolibre.com.mx).
// Uses the app's own credentials (client_credentials), set as GitHub secrets ML_CLIENT_ID / ML_CLIENT_SECRET.
import { categorize, itemIdFromUrl } from './core.mjs';

const API = 'https://api.mercadolibre.com';

export async function getToken(env = process.env) {
  if (!env.ML_CLIENT_ID || !env.ML_CLIENT_SECRET) throw new Error('ML_CLIENT_ID / ML_CLIENT_SECRET are not set');
  const res = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.ML_CLIENT_ID, client_secret: env.ML_CLIENT_SECRET }),
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`token ${res.status}: ${json.message ?? json.error ?? 'no access_token'}`);
  return json.access_token;
}

export function apiClient(token) {
  return async function api(path) {
    const res = await fetch(API + path, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    if (!res.ok) {
      const err = new Error(`${res.status} ${path.split('?')[0]}: ${text.slice(0, 160).replace(/\s+/g, ' ')}`);
      err.status = res.status;
      throw err;
    }
    return JSON.parse(text);
  };
}

const httpsImage = (url) => (url ? url.replace(/^http:/, 'https:').replace(/-[IV]\.(jpe?g|webp|png)$/i, '-O.$1') : null);
const pct = (price, original) => Math.round((1 - price / original) * 100);

// Turns an item (from /sites/.../search or /items) into a deal, or null when it has no real discount.
export function dealFromItem(item) {
  if (!item?.id || !item.title) return null;
  const price = item.sale_price?.amount ?? item.price;
  const originalPrice = item.sale_price?.regular_amount ?? item.original_price;
  if (!price || !originalPrice || originalPrice <= price) return null;
  return {
    id: item.id,
    title: item.title,
    url: item.permalink,
    image: httpsImage(item.pictures?.[0]?.secure_url ?? item.pictures?.[0]?.url ?? item.thumbnail),
    price,
    originalPrice,
    discount: pct(price, originalPrice),
    currency: item.currency_id,
    freeShipping: Boolean(item.shipping?.free_shipping),
    lightning: (item.tags ?? []).some((t) => /lightning/i.test(t)),
    category: categorize(item.title),
  };
}

// Catalog products (/products/{id}) carry their price in buy_box_winner.
export function dealFromProduct(product) {
  const box = product?.buy_box_winner;
  if (!product?.id || !product.name || !box) return null;
  return dealFromItem({
    id: product.id,
    title: product.name,
    permalink: product.permalink ?? `https://www.mercadolibre.com.mx/p/${product.id}`,
    pictures: product.pictures,
    price: box.price,
    original_price: box.original_price,
    currency_id: box.currency_id,
    shipping: box.shipping,
  });
}

export const isProductUrl = (url) => /\/p\/[A-Z]{3}\d+/i.test(url);

// Looks up one Mercado Libre link (item or catalog product) for data/manual.json.
export async function lookupUrl(api, url, market) {
  const id = itemIdFromUrl(url, market);
  if (!id) throw new Error('no Mercado Libre id in the link');
  if (isProductUrl(url)) {
    const p = await api(`/products/${id}`);
    const box = p.buy_box_winner ?? {};
    return { id, title: p.name, url, image: httpsImage(p.pictures?.[0]?.url), price: box.price, originalPrice: box.original_price, currency: box.currency_id, freeShipping: Boolean(box.shipping?.free_shipping) };
  }
  const item = await api(`/items/${id}`);
  return { id, title: item.title, url: item.permalink ?? url, image: httpsImage(item.pictures?.[0]?.secure_url ?? item.thumbnail), price: item.price, originalPrice: item.original_price, currency: item.currency_id, freeShipping: Boolean(item.shipping?.free_shipping) };
}
