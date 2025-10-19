(function(){
  const ITEMS_LIST = document.getElementById('cartItems');
  const SUBTOTAL_EL = document.getElementById('subtotal');
  const PRODUCTS_DISCOUNT_EL = document.getElementById('productsDiscount');
  const AFTER_PRODUCTS_EL = document.getElementById('afterProducts');
  const SITE_DISCOUNT_EL = document.getElementById('siteDiscount');
  const SHIPPING_EL = document.getElementById('shipping');
  const GRAND_EL = document.getElementById('grandTotal');
  const PLACE_BTN = document.getElementById('placeOrder');
  const FORM = document.getElementById('checkoutForm');
  // Empty cart modal elements
  const EMPTY_MODAL = document.getElementById('emptyCartModal');
  const GO_SHOP_BTN = document.getElementById('goShopBtn');
  const DISMISS_EMPTY_BTN = document.getElementById('dismissEmptyBtn');
  // WhatsApp note modal elements
  const WA_NOTE_MODAL = document.getElementById('waNoteModal');
  const WA_NOTE_CONFIRM = document.getElementById('waNoteConfirm');
  const WA_NOTE_CANCEL = document.getElementById('waNoteCancel');

  // Helpers to open/close modal safely
  const showEmptyModal = ()=>{
    if(!EMPTY_MODAL) return false;
    EMPTY_MODAL.hidden = false; 
    EMPTY_MODAL.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open');
    return true;
  };
  const hideEmptyModal = ()=>{
    if(!EMPTY_MODAL) return;
    EMPTY_MODAL.hidden = true; 
    EMPTY_MODAL.setAttribute('aria-hidden','true');
    document.body.classList.remove('modal-open');
  };

  // Helpers for WhatsApp note modal
  const showWaNote = ()=>{
    if(!WA_NOTE_MODAL) return false;
    WA_NOTE_MODAL.hidden = false;
    WA_NOTE_MODAL.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open');
    return true;
  };
  const hideWaNote = ()=>{
    if(!WA_NOTE_MODAL) return;
    WA_NOTE_MODAL.hidden = true;
    WA_NOTE_MODAL.setAttribute('aria-hidden','true');
    document.body.classList.remove('modal-open');
  };

  const priceFmt = (v)=> `${Number(v||0).toFixed(2).replace(/\.00$/,'')} ج.م`;
  const SHIPPING_MESSAGE = 'سيتم تأكيد سعر التوصيل عند تأكيد الطلب';
  // Integrations
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwRCAKVryo7COCeoavO2BRGxD6805HhKYE-OOBXugY-MKYNxlRI-L68UXuPdUvP_cl8RA/exec'; // GAS Web App
  const WHATSAPP_NUMBER = '201018288736'; // بصيغة دولية بدون +

  let products = [];
  let cartState = {}; // id (could be productId or productId::variantId) -> qty

  const loadCart = ()=>{
    try{ cartState = JSON.parse(localStorage.getItem('cart:v1')||'{}')||{}; }catch{ cartState = {}; }
  };

  const saveCart = ()=>{
    try{ localStorage.setItem('cart:v1', JSON.stringify(cartState)); }catch{}
    window.Cart && window.Cart.updateBadge && window.Cart.updateBadge();
  };

  const loadProducts = async()=>{
    const res = await fetch('data/products.json', {cache:'no-store'});
    const data = await res.json();
    products = (data.products||[]).filter(p=> (p.status||'active')==='active');
  };

  // Parse cart id to base product id and optional variant id
  const parseId = (id)=>{
    const parts = String(id||'').split('::');
    return { baseId: parts[0], variantId: parts[1] || null };
  };
  const getProduct = (id)=>{
    const { baseId } = parseId(id);
    return products.find(p=> String(p.id)===String(baseId));
  };
  const getVariant = (product, variantId)=>{
    if(!product || !variantId) return null;
    const ws = Array.isArray(product.weights) ? product.weights : [];
    return ws.find(w=> String(w.id)===String(variantId)) || null;
  };
  // Detect and parse custom-per-unit variant ids like: productId::custom-g-500 or custom-ml-250 or custom-l-1
  const parseCustom = (product, variantId)=>{
    const res = { isCustom:false, unit:null, amount:0, unitPrice:0 };
    if(!product || !variantId) return res;
    const m = /^custom-(g|ml|l)-(\d+)$/.exec(String(variantId));
    if(!m) return res;
    const unit = m[1];
    const amount = Number(m[2]||0);
    const cp = product.customPricing && product.customPricing.enabled ? product.customPricing : null;
    const pricePerUnit = cp && Number(cp.pricePerUnit)>0 ? Number(cp.pricePerUnit) : 0;
    return { isCustom:true, unit, amount, unitPrice: pricePerUnit * amount };
  };
  const unitLabelAny = (unit, amount)=>{
    if(!amount) return '';
    if(unit==='g'){
      if(amount >= 1000) return '1 كيلو';
      if(amount === 500) return '½ كيلو';
      if(amount === 250) return '¼ كيلو';
      return `${amount} جم`;
    }else if(unit==='ml'){
      if(amount >= 1000) return `${(amount/1000)} لتر`;
      return `${amount} مل`;
    }else if(unit==='l'){
      // liters are integral or decimal? Our IDs carry integers. Display as `${amount} لتر`.
      return `${amount} لتر`;
    }
    return `${amount}`;
  };
  const unitLabel = (grams)=>{
    if(!grams) return '';
    if(grams >= 1000) return '1 كيلو';
    if(grams === 500) return '½ كيلو';
    if(grams === 250) return '¼ كيلو';
    return `${grams} جم`;
  };

  const calcTotals = async ()=>{
    const items = buildLineItems(cartState);
    const totals = computeTotals(items);
    // site-wide discount
    const site = await getSiteDiscount();
    const siteDiscount = (totals.afterProducts) * (site.pct/100);
    const siteRow = SITE_DISCOUNT_EL ? SITE_DISCOUNT_EL.closest('.row') : null;
    const grand = totals.afterProducts - siteDiscount;

    SUBTOTAL_EL && (SUBTOTAL_EL.textContent = priceFmt(totals.totalBefore));
    if(PRODUCTS_DISCOUNT_EL){
      const row = PRODUCTS_DISCOUNT_EL.closest('.row');
      if(totals.productsDiscount>0){
        PRODUCTS_DISCOUNT_EL.textContent = `-${priceFmt(totals.productsDiscount)}`;
        if(row) row.style.display = '';
      } else {
        if(row) row.style.display = 'none';
      }
    }
    AFTER_PRODUCTS_EL && (AFTER_PRODUCTS_EL.textContent = priceFmt(totals.afterProducts));
    if(SITE_DISCOUNT_EL){
      // Update label text
      if(siteRow && siteRow.firstElementChild){ siteRow.firstElementChild.textContent = site.label; }
      if(site.pct>0 && siteDiscount>0){
        SITE_DISCOUNT_EL.textContent = `-${priceFmt(siteDiscount)} (${site.pct}%)`;
        if(siteRow) siteRow.style.display = '';
      } else {
        if(siteRow) siteRow.style.display = 'none';
      }
    }
    SHIPPING_EL && (SHIPPING_EL.textContent = SHIPPING_MESSAGE);
    GRAND_EL && (GRAND_EL.textContent = priceFmt(grand));
  };

  // ---- Build order payload helpers ----
  // Detect per-product discount percent
  const getProductDiscountPct = (p)=>{
    const d = p && p.discount;
    if(!d) return 0;
    const type = String(d.type||'').toLowerCase();
    const val = Number(d.value||0);
    if(val<=0) return 0;
    // accept both 'percent' and the misspelling 'precent'
    if(type === 'percent' || type === 'precent') return Math.max(0, Math.min(100, val));
    return 0;
  };

  const buildLineItems = (state)=>{
    const items = [];
    Object.entries(state||{}).forEach(([id, qtyRaw])=>{
      const qty = Number(qtyRaw||0);
      if(!qty) return;
      const p = getProduct(id);
      if(!p) return;
      const { variantId } = parseId(id);
      const custom = parseCustom(p, variantId);
      const v = custom.isCustom ? null : getVariant(p, variantId);
      const baseUnit = custom.isCustom ? custom.unitPrice : (v ? Number(v.price||0) : Number(p.price||0));
      const prodPct = getProductDiscountPct(p);
      const discountedUnit = prodPct>0 ? (baseUnit * (1 - (prodPct/100))) : baseUnit;
      const unitPrice = discountedUnit;
      const origUnitPrice = baseUnit; // original before product discount
      items.push({
        id,
        baseId: p.id,
        title: p.title + (custom.isCustom ? ` - ${unitLabelAny(custom.unit, custom.amount)}` : (v ? ` - ${unitLabel(v.grams)}` : '')),
        variantId: variantId || null,
        variantLabel: custom.isCustom ? unitLabelAny(custom.unit, custom.amount) : (v ? unitLabel(v.grams) : null),
        unitPrice,
        origUnitPrice,
        qty,
        lineTotalBefore: origUnitPrice * qty,
        lineTotalAfter: unitPrice * qty
      });
    });
    return items;
  };

  const computeTotals = (items)=>{
    const totalBefore = items.reduce((a,it)=> a + (Number(it.lineTotalBefore)||0), 0); // before product discounts
    const afterProducts = items.reduce((a,it)=> a + (Number(it.lineTotalAfter)||0), 0); // after product discounts
    const productsDiscount = totalBefore - afterProducts;
    return { totalBefore, afterProducts, productsDiscount };
  };

  async function getSiteDiscount(){
    try{
      if(!window.Discount || !window.Discount.getConfig) return { pct:0, label:'خصم الموقع' };
      const cfg = await window.Discount.getConfig();
      const now = new Date();
      const active = cfg && cfg.active && (!cfg.start || now>=cfg.start) && (!cfg.end || now<=cfg.end) && Number(cfg.percentage)>0;
      const pct = active ? Number(cfg.percentage) : 0;
      const label = (cfg && cfg.discount_label && cfg.discount_label.trim()) ? cfg.discount_label.trim() : 'خصم الموقع';
      return { pct, label };
    }catch{ return { pct:0, label:'خصم الموقع' }; }
  }

  const buildWhatsAppMessage = ({customer, items, totals, paymentMethod, orderId, sitePct, siteLabel, siteDiscount, grand})=>{
    const lines = [];
    lines.push('طلب جديد من المتجر:');
    lines.push(`رقم الطلب: ${orderId}`);
    lines.push('--------------------------');
    lines.push(`الاسم: ${customer.fullName}`);
    lines.push(`الهاتف: ${customer.phone}`);
    lines.push(`العنوان: ${customer.address}, ${customer.city}`);
    lines.push(`طريقة الدفع: ${paymentMethod}`);
    lines.push('--------------------------');
    lines.push('تفاصيل المنتجات:');
    items.forEach((it, idx)=>{
      lines.push(`${idx+1}) ${it.title}`);
      lines.push(`- قبل الخصم: ${priceFmt(it.origUnitPrice)} × ${it.qty} = ${priceFmt(it.lineTotalBefore)}`);
      if(it.origUnitPrice !== it.unitPrice){
        const lineDisc = (it.lineTotalBefore - it.lineTotalAfter);
        lines.push(`- خصم المنتج: -${priceFmt(lineDisc)}  |  بعد خصم المنتج: ${priceFmt(it.lineTotalAfter)}`);
      } else {
        lines.push(`- الإجمالي: ${priceFmt(it.lineTotalAfter)}`);
      }
    });
    lines.push('--------------------------');
    lines.push(`الإجمالي قبل الخصومات: ${priceFmt(totals.totalBefore)}`);
    const productsDiscount = totals.totalBefore - totals.afterProducts;
    lines.push(`خصم المنتجات: -${priceFmt(productsDiscount)}`);
    lines.push(`بعد خصم المنتجات: ${priceFmt(totals.afterProducts)}`);
    if(sitePct>0 && siteDiscount>0){
      const label = siteLabel || 'خصم الموقع';
      lines.push(`${label} (${sitePct}%): -${priceFmt(siteDiscount)}`);
    }
    lines.push(`الإجمالي النهائي: ${priceFmt(grand)}`);
    lines.push('--------------------------');
    lines.push('شكراً لكم');
    return lines.join('\n');
  };

  // Detect if running on mobile device (basic heuristic)
  const isMobile = ()=> /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');

  const render = async ()=>{
    if(!ITEMS_LIST) return;
    ITEMS_LIST.innerHTML = '';
    const ids = Object.keys(cartState);
    if(ids.length===0){
      const p = document.createElement('p');
      p.className = 'section-subtitle';
      p.textContent = 'سلتك فارغة حالياً.';
      ITEMS_LIST.appendChild(p);
      await calcTotals();
      return;
    }
    ids.forEach((id)=>{
      const p = getProduct(id); if(!p) return;
      const { variantId } = parseId(id);
      const custom = parseCustom(p, variantId);
      const v = custom.isCustom ? null : getVariant(p, variantId);
      const baseUnit = custom.isCustom ? custom.unitPrice : (v ? Number(v.price||0) : Number(p.price||0));
      const prodPct = getProductDiscountPct(p);
      const discountedUnit = prodPct>0 ? (baseUnit * (1 - (prodPct/100))) : baseUnit;
      const li = document.createElement('li');
      li.className = 'cart-item';
      li.innerHTML = `
        <img class="thumb" src="${p.thumbnail || (p.images&&p.images[0]) || 'imgs/honey.jpeg'}" alt="${p.title}">
        <div class="meta">
          <div class="t">${p.title}${custom.isCustom ? ' - ' + unitLabelAny(custom.unit, custom.amount) : (v ? ' - ' + unitLabel(v.grams) : '')}</div>
          <div class="pr">
            ${prodPct>0
              ? `<span class="old" style="text-decoration:line-through;opacity:.7;margin-inline-start:6px;">${priceFmt(baseUnit)}</span>
                 <strong class="new">${priceFmt(discountedUnit)}</strong>`
              : `${priceFmt(baseUnit)}`}
          </div>
        </div>
        <div class="qty">
          <button class="qbtn minus" aria-label="إنقاص">-</button>
          <span class="q">${Number(cartState[id]||0)}</span>
          <button class="qbtn plus" aria-label="زيادة">+</button>
          <button class="qbtn remove" aria-label="إزالة">×</button>
        </div>
      `;
      const qEl = li.querySelector('.q');
      const sync = ()=>{ qEl.textContent = String(cartState[id]||0); if(Number(cartState[id]||0)<=0){ li.remove(); } calcTotals(); };
      li.querySelector('.plus').addEventListener('click', ()=>{ cartState[id] = (Number(cartState[id]||0))+1; saveCart(); sync(); });
      li.querySelector('.minus').addEventListener('click', ()=>{ cartState[id] = Math.max(0, (Number(cartState[id]||0))-1); if(cartState[id]===0) delete cartState[id]; saveCart(); sync(); });
      li.querySelector('.remove').addEventListener('click', ()=>{ delete cartState[id]; saveCart(); sync(); });
      ITEMS_LIST.appendChild(li);
    });
    calcTotals();
  };

  const validate = ()=>{
    if(!FORM) return true;
    const required = ['fullName','address','city','phone'];
    let ok = true;
    required.forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      let valid = !!(el.value && String(el.value).trim());
      if(valid && id==='phone'){
        // Egyptian mobile format: starts with 01 and total 11 digits
        const digits = String(el.value).replace(/\D/g,'');
        valid = /^01\d{9}$/.test(digits);
      }
      if(valid && id==='email'){
        // Simple email pattern
        valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(el.value).trim());
      }
      el.classList.toggle('is-invalid', !valid);
      if(!valid) ok = false;
    });
    return ok;
  };

  const cartHasItems = ()=> Object.values(cartState||{}).some(q=> Number(q)>0);

  // Real-time validation helpers
  const validateField = (el)=>{
    if(!el) return true;
    const id = el.id;
    let valid = !!(el.value && String(el.value).trim());
    if(id==='phone'){
      const digits = String(el.value).replace(/\D/g,'');
      valid = /^01\d{9}$/.test(digits);
      // Normalize value to digits only and max 11
      if(el.value !== digits){ el.value = digits.slice(0,11); }
      el.setCustomValidity(valid ? '' : 'رقم الهاتف يجب أن يبدأ بـ 01 ومكوّن من 11 رقم');
    } else if(id==='email'){
      valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(el.value).trim());
      el.setCustomValidity(valid ? '' : 'رجاءً أدخل بريدًا إلكترونيًا صحيحًا');
    } else {
      el.setCustomValidity(valid ? '' : 'هذا الحقل مطلوب');
    }
    el.classList.toggle('is-invalid', !valid);
    return valid;
  };

  const placeOrder = async ()=>{
    if(!cartHasItems()){
      if(showEmptyModal()) return; // opened custom modal
      alert('سلتك فارغة.'); // fallback
      return;
    }
    if(!validate()){ alert('برجاء استكمال بيانات الشحن.'); return; }

    // Collect customer data
    const fullName = document.getElementById('fullName')?.value?.trim();
    const phone    = document.getElementById('phone')?.value?.trim();
    const address  = document.getElementById('address')?.value?.trim();
    const city     = document.getElementById('city')?.value?.trim();
    const email    = document.getElementById('email')?.value?.trim();
    const paymentMethod = (document.querySelector('input[name="payment"]:checked')?.value)||'غير محدد';

    // Build items and totals
    const items = buildLineItems(cartState);
    const totals = computeTotals(items);
    const sitePct = await getSiteDiscountPct();
    const siteDiscount = totals.afterProducts * (sitePct/100);
    const grand = totals.afterProducts - siteDiscount;
    const orderId = 'ORD-' + Math.random().toString(36).slice(2,8).toUpperCase() + '-' + Date.now().toString().slice(-5);
    const payload = {
      orderId,
      timestamp: new Date().toISOString(),
      customer: { fullName, phone, address, city, email },
      paymentMethod,
      items,
      totals: { totalBefore: totals.totalBefore, afterProducts: totals.afterProducts },
      site: location.href,
      sitePct,
      siteDiscount,
      grand
    };

    // Prepare WhatsApp text and copy to clipboard
    const waText = buildWhatsAppMessage(payload);
    try { await navigator.clipboard.writeText(waText); } catch {}

    // Show note modal first; after user clicks Done, continue to WhatsApp and GAS
    if(showWaNote()){
      const proceed = async ()=>{
        hideWaNote();
        // Open WhatsApp
        const waUrl = isMobile()
          ? `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(waText)}`
          : `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(waText)}`;
        try{
          const w = window.open(waUrl, '_blank');
          if(!w){ window.location.href = waUrl; }
        }catch{ window.location.href = waUrl; }

        // Send to Google Apps Script (saves to Sheets + email)
        if(APPS_SCRIPT_URL && /\/exec$/.test(APPS_SCRIPT_URL) && !/REPLACE_WITH_YOUR_SCRIPT_ID/.test(APPS_SCRIPT_URL)){
          try{
            const fd = new FormData();
            fd.append('payload', JSON.stringify(payload));
            await fetch(APPS_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: fd });
          }catch(err){ console.warn('GAS submit failed', err); }
        } else {
          alert('لم يتم ضبط رابط Google Apps Script بعد. رجاءً ضع رابط الويب آب (المنتهي بـ /exec) في APPS_SCRIPT_URL داخل js/checkout.js لإرسال الإيميل تلقائيًا.');
        }
      };

      // Ensure single binding
      if(WA_NOTE_CONFIRM){
        WA_NOTE_CONFIRM.onclick = proceed;
      }
      if(WA_NOTE_CANCEL){
        WA_NOTE_CANCEL.onclick = hideWaNote;
      }
      // Also close when clicking backdrop
      if(WA_NOTE_MODAL){
        WA_NOTE_MODAL.addEventListener('click', (e)=>{
          const t = e.target;
          if(t && t.getAttribute && t.getAttribute('data-dismiss')==='waNoteModal') hideWaNote();
        }, { once: true });
      }
      return; // Wait for user confirmation
    }

    // Fallback if modal missing: proceed immediately
    const waUrl = isMobile()
      ? `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(waText)}`
      : `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(waText)}`;
    try{
      const w = window.open(waUrl, '_blank');
      if(!w){ window.location.href = waUrl; }
    }catch{ window.location.href = waUrl; }

    if(APPS_SCRIPT_URL && /\/exec$/.test(APPS_SCRIPT_URL) && !/REPLACE_WITH_YOUR_SCRIPT_ID/.test(APPS_SCRIPT_URL)){
      try{
        const fd = new FormData();
        fd.append('payload', JSON.stringify(payload));
        await fetch(APPS_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: fd });
      }catch(err){ console.warn('GAS submit failed', err); }
    } else {
      alert('لم يتم ضبط رابط Google Apps Script بعد. رجاءً ضع رابط الويب آب (المنتهي بـ /exec) في APPS_SCRIPT_URL داخل js/checkout.js لإرسال الإيميل تلقائيًا.');
    }

    // Optional: keep cart as is so العميل يراجع السلة لاحقاً
    // إن رغبت في التفريغ تلقائياً بعد الطلب، أزل التعليق:
    // cartState = {}; saveCart(); render();
  };

  (async function init(){
    try{ await loadProducts(); }
    catch(e){ console.warn('Failed to load products.json', e); products = []; }
    loadCart();
    render();
    if(PLACE_BTN){
      PLACE_BTN.addEventListener('click', placeOrder);
    } else {
      // late-binding fallback in case the button renders later
      document.addEventListener('click', (e)=>{
        const t = e.target;
        if(t && (t.id==='placeOrder' || t.closest && t.closest('#placeOrder'))){
          placeOrder();
        }
      });
    }

    // Wire up real-time validation
    if(FORM){
      const phoneEl = document.getElementById('phone');
      const emailEl = document.getElementById('email');
      const others = ['fullName','address','city']
        .map(id=> document.getElementById(id))
        .filter(Boolean);

      const all = [phoneEl, emailEl, ...others].filter(Boolean);
      // Reset any previous error/touched classes on load
      all.forEach(el=>{ el.classList.remove('is-invalid'); el.classList.remove('touched'); el.setCustomValidity(''); });

      const markTouched = (el)=>{ el.classList.add('touched'); validateField(el); };
      if(phoneEl){
        // Enforce digits and length while typing
        phoneEl.addEventListener('input', ()=> validateField(phoneEl));
        phoneEl.addEventListener('blur', ()=> validateField(phoneEl));
      }
      if(emailEl){
        emailEl.addEventListener('input', ()=> validateField(emailEl));
        emailEl.addEventListener('blur', ()=> validateField(emailEl));
      }
      others.forEach(el=>{
        el.addEventListener('input', ()=> validateField(el));
        el.addEventListener('blur', ()=> validateField(el));
      });
    }

    // Modal wiring
    if(EMPTY_MODAL){
      // Backdrop or dismiss buttons
      EMPTY_MODAL.addEventListener('click', (e)=>{
        const target = e.target;
        if(target.matches('[data-dismiss="emptyCartModal"]')){
          hideEmptyModal();
        }
      });
      if(DISMISS_EMPTY_BTN){
        DISMISS_EMPTY_BTN.addEventListener('click', hideEmptyModal);
      }
      if(GO_SHOP_BTN){
        GO_SHOP_BTN.addEventListener('click', ()=>{
          // Navigate to homepage all products section
          window.location.href = 'index.html#all-products';
        });
      }
      // Close on ESC
      document.addEventListener('keydown', (ev)=>{
        if(ev.key === 'Escape' && !EMPTY_MODAL.hidden){
          hideEmptyModal();
        }
      });
    }
  })();
})();
