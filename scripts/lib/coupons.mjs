// Turns the coupon text the owner pastes on /publicar/ into coupon cards.
// Expected shape (as copied from the affiliates calendar), one block per coupon:
//   🎟️Cupón: PREDDHOT
//   10% de descuento
//   Compra minima: $700
//   Descuento máximo: $90
// plus optional "Productos que aplican: <url>", "Vigencia: ...", section titles like *CUPONES ESPECIALES*
// and notes like *Recuerda validar en los productos que aplican*.

const money = (s) => s.replace(/\s+/g, '').replace(/(\d)\.(?=\d{3}\b)/g, '$1,');

export function parseCouponText(text) {
  const coupons = [];
  const notes = [];
  let current = null;
  let featuredNext = false;

  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const starred = line.match(/^\*(.+)\*$/)?.[1].trim();
    let m;

    if (starred && starred === starred.toUpperCase()) {
      // Section title, e.g. *CUPONES ESPECIALES* or *COMISIÓN EXTRA*: the next coupon is highlighted.
      featuredNext = true;
    } else if ((m = line.match(/cup[óo]n\s*:?\s*([A-Z0-9]{4,24})\b/i))) {
      current = { code: m[1].toUpperCase(), benefit: null, minPurchase: null, maxDiscount: null, appliesUrl: null, validity: null, featured: featuredNext };
      featuredNext = false;
      coupons.push(current);
    } else if (starred) {
      if (!notes.includes(starred)) notes.push(starred);
    } else if (!current) {
      // Intro text before the first coupon (e.g. "Copia cupones:") is not shown.
    } else if ((m = line.match(/^(\d+(?:[.,]\d+)?\s*%|\$\s*[\d.,]+)\s*(?:de\s+)?(?:descuento|off)/i))) {
      current.benefit = money(m[1]);
    } else if ((m = line.match(/compra\s+m[ií]nima\s*:?\s*(\$?\s*[\d.,]+)/i))) {
      current.minPurchase = money(m[1]);
    } else if ((m = line.match(/(?:descuento|tope)\s+m[áa]ximo\s*:?\s*(\$?\s*[\d.,]+)/i))) {
      current.maxDiscount = money(m[1]);
    } else if ((m = line.match(/(https?:\/\/\S+)/))) {
      current.appliesUrl = m[1];
    } else if ((m = line.match(/^vigencia\s*:?\s*(.+)$/i))) {
      current.validity = m[1];
    }
  }
  return { coupons, notes };
}
