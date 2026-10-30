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
      const label = btn.textContent;
      btn.textContent = '¡Copiado!';
      setTimeout(() => { btn.textContent = label; }, 1500);
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
