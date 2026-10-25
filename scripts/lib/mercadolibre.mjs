// Reads deals from Mercado Libre's public pages (there is no affiliate API).
// The HTML layout can change; if parsing finds nothing, the fetch script keeps the previous deals.
import { cleanProductUrl, decodeEntities, itemIdFromUrl } from './core.mjs';

const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'accept': 'text/html,application/xhtml+xml',
  'accept-language': 'es-MX,es;q=0.9',
};

export async function fetchHtml(url) {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

const stripTags = (s) => decodeEntities(String(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const toNumber = (fraction, cents) => {
  const n = Number(String(fraction).replace(/\D/g, ''));
  return n ? n + (cents ? Number(cents) / 100 : 0) : null;
};

function pickImage(chunk) {
  for (const tag of chunk.match(/<img\b[^>]*>/gi) ?? []) {
    for (const attr of ['data-src', 'src']) {
      const m = tag.match(new RegExp(`\\s${attr}="([^"]+)"`, 'i'));
      if (m && !m[1].startsWith('data:')) return decodeEntities(m[1]);
    }
  }
  return null;
}

function pickTitle(chunk) {
  const patterns = [
    /class="[^"]*poly-component__title[^"]*"[^>]*>([\s\S]*?)<\/(?:a|h\d|span)>/i,
    /class="[^"]*promotion-item__title[^"]*"[^>]*>([\s\S]*?)<\/(?:p|h\d|span)>/i,
    /class="[^"]*ui-search-item__title[^"]*"[^>]*>([\s\S]*?)<\/(?:a|h\d)>/i,
    /<img\b[^>]*\salt="([^"]{8,})"/i,
  ];
  for (const re of patterns) {
    const m = chunk.match(re);
    if (m && stripTags(m[1])) return stripTags(m[1]);
  }
  return null;
}

function pickPrices(chunk) {
  const prevBlock = chunk.match(/andes-money-amount--previous[\s\S]*?__fraction[^>]*>([^<]+)</i);
  let originalPrice = prevBlock ? toNumber(prevBlock[1]) : null;
  const rest = chunk.replace(/<s\b[\s\S]*?<\/s>/gi, '');
  const cur = rest.match(/__fraction[^>]*>([^<]+)<\/span>(?:\s*<span[^>]*__cents[^>]*>(\d{1,2})<)?/i);
  let price = cur ? toNumber(cur[1], cur[2]) : null;

  // Fallback to accessibility labels: "Antes: 1299 pesos" / "Ahora: 899 pesos con 99 centavos".
  if (!originalPrice) {
    const m = chunk.match(/aria-label="Antes:\s*([\d.,]+)/i);
    if (m) originalPrice = toNumber(m[1]);
  }
  if (!price) {
    const m = chunk.match(/aria-label="(?:Ahora|Precio):\s*([\d.,]+)[^"]*?(?:con\s*(\d{1,2})\s*centavos)?"/i);
    if (m) price = toNumber(m[1], m[2]);
  }
  return { price, originalPrice };
}

function pickUrl(chunk, market) {
  for (const m of chunk.matchAll(/href="([^"]+)"/gi)) {
    const href = decodeEntities(m[1]);
    if (/click1\.|\/mclics\//.test(href)) continue; // sponsored-ad redirect links
    if (!href.includes('mercadoli')) continue;
    if (itemIdFromUrl(href, market)) return href;
  }
  return null;
}

export function parseCard(chunk, market) {
  const rawUrl = pickUrl(chunk, market);
  const title = pickTitle(chunk);
  if (!rawUrl || !title) return null;
  const { price, originalPrice } = pickPrices(chunk);
  if (!price || !originalPrice || originalPrice <= price) return null;

  const discountMatch = chunk.match(/(\d{1,2})\s*%\s*OFF/i);
  const discount = discountMatch ? Number(discountMatch[1]) : Math.round((1 - price / originalPrice) * 100);
  const rating = chunk.match(/poly-reviews__rating[^>]*>\s*([\d.]+)/i);
  const text = stripTags(chunk);

  return {
    id: itemIdFromUrl(rawUrl, market),
    title,
    url: cleanProductUrl(rawUrl),
    image: pickImage(chunk),
    price,
    originalPrice,
    discount,
    currency: market.currency,
    freeShipping: /env[ií]o gratis|llega gratis|gratis ma[ñn]ana/i.test(text),
    lightning: /rel[áa]mpago/i.test(text),
    rating: rating ? Number(rating[1]) : null,
  };
}

// Splits a listing page into product cards (current "poly-card" layout, plus two older layouts).
export function parseListingPage(html, market) {
  const splitters = [
    /<(?:div|li)\b[^>]*class="[^"]*\bpoly-card\b(?!__)[^"]*"/i,
    /<(?:div|li)\b[^>]*class="[^"]*\bpromotion-item\b(?!__)[^"]*"/i,
    /<(?:div|li)\b[^>]*class="[^"]*\bui-search-result__wrapper\b[^"]*"/i,
  ];
  for (const re of splitters) {
    const chunks = html.split(new RegExp(re.source, 'gi')).slice(1);
    if (!chunks.length) continue;
    const seen = new Set();
    const deals = [];
    for (const chunk of chunks) {
      const deal = parseCard(chunk.slice(0, 12000), market);
      if (deal && !seen.has(deal.id)) {
        seen.add(deal.id);
        deals.push(deal);
      }
    }
    if (deals.length) return deals;
  }
  return [];
}

// Reads one product page (used for links you add by hand in data/manual.json).
export function parseProductPage(html, url, market) {
  const meta = (prop) => {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name|itemprop)="${prop}"[^>]+content="([^"]*)"`, 'i'))
      ?? html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name|itemprop)="${prop}"`, 'i'));
    return m ? decodeEntities(m[1]) : null;
  };

  let product = null;
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const list = Array.isArray(data) ? data : data['@graph'] ?? [data];
      product = list.find((x) => x['@type'] === 'Product') ?? product;
    } catch { /* ignore malformed JSON-LD */ }
  }
  const offer = Array.isArray(product?.offers) ? product.offers[0] : product?.offers;
  const title = product?.name ?? meta('og:title')?.replace(/\s*\|\s*Mercado Libre.*$/i, '');
  const price = Number(offer?.price ?? meta('price')) || pickPrices(html).price;
  const prev = html.match(/andes-money-amount--previous[\s\S]*?__fraction[^>]*>([^<]+)</i);
  const originalPrice = prev ? toNumber(prev[1]) : null;
  const image = (Array.isArray(product?.image) ? product.image[0] : product?.image) ?? meta('og:image');

  return {
    id: itemIdFromUrl(url, market) ?? itemIdFromUrl(html.match(/"item_id"\s*:\s*"([A-Z]{3}\d+)"/)?.[1] ?? '', market),
    title,
    url: cleanProductUrl(url),
    image,
    price: price || null,
    originalPrice: originalPrice && price && originalPrice > price ? originalPrice : null,
    currency: market.currency,
    freeShipping: /env[ií]o gratis|llega gratis/i.test(html),
  };
}
