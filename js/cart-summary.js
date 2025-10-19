/* Cart Summary and WhatsApp integration
 - Renders summary (original, discount, total) in #cart-summary
 - Builds a WhatsApp message including items and totals with discount from config.json
*/
(function(){
  const CART_STORAGE_KEY = 'cart:v1';
  const WHATSAPP_PHONE = '+201018288736'; // change if needed
  const SUMMARY_SELECTOR = '#cart-summary';
  const WHATSAPP_BTN_SELECTOR = '#checkoutWhatsApp';

  async function fetchProducts(){
    const res = await fetch('data/products.json', { cache: 'no-store' });
    const data = await res.json();
    return data || {};
  }

  function loadCart(){
    try{ return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)||'{}')||{}; }catch{ return {}; }
  }

  function toNumber(x){ const n = Number(x); return isFinite(n) ? n : 0; }
  function round2(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }
  function formatMoney(n){ try { return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(n); } catch { return n.toFixed(2);} }

  function pickDefaultWeight(weights, prod){
    if(!Array.isArray(weights) || !weights.length) return null;
    if(prod && prod.defaultWeightId){ const byId = weights.find(w=> String(w.id)===String(prod.defaultWeightId)); if(byId) return byId; }
    const byFlag = weights.find(w=> w && w.default===true); if(byFlag) return byFlag;
    const inStock = weights.find(w=> w && w.inStock!==false); if(inStock) return inStock;
    return weights[0];
  }

  function buildCartLines(cart, products){
    const prods = products.products || [];
    const lines = [];
    for(const [id, qty] of Object.entries(cart)){
      const q = toNumber(qty);
      if(q<=0) continue;
      const p = prods.find(x=> String(x.id)===String(id));
      if(!p) continue;
      let unit = toNumber(p.price||0);
      if(!unit && Array.isArray(p.weights)){
        const v = pickDefaultWeight(p.weights, p);
        if(v) unit = toNumber(v.price||0);
      }
      const lineTotal = round2(unit * q);
      lines.push({ id, title: p.title || id, qty: q, unit, total: lineTotal, currency: p.currency || products.currency || 'EGP' });
    }
    return lines;
  }

  function calcTotals(lines){
    const subtotal = round2(lines.reduce((s,l)=> s + toNumber(l.total), 0));
    return { subtotal };
  }

  async function renderSummary(){
    const container = document.querySelector(SUMMARY_SELECTOR);
    if(!container) return;

    const [products, cfg] = await Promise.all([
      fetchProducts(),
      window.Discount.getConfig().catch(()=>({ active:false, percentage:0 }))
    ]);

    const cart = loadCart();
    const lines = buildCartLines(cart, products);
    const { subtotal } = calcTotals(lines);

    const active = (cfg && cfg.active && isWithin(cfg.start, cfg.end) && toNumber(cfg.percentage)>0);
    const pct = active ? toNumber(cfg.percentage) : 0;
    const calc = window.Discount.applyToAmount(subtotal, pct);

    container.innerHTML = `
      <div class="discount-summary">
        <div class="row"><span>السعر الأصلي:</span><span>${formatMoney(calc.original)} ج.م</span></div>
        <div class="row"><span>الخصم (${calc.percentage}%):</span><span>- ${formatMoney(calc.discountAmount)} ج.م</span></div>
        <div class="row total"><span>الإجمالي بعد الخصم:</span><span>${formatMoney(calc.total)} ج.م ✅</span></div>
      </div>
    `;

    // Bind WhatsApp button (if exists)
    const btn = document.querySelector(WHATSAPP_BTN_SELECTOR);
    if(btn){
      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        const text = buildWhatsAppMessage(lines, calc, pct);
        const url = `https://wa.me/${encodeURIComponent(WHATSAPP_PHONE)}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
      });
    }
  }

  function buildWhatsAppMessage(lines, calc, pct){
    const itemsText = lines.map(l=> `• ${l.title} × ${l.qty} = ${formatMoney(l.total)} ج.م`).join('\n');
    const totalsText = [
      `السعر الأصلي: ${formatMoney(calc.original)} ج.م`,
      `الخصم (${pct}%): -${formatMoney(calc.discountAmount)} ج.م`,
      `الإجمالي بعد الخصم: ${formatMoney(calc.total)} ج.م`
    ].join('\n');
    const header = 'طلب جديد عبر الموقع:';
    return `${header}\n\n${itemsText}\n\n${totalsText}\n\nشكراً لكم`;
  }

  function isWithin(start, end){
    const now = new Date();
    return (!start || now>=start) && (!end || now<=end);
  }

  async function update(){
    try{ await renderSummary(); }catch(err){ console.error(err); }
  }

  // Auto-update on load and when cart changes
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', update);
  }else{ update(); }
  document.addEventListener('cart:change', update);
})();
