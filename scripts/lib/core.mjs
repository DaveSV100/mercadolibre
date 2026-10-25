// Shared helpers: config, files, formatting, categories and affiliate links.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const COUNTRIES = {
  MX: { domain: 'mercadolibre.com.mx', currency: 'MXN', locale: 'es-MX', prefix: 'MLM', name: 'México' },
  AR: { domain: 'mercadolibre.com.ar', currency: 'ARS', locale: 'es-AR', prefix: 'MLA', name: 'Argentina' },
  CO: { domain: 'mercadolibre.com.co', currency: 'COP', locale: 'es-CO', prefix: 'MCO', name: 'Colombia' },
  CL: { domain: 'mercadolibre.cl', currency: 'CLP', locale: 'es-CL', prefix: 'MLC', name: 'Chile' },
  PE: { domain: 'mercadolibre.com.pe', currency: 'PEN', locale: 'es-PE', prefix: 'MPE', name: 'Perú' },
  UY: { domain: 'mercadolibre.com.uy', currency: 'UYU', locale: 'es-UY', prefix: 'MLU', name: 'Uruguay' },
};

export function readJson(rel, fallback) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing file: ${rel}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(rel, data) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function loadConfig() {
  const config = readJson('site.config.json');
  config.market = COUNTRIES[config.country];
  if (!config.market) throw new Error(`Unknown country "${config.country}". Use one of: ${Object.keys(COUNTRIES).join(', ')}`);
  config.baseUrl = config.baseUrl.replace(/\/$/, '');
  return config;
}

export function normalizeText(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function slugify(s, max = 70) {
  return normalizeText(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '');
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

export function formatPrice(value, market) {
  return new Intl.NumberFormat(market.locale, {
    style: 'currency',
    currency: market.currency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

// The first category whose keywords match the title wins, so order matters.
export const CATEGORIES = [
  { slug: 'videojuegos', name: 'Videojuegos', emoji: '🎮', keywords: ['playstation', 'ps5', 'ps4', 'xbox', 'nintendo', 'switch 2', 'nintendo switch', 'videojuego', 'gamer', 'gaming', 'joystick'] },
  { slug: 'celulares', name: 'Celulares y Tablets', emoji: '📱', keywords: ['celular', 'smartphone', 'iphone', 'galaxy', 'xiaomi', 'redmi', 'motorola', 'moto g', 'honor', 'oppo', 'tablet', 'ipad', 'funda', 'mica', 'cargador', 'power bank', 'bateria portatil'] },
  { slug: 'computacion', name: 'Computación', emoji: '💻', keywords: ['laptop', 'notebook', 'computadora', 'pc', 'monitor', 'teclado', 'mouse', 'ssd', 'disco duro', 'memoria usb', 'memoria ram', 'impresora', 'router', 'procesador', 'tarjeta de video', 'macbook', 'chromebook', 'webcam', 'tinta'] },
  { slug: 'electronica', name: 'Electrónica, Audio y Video', emoji: '🎧', keywords: ['audifonos', 'auriculares', 'airpods', 'bocina', 'parlante', 'pantalla', 'televisor', 'smart tv', 'tv', 'camara', 'proyector', 'barra de sonido', 'alexa', 'echo dot', 'smartwatch', 'reloj inteligente', 'smart band', 'fire tv', 'chromecast', 'roku', 'dron'] },
  { slug: 'electrodomesticos', name: 'Electrodomésticos y Cocina', emoji: '🍳', keywords: ['freidora', 'licuadora', 'cafetera', 'horno', 'microondas', 'refrigerador', 'refrigeradora', 'heladera', 'lavadora', 'secadora de ropa', 'sarten', 'sartenes', 'olla', 'batidora', 'extractor', 'parrilla', 'estufa', 'tostador', 'procesador de alimentos', 'cuchillos', 'vajilla'] },
  { slug: 'hogar', name: 'Hogar y Muebles', emoji: '🛋️', keywords: ['colchon', 'almohada', 'sabanas', 'edredon', 'mueble', 'silla', 'escritorio', 'lampara', 'foco', 'sofa', 'sillon', 'cortina', 'organizador', 'aspiradora', 'robot aspirador', 'ventilador', 'purificador', 'aire acondicionado', 'calentador', 'toallas', 'tapete'] },
  { slug: 'belleza', name: 'Belleza y Cuidado Personal', emoji: '💄', keywords: ['perfume', 'fragancia', 'maquillaje', 'crema', 'shampoo', 'acondicionador', 'secadora de pelo', 'secadora de cabello', 'plancha de cabello', 'plancha para cabello', 'rasuradora', 'afeitadora', 'cepillo', 'serum', 'protector solar', 'labial', 'skincare', 'depiladora'] },
  { slug: 'deportes', name: 'Deportes y Fitness', emoji: '🏋️', keywords: ['bicicleta', 'mancuerna', 'mancuernas', 'pesas', 'caminadora', 'yoga', 'balon', 'pelota', 'gimnasio', 'proteina', 'creatina', 'whey', 'scooter', 'patineta', 'casa de campana', 'camping', 'termo'] },
  { slug: 'salud', name: 'Salud y Bienestar', emoji: '💊', keywords: ['vitamina', 'vitaminas', 'suplemento', 'termometro', 'baumanometro', 'oximetro', 'colageno', 'omega', 'magnesio', 'masajeador'] },
  { slug: 'herramientas', name: 'Herramientas', emoji: '🛠️', keywords: ['taladro', 'herramienta', 'herramientas', 'destornillador', 'desarmador', 'sierra', 'rotomartillo', 'esmeriladora', 'compresor', 'hidrolavadora', 'pulidora', 'multimetro', 'caja de herramientas'] },
  { slug: 'juguetes', name: 'Juguetes y Bebés', emoji: '🧸', keywords: ['juguete', 'juguetes', 'lego', 'muneca', 'peluche', 'carriola', 'panales', 'bebe', 'juego de mesa', 'hot wheels', 'barbie', 'rompecabezas'] },
  { slug: 'mascotas', name: 'Mascotas', emoji: '🐶', keywords: ['perro', 'perros', 'gato', 'gatos', 'mascota', 'mascotas', 'croquetas', 'arena para gato', 'alimento para perro'] },
  { slug: 'autos', name: 'Autos y Motos', emoji: '🚗', keywords: ['llanta', 'llantas', 'auto', 'automotriz', 'moto', 'casco', 'aceite de motor', 'autoestereo', 'dashcam', 'camara de reversa'] },
  { slug: 'moda', name: 'Ropa, Calzado y Accesorios', emoji: '👟', keywords: ['tenis', 'zapatos', 'zapatillas', 'playera', 'camisa', 'camiseta', 'pantalon', 'jeans', 'chamarra', 'sudadera', 'vestido', 'mochila', 'bolsa', 'cartera', 'reloj', 'lentes', 'gorra', 'calcetines', 'sandalias', 'botas'] },
];
export const OTHER_CATEGORY = { slug: 'otras', name: 'Otras ofertas', emoji: '🏷️', keywords: [] };
export const ALL_CATEGORIES = [...CATEGORIES, OTHER_CATEGORY];

const categoryPatterns = CATEGORIES.map((c) => ({
  slug: c.slug,
  re: new RegExp(`\\b(?:${c.keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`),
}));

export function categorize(title) {
  const text = normalizeText(title);
  return categoryPatterns.find((p) => p.re.test(text))?.slug ?? OTHER_CATEGORY.slug;
}

export function categoryBySlug(slug) {
  return ALL_CATEGORIES.find((c) => c.slug === slug) ?? OTHER_CATEGORY;
}

// Mercado Libre item ids look like MLM123456789 or MLM-123456789 in URLs.
export function itemIdFromUrl(url, market) {
  const m = String(url).match(new RegExp(`\\b(${market.prefix})-?(\\d{5,})`, 'i'));
  return m ? `${m[1].toUpperCase()}${m[2]}` : null;
}

export function cleanProductUrl(url) {
  try {
    const u = new URL(decodeEntities(url));
    u.hash = '';
    u.search = '';
    return u.toString();
  } catch {
    return null;
  }
}

export function affiliateConfigured(config) {
  return Object.values(config.affiliate?.params ?? {}).some(Boolean);
}

// Priority: a link pasted from the Afiliados portal > the deal's own link > tracking params on the product URL.
export function affiliateUrl(deal, config, links = {}) {
  if (links[deal.id]) return links[deal.id];
  if (deal.affiliateUrl) return deal.affiliateUrl;
  const u = new URL(deal.url);
  for (const [k, v] of Object.entries(config.affiliate?.params ?? {})) if (v) u.searchParams.set(k, v);
  return u.toString();
}

export function isActive(deal, config, now = Date.now()) {
  if (deal.source === 'manual') {
    if (deal.pinned) return true;
    if (deal.expiresAt) return Date.parse(deal.expiresAt) > now;
    return now - Date.parse(deal.firstSeen) < config.deals.manualDays * 864e5;
  }
  return now - Date.parse(deal.lastSeen) < config.deals.expireHours * 36e5;
}

export function dealPath(deal) {
  return `/oferta/${slugify(deal.title, 60)}-${deal.id.toLowerCase()}/`;
}
