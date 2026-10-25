// Builds the static website into dist/ from data/*.json.
//   node scripts/build.mjs            -> real data
//   node scripts/build.mjs --sample   -> sample data for local preview (never deploy this)
import fs from 'node:fs';
import path from 'node:path';
import {
  ALL_CATEGORIES, ROOT, affiliateConfigured, affiliateUrl, categoryBySlug, dealPath,
  escapeHtml as e, formatPrice, isActive, loadConfig, readJson,
} from './lib/core.mjs';

const SAMPLE = process.argv.includes('--sample');
const config = loadConfig();
const { market } = config;
const OUT = path.join(ROOT, 'dist');
const now = Date.now();
const buildId = now.toString(36);

const deals = SAMPLE
  ? readJson('samples/sample-deals.json').map((d) => ({ ...d, firstSeen: new Date(now - d.hoursAgo * 36e5).toISOString(), lastSeen: new Date(now).toISOString() }))
  : readJson('data/deals.json', []);
const coupons = (SAMPLE ? readJson('samples/sample-coupons.json', []) : readJson('data/coupons.json', []))
  .filter((c) => !c.expiresAt || Date.parse(c.expiresAt) > now);
const links = readJson('data/affiliate-links.json', {});

const byScore = (a, b) => b.discount - a.discount || b.lastSeen.localeCompare(a.lastSeen);
for (const d of deals) {
  d.active = isActive(d, config, now);
  d.page = dealPath(d);
  d.buyUrl = affiliateUrl(d, config, links);
}
const active = deals.filter((d) => d.active).sort(byScore);
const categories = ALL_CATEGORIES
  .map((c) => ({ ...c, deals: active.filter((d) => d.category === c.slug) }))
  .filter((c) => c.deals.length);

const price = (n) => formatPrice(n, market);
const abs = (p) => config.baseUrl + p;
const updatedLabel = new Intl.DateTimeFormat(market.locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: timeZoneFor(config.country) }).format(now);

function timeZoneFor(country) {
  return { MX: 'America/Mexico_City', AR: 'America/Argentina/Buenos_Aires', CO: 'America/Bogota', CL: 'America/Santiago', PE: 'America/Lima', UY: 'America/Montevideo' }[country];
}

// ---------- files ----------
fs.rmSync(OUT, { recursive: true, force: true });
function write(rel, content) {
  const file = path.join(OUT, rel.endsWith('/') ? rel + 'index.html' : rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
fs.cpSync(path.join(ROOT, 'site'), OUT, { recursive: true });

// ---------- components ----------
const icon = {
  telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.8 15.2 9.6 19c.4 0 .6-.2.8-.4l2-1.9 4.1 3c.8.4 1.3.2 1.5-.7l2.7-12.7c.3-1.1-.4-1.6-1.2-1.3L3.6 10.3c-1.1.4-1.1 1-.2 1.3l4.1 1.3 9.6-6c.5-.3.9-.1.5.2z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l2 .9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  truck: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 5h11v9h1.2l1.6-5H21l1 3.5V16h-1.6a2.5 2.5 0 0 1-4.8 0H9.4a2.5 2.5 0 0 1-4.8 0H3zm4.5 10a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm10.5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 3a7 7 0 0 1 5.6 11.2l5 5-1.4 1.4-5-5A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/></svg>',
};

function media(deal, cls = '') {
  const cat = categoryBySlug(deal.category);
  return deal.image
    ? `<img class="${cls}" src="${e(deal.image)}" alt="${e(deal.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : `<div class="ph ${cls}" data-cat="${e(cat.slug)}" role="img" aria-label="${e(deal.title)}"><span>${cat.emoji}</span></div>`;
}

const buyAttrs = 'target="_blank" rel="sponsored nofollow noopener"';

function card(deal) {
  return `<article class="card" data-title="${e(deal.title.toLowerCase())}" data-discount="${deal.discount}" data-price="${deal.price}" data-time="${e(deal.firstSeen)}" data-ship="${deal.freeShipping ? 1 : 0}">
  <a class="card-media" href="${deal.page}" tabindex="-1" aria-hidden="true">${media(deal)}</a>
  <div class="badges">${deal.discount ? `<span class="badge off">-${deal.discount}%</span>` : ''}${deal.lightning ? `<span class="badge bolt">${icon.bolt}Relámpago</span>` : ''}</div>
  <div class="card-body">
    <h3 class="card-title"><a href="${deal.page}">${e(deal.title)}</a></h3>
    <div class="prices"><span class="now">${price(deal.price)}</span>${deal.originalPrice ? `<s>${price(deal.originalPrice)}</s>` : ''}</div>
    <div class="meta">${deal.freeShipping ? `<span class="ship">${icon.truck}Envío gratis</span>` : ''}<time datetime="${e(deal.firstSeen)}" data-rel></time></div>
    <a class="btn" href="${e(deal.buyUrl)}" ${buyAttrs}>Ver oferta</a>
  </div>
</article>`;
}

function grid(list, { tools = true } = {}) {
  if (!list.length) return `<div class="empty"><p class="empty-emoji">⏳</p><h3>Estamos buscando ofertas</h3><p>El sitio se actualiza solo cada pocas horas. Vuelve pronto o únete a nuestro canal para recibirlas al instante.</p></div>`;
  const toolbar = tools ? `<div class="toolbar" role="search">
    <label class="search">${icon.search}<input id="q" type="search" placeholder="Buscar en ${list.length} ofertas…" aria-label="Buscar ofertas"></label>
    <select id="sort" aria-label="Ordenar"><option value="discount">Mayor descuento</option><option value="new">Más nuevas</option><option value="low">Menor precio</option><option value="high">Mayor precio</option></select>
    <select id="min" aria-label="Descuento mínimo"><option value="0">Cualquier descuento</option><option value="30">30% o más</option><option value="50">50% o más</option></select>
    <label class="chk"><input id="ship" type="checkbox"> Envío gratis</label>
  </div><p id="noresults" class="noresults" hidden>No hay ofertas con esos filtros.</p>` : '';
  return `${toolbar}<div class="grid" id="grid">${list.map(card).join('')}</div>`;
}

function chips(current) {
  return `<nav class="chips" aria-label="Categorías">${categories.map((c) => `<a href="/categoria/${c.slug}/"${c.slug === current ? ' aria-current="page"' : ''}>${c.emoji} ${e(c.name)}${c.deals.length ? ` <small>${c.deals.length}</small>` : ''}</a>`).join('')}</nav>`;
}

function joinButtons() {
  const { telegramUrl, whatsappUrl } = config.social;
  if (!telegramUrl && !whatsappUrl) return '';
  return `<div class="join">${telegramUrl ? `<a class="join-tg" href="${e(telegramUrl)}" target="_blank" rel="noopener">${icon.telegram}Telegram</a>` : ''}${whatsappUrl ? `<a class="join-wa" href="${e(whatsappUrl)}" target="_blank" rel="noopener">${icon.whatsapp}WhatsApp</a>` : ''}</div>`;
}

function layout({ title, description, pathname, body, jsonld = [], image, noindex = false, type = 'website' }) {
  const fullTitle = pathname === '/' ? `${config.siteName} · ${title}` : `${title} | ${config.siteName}`;
  const ogImage = image || abs('/og.png');
  return `<!doctype html>
<html lang="${market.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(fullTitle)}</title>
<meta name="description" content="${e(description)}">
<link rel="canonical" href="${abs(pathname)}">
${noindex || SAMPLE ? '<meta name="robots" content="noindex">' : '<meta name="robots" content="index, follow, max-image-preview:large">'}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${e(config.siteName)}">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${abs(pathname)}">
<meta property="og:image" content="${e(ogImage)}">
<meta property="og:locale" content="${market.locale.replace('-', '_')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#4f2bd9">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${e(config.siteName)}" href="/rss.xml">
<link rel="stylesheet" href="/styles.css?v=${buildId}">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
${SAMPLE ? '<div class="sample">Vista previa con productos de EJEMPLO. No son ofertas reales.</div>' : ''}
<header class="top">
  <div class="wrap top-in">
    <a class="logo" href="/" aria-label="${e(config.siteName)} inicio"><span class="logo-mark">∞</span><span>${e(config.siteName.replace(/Ofertas$/, ''))}<b>Ofertas</b></span></a>
    <nav class="top-nav">${coupons.length ? '<a href="/cupones/">Cupones</a>' : ''}<a href="/acerca/">Cómo funciona</a></nav>
    ${joinButtons()}
  </div>
</header>
<div id="refresh" class="refresh" hidden><span>Hay ofertas nuevas</span><button type="button" onclick="location.reload()">Actualizar</button></div>
<main>
${body}
</main>
<footer class="foot">
  <div class="wrap">
    <p><strong>${e(config.siteName)}</strong> es un sitio independiente que reúne ofertas publicadas en Mercado Libre ${e(market.name)}. No somos Mercado Libre ni estamos operados por ellos.</p>
    <p>Participamos en el programa de Afiliados de Mercado Libre: si compras desde nuestros enlaces podemos recibir una comisión, sin costo extra para ti. Los precios y la disponibilidad pueden cambiar en cualquier momento; confirma siempre el precio final en Mercado Libre.</p>
    <p class="foot-links"><a href="/">Inicio</a><a href="/acerca/">Cómo funciona</a>${coupons.length ? '<a href="/cupones/">Cupones</a>' : ''}<a href="/rss.xml">RSS</a></p>
    <p class="muted">Actualizado: ${e(updatedLabel)}</p>
  </div>
</footer>
<script>window.BUILD_ID=${JSON.stringify(buildId)}</script>
<script src="/app.js?v=${buildId}" defer></script>
</body>
</html>
`;
}

const org = { '@type': 'Organization', name: config.siteName, url: config.baseUrl, logo: abs('/favicon.svg') };
const breadcrumbs = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(p) })),
});
const itemList = (list) => ({
  '@context': 'https://schema.org', '@type': 'ItemList',
  itemListElement: list.slice(0, 30).map((d, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(d.page), name: d.title })),
});

// ---------- home ----------
const top = active.slice(0, config.deals.homeLimit);
const bestDiscount = active[0]?.discount ?? 0;
const lightning = active.filter((d) => d.lightning).slice(0, 8);
write('/', layout({
  title: 'Ofertas y descuentos de Mercado Libre hoy',
  description: `${active.length ? `${active.length} ofertas activas con hasta ${bestDiscount}% de descuento. ` : ''}Las mejores ofertas de Mercado Libre ${market.name}, revisadas y actualizadas automáticamente varias veces al día.`,
  pathname: '/',
  jsonld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: config.siteName, url: config.baseUrl, publisher: org }, itemList(top)],
  body: `<section class="hero">
  <div class="wrap">
    <p class="eyebrow"><span class="live"></span>Actualizado ${e(updatedLabel)}</p>
    <h1>Las mejores ofertas de <span class="hl">Mercado Libre</span> en un solo lugar</h1>
    <p class="lead">${e(config.tagline)}</p>
    <div class="stats"><div><b>${active.length}</b><span>ofertas activas</span></div><div><b>${bestDiscount}%</b><span>mayor descuento</span></div><div><b>${categories.filter((c) => c.deals.length).length}</b><span>categorías</span></div></div>
    ${joinButtons() ? `<div class="hero-join"><span>Recibe las ofertas al instante:</span>${joinButtons()}</div>` : ''}
  </div>
</section>
<div class="wrap">
  ${chips()}
  ${lightning.length >= 3 ? `<section class="section"><h2 class="h2">${icon.bolt} Ofertas relámpago</h2><div class="rail">${lightning.map(card).join('')}</div></section>` : ''}
  <section class="section"><h2 class="h2">🔥 Ofertas de hoy</h2>${grid(top)}</section>
</div>`,
}));

// ---------- categories ----------
for (const c of categories) {
  const maxOff = c.deals[0]?.discount ?? 0;
  write(`/categoria/${c.slug}/`, layout({
    title: `Ofertas en ${c.name} en Mercado Libre`,
    description: `${c.deals.length} ofertas en ${c.name.toLowerCase()}${maxOff ? ` con hasta ${maxOff}% de descuento` : ''} en Mercado Libre ${market.name}. Precios actualizados varias veces al día.`,
    pathname: `/categoria/${c.slug}/`,
    jsonld: [breadcrumbs([['Inicio', '/'], [c.name, `/categoria/${c.slug}/`]]), itemList(c.deals)],
    body: `<div class="wrap">
  <nav class="crumbs" aria-label="Ruta"><a href="/">Inicio</a><span>›</span><span>${e(c.name)}</span></nav>
  <header class="page-head"><h1>${c.emoji} Ofertas en ${e(c.name)}</h1><p class="lead">${c.deals.length ? `${c.deals.length} ofertas activas${maxOff ? `, con descuentos de hasta ${maxOff}%` : ''}.` : 'Ahora mismo no hay ofertas en esta categoría.'} Revisamos Mercado Libre ${e(market.name)} automáticamente y solo mostramos productos con descuento real frente a su precio anterior.</p></header>
  ${chips(c.slug)}
  <section class="section">${grid(c.deals)}</section>
</div>`,
  }));
}

// ---------- deal pages ----------
const dateFmt = new Intl.DateTimeFormat(market.locale, { dateStyle: 'long', timeZone: timeZoneFor(config.country) });
for (const d of deals) {
  const cat = categoryBySlug(d.category);
  const related = active.filter((x) => x.category === d.category && x.id !== d.id).slice(0, 8);
  const save = d.originalPrice ? d.originalPrice - d.price : 0;
  const shareText = `${d.discount ? `🔥 -${d.discount}% ` : ''}${d.title} por ${price(d.price)}${d.originalPrice ? ` (antes ${price(d.originalPrice)})` : ''}`;
  const pageUrl = abs(d.page);
  write(d.page, layout({
    title: `${d.title}${d.discount ? ` con ${d.discount}% de descuento` : ''}`,
    description: `${d.title} a ${price(d.price)}${d.originalPrice ? ` (antes ${price(d.originalPrice)}, ahorras ${price(save)})` : ''} en Mercado Libre ${market.name}.${d.freeShipping ? ' Envío gratis.' : ''} Precio visto el ${dateFmt.format(Date.parse(d.lastSeen))}.`,
    pathname: d.page,
    image: d.image,
    type: 'product',
    noindex: !d.active,
    jsonld: [
      breadcrumbs([['Inicio', '/'], [cat.name, `/categoria/${cat.slug}/`], [d.title, d.page]]),
      {
        '@context': 'https://schema.org', '@type': 'Product', name: d.title, ...(d.image ? { image: [d.image] } : {}),
        offers: {
          '@type': 'Offer', price: d.price, priceCurrency: d.currency || market.currency, url: pageUrl,
          availability: d.active ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          seller: { '@type': 'Organization', name: 'Mercado Libre' },
        },
      },
    ],
    body: `<div class="wrap">
  <nav class="crumbs" aria-label="Ruta"><a href="/">Inicio</a><span>›</span><a href="/categoria/${cat.slug}/">${e(cat.name)}</a></nav>
  <article class="deal">
    <div class="deal-media">${media(d, 'deal-img')}${d.discount ? `<span class="badge off big">-${d.discount}%</span>` : ''}</div>
    <div class="deal-info">
      ${d.active ? '' : '<p class="notice">Esta oferta ya no aparece en Mercado Libre. El precio pudo haber cambiado.</p>'}
      <h1>${e(d.title)}</h1>
      <div class="prices big"><span class="now">${price(d.price)}</span>${d.originalPrice ? `<s>${price(d.originalPrice)}</s>` : ''}</div>
      ${save ? `<p class="save">Ahorras ${price(save)}</p>` : ''}
      <ul class="facts">
        ${d.freeShipping ? `<li>${icon.truck}Envío gratis</li>` : ''}
        ${d.lightning ? `<li>${icon.bolt}Oferta relámpago: puede terminar en pocas horas</li>` : ''}
        ${d.rating ? `<li>⭐ ${d.rating} de calificación</li>` : ''}
        <li>🕒 Precio visto el ${e(dateFmt.format(Date.parse(d.lastSeen)))}</li>
      </ul>
      <a class="btn btn-xl" href="${e(d.buyUrl)}" ${buyAttrs}>${d.active ? 'Ver oferta en Mercado Libre' : 'Ver precio actual en Mercado Libre'}</a>
      <p class="fine">El precio final, el envío y la disponibilidad se confirman en Mercado Libre. Enlace de afiliado.</p>
      <div class="share">
        <span>Compartir:</span>
        <a class="share-wa" href="https://wa.me/?text=${encodeURIComponent(`${shareText}\n${pageUrl}`)}" target="_blank" rel="noopener">${icon.whatsapp}WhatsApp</a>
        <a class="share-tg" href="https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener">${icon.telegram}Telegram</a>
        <button type="button" data-copy="${e(pageUrl)}">Copiar enlace</button>
      </div>
    </div>
  </article>
  ${related.length ? `<section class="section"><h2 class="h2">Más ofertas en ${e(cat.name)}</h2><div class="grid">${related.map(card).join('')}</div></section>` : ''}
</div>`,
  }));
}

// ---------- coupons ----------
if (coupons.length) {
  write('/cupones/', layout({
    title: 'Cupones y códigos de descuento de Mercado Libre',
    description: `Cupones y códigos promocionales vigentes para Mercado Libre ${market.name}.`,
    pathname: '/cupones/',
    body: `<div class="wrap"><header class="page-head"><h1>🎟️ Cupones y códigos</h1><p class="lead">Cupones públicos vigentes. Algunos cupones de Mercado Libre son personales y solo aparecen en tu cuenta.</p></header>
  <div class="coupons">${coupons.map((c) => `<div class="coupon"><div><h3>${e(c.title)}</h3>${c.description ? `<p>${e(c.description)}</p>` : ''}${c.expiresAt ? `<p class="muted">Vence: ${e(dateFmt.format(Date.parse(c.expiresAt)))}</p>` : ''}</div><div class="coupon-act">${c.code ? `<button type="button" class="code" data-copy="${e(c.code)}">${e(c.code)}</button>` : ''}${c.url ? `<a class="btn" href="${e(c.url)}" ${buyAttrs}>Usar cupón</a>` : ''}</div></div>`).join('')}</div></div>`,
  }));
}

// ---------- about ----------
write('/acerca/', layout({
  title: 'Cómo funciona',
  description: `Cómo encontramos las ofertas de Mercado Libre que publicamos en ${config.siteName}.`,
  pathname: '/acerca/',
  body: `<div class="wrap prose">
  <h1>Cómo funciona ${e(config.siteName)}</h1>
  <p>Revisamos automáticamente las secciones públicas de ofertas de Mercado Libre ${e(market.name)} varias veces al día y publicamos solo productos cuyo precio actual es menor que su precio anterior.</p>
  <h2>¿Cuánto cuesta?</h2><p>Nada. Compras directamente en Mercado Libre, con sus mismas garantías, envíos y medios de pago.</p>
  <h2>¿Cómo ganamos dinero?</h2><p>Participamos en el programa de Afiliados de Mercado Libre. Cuando compras desde uno de nuestros enlaces podemos recibir una pequeña comisión, sin costo adicional para ti. Esto no cambia qué ofertas mostramos.</p>
  <h2>¿Los precios son exactos?</h2><p>Mostramos el precio que vimos en la fecha indicada en cada oferta. Las ofertas pueden terminar o cambiar en cualquier momento, sobre todo las relámpago. Confirma siempre el precio final antes de pagar.</p>
  <h2>¿Son parte de Mercado Libre?</h2><p>No. Somos un sitio independiente. "Mercado Libre" es una marca de su respectivo dueño.</p>
  <h2>Privacidad</h2><p>No pedimos registro ni guardamos datos personales. Las preferencias de filtros solo se usan dentro de tu navegador.</p>
  ${joinButtons() ? `<h2>Recibe las ofertas al instante</h2>${joinButtons()}` : ''}
</div>`,
}));

// ---------- WhatsApp / Telegram share helper (not indexed) ----------
const fresh = active.filter((d) => now - Date.parse(d.firstSeen) < 864e5).slice(0, 10);
const digestDeals = fresh.length >= 3 ? fresh : active.slice(0, 10);
const digest = [`🔥 *Ofertas de hoy en Mercado Libre* 🔥`, '',
  ...digestDeals.map((d) => `${d.discount ? `*-${d.discount}%* ` : ''}${d.title.slice(0, 80)}\n💰 ${price(d.price)}${d.originalPrice ? ` ~${price(d.originalPrice)}~` : ''}\n👉 ${abs(d.page)}\n`),
  `Más ofertas: ${config.baseUrl}`].join('\n');
write('/compartir/', layout({
  title: 'Compartir ofertas',
  description: 'Mensaje listo para compartir.',
  pathname: '/compartir/',
  noindex: true,
  body: `<div class="wrap prose"><h1>Mensaje del día para WhatsApp</h1>
  <p>Toca <b>Enviar por WhatsApp</b> y elige tu grupo o canal. También puedes copiarlo.</p>
  <textarea id="digest" rows="16" readonly>${e(digest)}</textarea>
  <div class="share"><a class="btn share-wa" href="https://wa.me/?text=${encodeURIComponent(digest)}" target="_blank" rel="noopener">${icon.whatsapp}Enviar por WhatsApp</a><button type="button" data-copy-from="digest">Copiar mensaje</button></div>
</div>`,
}));

// ---------- 404, feeds, sitemap ----------
write('404.html', layout({
  title: 'Página no encontrada', description: 'Esta oferta ya no existe.', pathname: '/404.html', noindex: true,
  body: `<div class="wrap empty"><p class="empty-emoji">🔎</p><h1>Esta oferta ya terminó</h1><p>Las ofertas cambian rápido. Mira las que siguen activas:</p><p><a class="btn" href="/">Ver ofertas de hoy</a></p></div>`,
}));

const rssItems = [...active].sort((a, b) => b.firstSeen.localeCompare(a.firstSeen)).slice(0, 50);
write('rss.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${e(config.siteName)}</title><link>${config.baseUrl}/</link><description>${e(config.tagline)}</description><language>${market.locale}</language>
${rssItems.map((d) => `<item><title>${e(`${d.discount ? `-${d.discount}% ` : ''}${d.title} · ${price(d.price)}`)}</title><link>${abs(d.page)}</link><guid isPermaLink="false">${d.id}</guid><pubDate>${new Date(d.firstSeen).toUTCString()}</pubDate>${d.image ? `<enclosure url="${e(d.image)}" type="image/jpeg" length="0"/>` : ''}</item>`).join('\n')}
</channel></rss>
`);

const sitemapPaths = ['/', '/acerca/', ...(coupons.length ? ['/cupones/'] : []), ...categories.filter((c) => c.deals.length).map((c) => `/categoria/${c.slug}/`), ...active.map((d) => d.page)];
const lastmod = new Date(now).toISOString();
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapPaths.map((p) => `<url><loc>${abs(p)}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}
</urlset>
`);
write('robots.txt', SAMPLE ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nDisallow: /compartir/\n\nSitemap: ${abs('/sitemap.xml')}\n`);
write('version.json', JSON.stringify({ buildId, updatedAt: lastmod, active: active.length }));
write('.nojekyll', '');
if (config.customDomain && !SAMPLE) write('CNAME', config.customDomain + '\n');

console.log(`Built ${active.length} active deals, ${deals.length} deal pages, ${categories.length} categories${SAMPLE ? ' (SAMPLE DATA)' : ''} -> dist/`);
if (!SAMPLE && !affiliateConfigured(config) && !Object.keys(links).length) {
  console.warn('! Affiliate tracking is not configured yet (site.config.json -> affiliate.params). Links will not earn commission.');
}
