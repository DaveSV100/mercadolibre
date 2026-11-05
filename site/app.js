// Small client-side helpers: relative times, search/sort/filter, copy buttons and "new deals" notice.
(() => {
  const rtf = new Intl.RelativeTimeFormat(document.documentElement.lang || 'es', { numeric: 'auto' });
  const rel = (iso) => {
    const mins = Math.round((Date.parse(iso) - Date.now()) / 60000);
    if (Math.abs(mins) < 60) return rtf.format(mins, 'minute');
    const hours = Math.round(mins / 60);
    if (Math.abs(hours) < 48) return rtf.format(hours, 'hour');
    return rtf.format(Math.round(hours / 24), 'day');
  };
  const paintTimes = () => document.querySelectorAll('time[data-rel]').forEach((t) => { t.textContent = rel(t.dateTime); });
  paintTimes();
  setInterval(paintTimes, 60000);

  // Search, sort and filters on listing pages.
  const grid = document.getElementById('grid');
  const q = document.getElementById('q');
  if (grid && q) {
    const sort = document.getElementById('sort');
    const min = document.getElementById('min');
    const ship = document.getElementById('ship');
    const none = document.getElementById('noresults');
    const cards = [...grid.children];
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const titles = new Map(cards.map((c) => [c, norm(c.dataset.title)]));
    const sorters = {
      discount: (a, b) => b.dataset.discount - a.dataset.discount,
      new: (a, b) => b.dataset.time.localeCompare(a.dataset.time),
      low: (a, b) => a.dataset.price - b.dataset.price,
      high: (a, b) => b.dataset.price - a.dataset.price,
    };
    const apply = () => {
      const words = norm(q.value).split(/\s+/).filter(Boolean);
      let shown = 0;
      for (const c of cards) {
        const ok = words.every((w) => titles.get(c).includes(w))
          && Number(c.dataset.discount) >= Number(min.value)
          && (!ship.checked || c.dataset.ship === '1');
        c.hidden = !ok;
        if (ok) shown++;
      }
      grid.append(...[...cards].sort(sorters[sort.value]));
      none.hidden = shown > 0;
    };
    [q, sort, min, ship].forEach((el) => el.addEventListener('input', apply));
  }

  // Copy buttons.
  document.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-copy],[data-copy-from]');
    if (!btn) return;
    const text = btn.dataset.copy ?? document.getElementById(btn.dataset.copyFrom)?.value ?? '';
    try {
      await navigator.clipboard.writeText(text);
      const target = btn.querySelector('[data-copy-label]') ?? btn;
      const label = target.textContent;
      target.textContent = '¡Copiado!';
      btn.classList.add('copied');
      setTimeout(() => { target.textContent = label; btn.classList.remove('copied'); }, 1500);
    } catch { /* clipboard not available */ }
  });

  // Back-to-top button.
  const totop = document.getElementById('totop');
  if (totop) {
    const toggle = () => { totop.hidden = window.scrollY < 600; };
    window.addEventListener('scroll', toggle, { passive: true });
    totop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    toggle();
  }

  // Share page: remember (in this browser, for today) which deals were already sent.
  const sentKey = `sent-${new Date().toISOString().slice(0, 10)}`;
  let sent = [];
  try { sent = JSON.parse(localStorage.getItem(sentKey) ?? '[]'); } catch { /* storage unavailable */ }
  document.querySelectorAll('[data-sent-key]').forEach((li) => {
    if (sent.includes(li.dataset.sentKey)) li.classList.add('sent');
    li.querySelectorAll('[data-mark-sent], .sh-copy').forEach((a) => a.addEventListener('click', () => {
      li.classList.add('sent');
      if (!sent.includes(li.dataset.sentKey)) sent.push(li.dataset.sentKey);
      try { localStorage.setItem(sentKey, JSON.stringify(sent)); } catch { /* storage unavailable */ }
    }));
  });

  // Owner pages: a code screen (compared by SHA-256) hides the tools from visitors.
  const sha256 = async (text) => {
    if (window.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return sha256Fallback(text); // crypto.subtle only exists on https pages
  };
  document.querySelectorAll('[data-admin-gate]').forEach((gate) => {
    const form = gate.querySelector('form');
    const unlock = () => { form.hidden = true; gate.querySelector('[data-admin]').hidden = false; };
    let saved = null;
    try { saved = localStorage.getItem('admin-code'); } catch { /* storage unavailable */ }
    if (saved === gate.dataset.adminGate) unlock();
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const hash = await sha256(`infiniofertas:${form.querySelector('input').value.trim()}`);
      if (hash !== gate.dataset.adminGate) { form.querySelector('.gate-msg').textContent = 'Código incorrecto.'; return; }
      try { localStorage.setItem('admin-code', hash); } catch { /* storage unavailable */ }
      unlock();
    });
  });

  // Publishing opens a pre-filled GitHub issue; the "Publicar cupones" workflow (owner only) applies it.
  const adminData = document.getElementById('admin-data');
  const openIssue = (title, payload) => {
    const { repo } = JSON.parse(adminData.textContent);
    const body = '```json\n' + JSON.stringify(payload, null, 1) + '\n```';
    window.open(`https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`, '_blank');
  };
  const cpPublish = document.getElementById('cp-publish');
  if (cpPublish) {
    const until = document.getElementById('cp-until');
    until.value = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    cpPublish.addEventListener('click', () => {
      const text = document.getElementById('cp-text').value.trim();
      const url = document.getElementById('cp-url').value.trim();
      const msg = document.getElementById('cp-msg');
      if (!text) { msg.textContent = 'Pega el texto del cupón.'; return; }
      openIssue(`Cupón: ${text.replace(/\s+/g, ' ').slice(0, 50)}`, { action: 'add', text, expiresAt: until.value || null, url: url || null });
      msg.textContent = 'Listo: en GitHub toca "Submit new issue". En unos 3 minutos aparece en el sitio.';
    });
  }
  document.querySelectorAll('[data-remove-coupon]').forEach((btn) => btn.addEventListener('click', () => {
    openIssue('Quitar cupón', { action: 'remove', id: btn.dataset.removeCoupon });
    btn.textContent = 'Abierto en GitHub';
  }));

  // Official affiliate links page: pair the generated meli.la links with the listed deals (same order) and
  // open a pre-filled GitHub issue that the "Guardar enlaces" workflow turns into data/affiliate-links.json.
  const saveLinks = document.getElementById('save-links');
  if (saveLinks) {
    const { ids, repo } = JSON.parse(document.getElementById('links-data').textContent);
    const msg = document.getElementById('links-msg');
    saveLinks.addEventListener('click', () => {
      const found = document.getElementById('done').value.match(/https:\/\/meli\.la\/[A-Za-z0-9]+/g) ?? [];
      if (found.length !== ids.length) {
        msg.textContent = `Pegaste ${found.length} enlaces meli.la, pero se esperan ${ids.length} (uno por producto, en el mismo orden).`;
        return;
      }
      const map = Object.fromEntries(ids.map((id, i) => [id, found[i]]));
      const body = '```json\n' + JSON.stringify(map, null, 1) + '\n```';
      window.open(`https://github.com/${repo}/issues/new?title=${encodeURIComponent('Enlaces de afiliado')}&body=${encodeURIComponent(body)}`, '_blank');
      msg.textContent = 'Listo: en GitHub toca "Submit new issue".';
    });
  }

  // Tell visitors when a newer version of the site (new deals) has been published.
  const check = async () => {
    try {
      const res = await fetch(`${window.BASE ?? ''}/version.json`, { cache: 'no-store' });
      const { buildId } = await res.json();
      if (buildId && buildId !== window.BUILD_ID) document.getElementById('refresh').hidden = false;
    } catch { /* offline */ }
  };
  setInterval(check, 5 * 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
})();

// Minimal SHA-256 for http pages (no crypto.subtle). Only used by the owner code screen.
function sha256Fallback(ascii) {
  const rotr = (v, n) => (v >>> n) | (v << (32 - n));
  const K = [];
  const H = [];
  let primes = 0;
  for (let c = 2; primes < 64; c++) {
    if ([...Array(c - 2)].some((_, i) => c % (i + 2) === 0)) continue;
    if (primes < 8) H[primes] = (Math.pow(c, 1 / 2) * 2 ** 32) | 0;
    K[primes++] = (Math.pow(c, 1 / 3) * 2 ** 32) | 0;
  }
  const bytes = [...new TextEncoder().encode(ascii)];
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (bitLen >>> (i * 8)) & 0xff);
  for (let j = 0; j < bytes.length; j += 64) {
    const w = [];
    for (let i = 0; i < 16; i++) w[i] = (bytes[j + i * 4] << 24) | (bytes[j + i * 4 + 1] << 16) | (bytes[j + i * 4 + 2] << 8) | bytes[j + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      [h, g, f, e, d, c, b, a] = [g, f, e, (d + t1) | 0, c, b, a, (t1 + t2) | 0];
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) | 0; });
  }
  return H.map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
}
