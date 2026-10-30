// Posts the best new deals to Telegram. Needs two secrets (set them in GitHub, never in the code):
//   TELEGRAM_BOT_TOKEN  from @BotFather
//   TELEGRAM_CHAT_ID    e.g. @your_channel (several allowed, comma-separated)
// node scripts/post-telegram.mjs --dry-run   prints the messages without sending.
import {
  affiliateUrl, categoryBySlug, dealPath, escapeHtml as e, formatPrice, isActive, loadConfig, readJson, writeJson,
} from './lib/core.mjs';

const DRY = process.argv.includes('--dry-run');
const token = process.env.TELEGRAM_BOT_TOKEN;
const chats = (process.env.TELEGRAM_CHAT_ID ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (!DRY && (!token || !chats.length)) {
  console.log('Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID). Skipping.');
  process.exit(0);
}

const config = loadConfig();
const { market } = config;
const now = Date.now();
const links = readJson('data/affiliate-links.json', {});
const posted = readJson('data/posted.json', {});
const repostMs = config.telegram.repostAfterDays * 864e5;

const queue = readJson('data/deals.json', [])
  .filter((d) => isActive(d, config, now) && d.discount >= config.telegram.minDiscount)
  // Deals with an official meli.la link (see /enlaces/ on the site) go first; onlyOfficialLinks posts nothing else.
  .filter((d) => !config.telegram.onlyOfficialLinks || links[d.id])
  .filter((d) => !posted[d.id] || now - Date.parse(posted[d.id].at) > repostMs || d.price < posted[d.id].price * 0.95)
  .sort((a, b) => Boolean(links[b.id]) - Boolean(links[a.id]) || b.discount - a.discount)
  .slice(0, config.telegram.maxPerRun);

function message(d) {
  const cat = categoryBySlug(d.category);
  const lines = [
    `${d.lightning ? '⚡ <b>OFERTA RELÁMPAGO</b>\n' : ''}🔥 <b>-${d.discount}%</b> · ${e(d.title)}`,
    '',
    `💰 <b>${formatPrice(d.price, market)}</b>${d.originalPrice ? `  <s>${formatPrice(d.originalPrice, market)}</s>` : ''}`,
    d.freeShipping ? '🚚 Envío gratis' : null,
    '',
    `${cat.emoji} Más ofertas: ${config.baseUrl}/categoria/${cat.slug}/`,
  ];
  return lines.filter((l) => l !== null).join('\n');
}

async function send(chat, d) {
  const body = {
    chat_id: chat,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[
      { text: '🛒 Ver oferta', url: affiliateUrl(d, config, links) },
      { text: '🔎 Detalles', url: config.baseUrl + dealPath(d) },
    ]] },
  };
  const method = d.image ? 'sendPhoto' : 'sendMessage';
  if (d.image) Object.assign(body, { photo: d.image, caption: message(d) });
  else Object.assign(body, { text: message(d), link_preview_options: { is_disabled: true } });

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const json = await res.json();
  // A photo Telegram can't download shouldn't lose the post: retry as text.
  if (!json.ok && d.image) return send(chat, { ...d, image: null });
  if (!json.ok) throw new Error(json.description);
}

let sent = 0;
for (const d of queue) {
  if (DRY) {
    console.log(`--- ${d.id}\n${message(d)}\n`);
    continue;
  }
  try {
    for (const chat of chats) await send(chat, d);
    posted[d.id] = { at: new Date(now).toISOString(), price: d.price };
    sent++;
  } catch (err) {
    console.warn(`! ${d.id}: ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 3500));
}

if (!DRY) {
  for (const [id, p] of Object.entries(posted)) if (now - Date.parse(p.at) > 30 * 864e5) delete posted[id];
  writeJson('data/posted.json', posted);
}
console.log(`${DRY ? 'Would post' : 'Posted'} ${DRY ? queue.length : sent} deal(s) to Telegram.`);
