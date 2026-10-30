// One-time Telegram channel setup: profile photo and description.
// Run from GitHub: Actions -> "Configurar Telegram" -> Run workflow. The bot needs the "Change channel info" right.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadConfig } from './lib/core.mjs';

const token = process.env.TELEGRAM_BOT_TOKEN;
const chat = (process.env.TELEGRAM_CHAT_ID ?? '').split(',')[0].trim();
if (!token || !chat) throw new Error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not set');
const config = loadConfig();
const host = config.baseUrl.replace(/^https?:\/\//, '');

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', body });
  const json = await res.json();
  console.log(`${method}: ${json.ok ? 'ok' : json.description}`);
  return json.ok;
}

const photo = new FormData();
photo.set('chat_id', chat);
photo.set('photo', new Blob([fs.readFileSync(path.join(ROOT, 'brand/telegram-avatar.png'))], { type: 'image/png' }), 'avatar.png');
const photoOk = await call('setChatPhoto', photo);

const about = new FormData();
about.set('chat_id', chat);
about.set('description', `🔥 Las mejores ofertas y descuentos de Mercado Libre México, todos los días.\n🛒 Más ofertas: ${host}\nEnlaces de afiliado.`);
const aboutOk = await call('setChatDescription', about);

if (!photoOk || !aboutOk) process.exitCode = 1;
