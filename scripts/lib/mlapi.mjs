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

// Catalog products: name and pictures come from /products/{id}; prices from its sellers' listings
// (/products/{id}/items). The cheapest listing is the one shown; it counts only if it is discounted.
export function dealFromProduct(product, listings, market) {
  if (!product?.id || !product.name || !listings?.length) return null;
  const best = [...listings].filter((l) => l.price > 0).sort((a, b) => a.price - b.price)[0];
  if (!best) return null;
  return dealFromItem({
    id: product.id,
    title: product.name,
    permalink: product.permalink || `https://www.${market.domain}/p/${product.id}`,
    pictures: product.pictures,
    price: best.price,
    original_price: best.original_price,
    currency_id: best.currency_id,
    shipping: best.shipping,
    tags: best.tags,
  });
}

export async function productDeal(api, productId, market) {
  const { results = [] } = await api(`/products/${productId}/items?limit=20`);
  if (!results.some((l) => l.original_price > l.price)) return null;
  return dealFromProduct(await api(`/products/${productId}`), results, market);
}

export const isProductUrl = (url) => /\/p\/[A-Z]{3}\d+/i.test(url);

// Looks up one Mercado Libre catalog link (…/p/MLM123) for data/manual.json.
export async function lookupUrl(api, url, market) {
  const id = itemIdFromUrl(url, market);
  if (!id || !isProductUrl(url)) throw new Error('use the product link that contains /p/MLM… (single listings are not readable with this app)');
  const { results = [] } = await api(`/products/${id}/items?limit=20`);
  const product = await api(`/products/${id}`);
  const deal = dealFromProduct(product, results, market);
  if (deal) return { ...deal, url };
  const cheapest = results.filter((l) => l.price > 0).sort((a, b) => a.price - b.price)[0];
  return { id, title: product.name, url, image: httpsImage(product.pictures?.[0]?.url), price: cheapest?.price, currency: cheapest?.currency_id, freeShipping: Boolean(cheapest?.shipping?.free_shipping) };
}
