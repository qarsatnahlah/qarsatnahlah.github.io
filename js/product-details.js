(async function(){
  const root = document.getElementById('productDetail');
  if(!root) return;

  const params = new URLSearchParams(window.location.search || '');
  const id = params.get('id');

  const el = (tag, cls)=>{ const e = document.createElement(tag); if(cls) e.className = cls; return e; };
  const priceFmt = (value)=> `${value} ج.م`;
  // Format unit from weight object (unit/amount or fallback to grams)
  const formatUnit = (w)=>{
    if(!w || typeof w !== 'object') return '';
    const unit = (w.unit ? String(w.unit).toLowerCase() : null);
    const amt = Number(w.amount);
    const grams = Number(w.grams);
    if(unit){
      if(unit==='g' || unit==='gram' || unit==='grams'){
        if(Number.isFinite(amt)){
          if(amt >= 1000) return '/ كيلو';
          if(amt === 500) return '/ 500 جم';
          if(amt === 250) return '/ 250 جم';
          return `/ ${amt} جم`;
        }
      }else if(unit==='kg' || unit==='kilogram' || unit==='kilograms'){
        if(Number.isFinite(amt)) return `/ ${amt} كيلو`;
      }else if(unit==='ml' || unit==='milliliter' || unit==='millilitre'){
        if(Number.isFinite(amt)) return `/ ${amt} مل`;
      }else if(unit==='l' || unit==='lt' || unit==='liter' || unit==='litre'){
        if(Number.isFinite(amt)) return `/ ${amt} لتر`;
      }else if(unit==='piece' || unit==='pcs' || unit==='pc' || unit==='count' || unit==='unit'){
        return '/ بالقطعة';
      }
      if(Number.isFinite(amt)) return `/ ${amt} ${unit}`;
      return '';
    }
    if(Number.isFinite(grams)){
      if(grams >= 1000) return '/ كيلو';
      if(grams === 500) return '/ 500 جم';
      if(grams === 250) return '/ 250 جم';
      return `/ ${grams} جم`;
    }
    return '';
  };
  const optionLabel = (w)=>{
    if(w && w.label) return w.label;
    const txt = formatUnit(w).replace(/^\s*\/\s*/, '');
    return txt || 'خيار';
  };

  function notFound(msg){
    const box = el('div','product-detail__empty');
    const h = el('h2','section-title');
    h.textContent = 'عذرًا، هذا المنتج غير متاح';
    const p = el('p','section-subtitle');
    p.textContent = msg || 'قد يكون الرابط غير صحيح أو تم إزالة المنتج. يمكنك الرجوع أو تصفح الصفحة الرئيسية.';
    const actions = el('div','pd-empty-actions');
    const backBtn = el('button','btn');
    backBtn.type = 'button';
    backBtn.textContent = 'رجوع';
    backBtn.addEventListener('click', ()=>{
      try{
        if(window.history && window.history.length>1){ window.history.back(); }
        else{ window.location.href = 'index.html'; }
      }catch{ window.location.href = 'index.html'; }
    });
    const homeBtn = el('a','btn');
    homeBtn.href = 'index.html';
    homeBtn.textContent = 'الصفحة الرئيسية';
    actions.appendChild(backBtn);
    actions.appendChild(homeBtn);
    box.appendChild(h);
    box.appendChild(p);
    box.appendChild(actions);
    root.innerHTML='';
    root.appendChild(box);
  }

  if(!id){
    notFound('لا يوجد مُعرّف منتج في الرابط.');
    return;
  }

  let data = null;
  try{
    const res = await fetch('data/products.json', { cache: 'no-store' });
    if(!res.ok) throw new Error('تعذر تحميل ملف المنتجات');
    data = await res.json();
  }catch(err){
    console.error(err);
    notFound('تعذر تحميل بيانات المنتج.');
    return;
  }

  // Match id regardless of type (number vs string)
  const product = (data.products||[]).find(p=> String(p.id) === String(id));
  if(!product){
    notFound('لم يتم العثور على هذا المنتج.');
    return;
  }

  // Guard: only allow active products
  if((product.status||'active') !== 'active'){
    notFound('هذا المنتج غير متاح حالياً.');
    return;
  }

  // Define base product id early for use in weight option rendering
  const baseId = product.id;

  // Build layout
  root.innerHTML = '';
  // Container grid for info/media columns (matches CSS .product-detail__grid)
  const grid = el('div','product-detail__grid');
  // Media column (right in RTL)
  const media = el('div','pd-media');
  const main = el('div','pd-main');
  const mainImg = el('img');
  mainImg.src = (product.images && product.images[0]) || product.thumbnail || 'imgs/honey.jpeg';
  mainImg.alt = product.title;
  mainImg.loading = 'eager';
  mainImg.decoding = 'async';
  mainImg.fetchPriority = 'high';
  main.appendChild(mainImg);
  media.appendChild(main);

  // thumbnails
  const thumbs = el('div','pd-thumbs');
  const imgs = (product.images && product.images.length ? product.images : [product.thumbnail || 'imgs/honey.jpeg']);
  imgs.forEach((src, i)=>{
    const b = el('button','pd-thumb');
    const im = el('img');
    im.src = src;
    im.alt = product.title + ' صورة ' + (i+1);
    im.loading = 'lazy';
    im.decoding = 'async';
    im.fetchPriority = 'low';
    if(i===0) b.setAttribute('aria-current','true');
    b.appendChild(im);
    b.addEventListener('click', ()=>{
      mainImg.src = src;
      thumbs.querySelectorAll('.pd-thumb[aria-current="true"]').forEach(t=> t.removeAttribute('aria-current'));
      b.setAttribute('aria-current','true');
    });
    thumbs.appendChild(b);
  });
  media.appendChild(thumbs);

  // Info column (left in RTL)
  const info = el('div','pd-info');
  const title = el('h1','pd-title'); title.id = 'productTitle'; title.textContent = product.title;
  const badgesRow = el('div','pd-badges');

  // Optional meta row: rating + reviews count + stock badge + gift wrap
  const meta = el('div','pd-meta');
  if(typeof product.rating === 'number'){
    const stars = el('div','pd-stars');
    const full = Math.round(Math.max(0, Math.min(5, product.rating)));
    for(let i=1;i<=5;i++){ const s = el('i', i<=full ? 'fa-solid fa-star' : 'fa-regular fa-star'); stars.appendChild(s); }
    meta.appendChild(stars);
  }
  if(typeof product.reviewsCount === 'number'){
    const rc = el('span','pd-reviews'); rc.textContent = `(${product.reviewsCount})`; meta.appendChild(rc);
  }
  if(product.giftWrapAvailable){
    const gw = el('span','pd-pill'); gw.textContent = 'تغليف هدية متاح'; meta.appendChild(gw);
  }
  if(product.expiryDate){
    const ex = el('span','pd-exp'); ex.textContent = `الصلاحية: ${product.expiryDate}`; meta.appendChild(ex);
  }

  // Price block
  const priceWrap = el('div','pd-price');
  const current = el('span','pd-price__current');
  const old = el('span','pd-price__old');

  // Setup weights (variants) if present
  const weights = Array.isArray(product.weights) ? product.weights : null;
  // Optional: custom per-unit pricing, controlled from JSON as:
  // product.customPricing = { enabled:true, unit:'g'|'ml', pricePerUnit: number, min: number, max: number, step: number, defaultAmount?: number, label?: string }
  const cp = product.customPricing && product.customPricing.enabled ? product.customPricing : null;
  const cpUnit = cp && String(cp.unit||'').toLowerCase();
  const cpValid = !!(cp && (cpUnit==='g' || cpUnit==='ml') && Number(cp.pricePerUnit)>0);
  const pickDefaultWeight = (ws, prod)=>{
    if(!Array.isArray(ws) || ws.length===0) return null;
    if(prod && prod.defaultWeightId){
      const byId = ws.find(w=> String(w.id)===String(prod.defaultWeightId));
      if(byId) return byId;
    }
    const byFlag = ws.find(w=> w && w.default === true);
    if(byFlag) return byFlag;
    const inStock = ws.find(w=> w.inStock !== false);
    if(inStock) return inStock;
    return ws[0];
  };
  let selected = pickDefaultWeight(weights, product);
  let customActive = false;
  // Default custom amount: use the default weight's amount (grams/ml) if available
  let customAmount = 0;
  if(cpValid){
    let fromWeight = null;
    if(selected){
      if(cpUnit==='g' && Number.isFinite(Number(selected.grams))) fromWeight = Number(selected.grams);
      else if(cpUnit==='ml' && Number.isFinite(Number(selected.amount))) fromWeight = Number(selected.amount);
    }
    const base = Number.isFinite(fromWeight) ? fromWeight : Number(cp.defaultAmount||cp.min||0);
    const mn = Number(cp.min)||0; const mx = Number(cp.max)||Infinity; const st = Math.max(1, Number(cp.step)||1);
    // clamp/snap
    let n = Math.floor(Number(base)||0);
    n = Math.round(n / st) * st; if(n<mn) n=mn; if(n>mx) n=mx;
    customAmount = n;
  }

  const syncPrice = ()=>{
    let unitTxt = '';
    let curPrice;
    let cmpPrice;
    if(customActive && cpValid){
      curPrice = Math.max(0, (Number(cp.pricePerUnit)||0) * (Number(customAmount)||0));
      cmpPrice = null;
      unitTxt = formatUnit({ unit: cpUnit, amount: Number(customAmount)||0 });
    } else {
      curPrice = selected ? selected.price : product.price;
      cmpPrice = selected ? (selected.compareAtPrice || null) : (product.compareAtPrice || null);
      unitTxt = selected ? formatUnit(selected) : '';
    }
    current.textContent = `${priceFmt(curPrice)} ${unitTxt}`.trim();
    if(current.parentNode !== priceWrap) priceWrap.appendChild(current);
    if(cmpPrice && cmpPrice > curPrice){
      old.textContent = priceFmt(cmpPrice);
      if(!old.parentNode) priceWrap.appendChild(old);
    } else {
      if(old.parentNode) old.remove();
    }
  };
  syncPrice();

  // Weight options (if any)
  let weightBox = null;
  const makeVariantId = (prodId, w)=> `${prodId}::${w.id||String(w.grams||'custom')}`;
  if(weights && weights.length){
    weightBox = el('div','weight-options');
    weights.forEach((w, i)=>{
      const opt = el('button','weight-option');
      opt.type = 'button';
      opt.textContent = w.label || (formatUnit(w).replace(/^\s*\/\s*/, '') || 'خيار');
      if(w.inStock === false){ opt.disabled = true; opt.setAttribute('aria-disabled','true'); opt.title = 'غير متوفر حالياً'; }
      if(!customActive && ((selected && (w === selected)) || (!selected && i===0))) opt.classList.add('is-selected');
      // Per-variant quantity badge
      const variantId = makeVariantId(baseId, w);
      const badge = el('span','weight-badge');
      opt.appendChild(badge);
      const syncBadge = ()=>{
        try{
          const q = (window && window.Cart && typeof window.Cart.getQty==='function') ? Number(window.Cart.getQty(variantId)||0) : 0;
          if(q>0){ badge.textContent = String(q); badge.style.display = 'grid'; }
          else{ badge.textContent = ''; badge.style.display = 'none'; }
        }catch{ badge.style.display = 'none'; }
      };
      syncBadge();
      document.addEventListener('cart:change', (e)=>{ if(e && e.detail && String(e.detail.id) === String(variantId)) syncBadge(); });
      opt.addEventListener('click', ()=>{
        if(w.inStock === false) return;
        selected = w;
        customActive = false;
        weightBox.querySelectorAll('.weight-option.is-selected').forEach(b=> b.classList.remove('is-selected'));
        opt.classList.add('is-selected');
        syncPrice();
        // re-sync quantity state to selected variant
        const q = Cart ? Cart.getQty(currentId()) : 0;
        setMainBtnState(q);
        syncBadge();
        // reflect grams into custom input (if present)
        try{
          if(customBox){
            const inp = customBox.querySelector('.pd-custom__input');
            if(inp && (w.grams || w.amount)){
              const grams = Number(w.grams || w.amount);
              if(Number.isFinite(grams)) inp.value = String(grams);
              const e = customBox.querySelector('.pd-custom__error'); if(e) e.style.display='none';
            }
          }
        }catch{}
      });
      weightBox.appendChild(opt);
    });
  }

  // Custom per-unit selector (if valid)
  let customBox = null;
  if(cpValid){
    if(!weightBox) weightBox = el('div','weight-options');
    // Toggle button
    const custBtn = el('button','weight-option');
    custBtn.type = 'button';
    custBtn.textContent = cp.label || (cpUnit==='g' ? 'تحديد الجرامات' : 'تحديد المللي');
    // Badge for custom selection (red dot without numbers)
    const custBadge = el('span','weight-badge');
    custBtn.appendChild(custBadge);
    const syncCustomBadge = ()=>{
      try{
        const id = currentId();
        const q = (window && window.Cart && typeof window.Cart.getQty==='function') ? Number(window.Cart.getQty(id)||0) : 0;
        if(q>0){ custBadge.textContent = ''; custBadge.style.display = 'grid'; }
        else{ custBadge.textContent = ''; custBadge.style.display = 'none'; }
      }catch{ custBadge.style.display = 'none'; }
    };
    const activateCustom = ()=>{
      customActive = true; selected = null;
      weightBox.querySelectorAll('.weight-option.is-selected').forEach(b=> b.classList.remove('is-selected'));
      custBtn.classList.add('is-selected');
      syncPrice();
      setMainBtnState(Cart ? Cart.getQty(currentId()) : 0);
      // focus input for quick typing
      try{ const inp = customBox && customBox.querySelector('.pd-custom__input'); inp && inp.focus(); }catch{}
      syncCustomBadge();
    };
    custBtn.addEventListener('click', activateCustom);
    weightBox.appendChild(custBtn);
    // Auto-activate custom from URL (#custom or ?custom=1)
    try{
      const u = new URLSearchParams(window.location.search||'');
      if(window.location.hash==='#custom' || u.get('custom')==='1'){ setTimeout(activateCustom, 0); }
    }catch{}
    // Update badge on cart changes
    document.addEventListener('cart:change', (e)=>{ try{ if(e && e.detail){ syncCustomBadge(); } }catch{} });

    // Inline custom box
    customBox = el('div','pd-custom');
    const row = el('div','pd-custom__row');
    const lbl = el('label','pd-custom__label');
    lbl.textContent = cp.label || (cpUnit==='g' ? 'حدد الجرامات' : 'حدد المللي');
    lbl.setAttribute('for','pdCustomAmount');
    const input = el('input','pd-custom__input');
    input.type = 'number';
    input.id = 'pdCustomAmount';
    input.min = String(Number(cp.min)||0);
    if(Number.isFinite(Number(cp.max))) input.max = String(Number(cp.max));
    input.step = String(Number(cp.step)||1);
    input.value = String(customAmount);
    const unitSpan = el('span','pd-custom__unit'); unitSpan.textContent = (cpUnit==='g' ? 'جم' : 'مل');
    row.appendChild(lbl);
    row.appendChild(input);
    row.appendChild(unitSpan);
    customBox.appendChild(row);
    // Help text with price per unit
    const help = el('div','pd-custom__help'); help.textContent = `سعر ${cpUnit==='g'?'الجرام':'المللي'}: ${priceFmt(cp.pricePerUnit)}`;
    customBox.appendChild(help);
    // Friendly error line
    const err = el('div','pd-custom__error');
    err.style.cssText = 'margin-top:6px;color:#e11d48;font-size:13px;display:none;';
    customBox.appendChild(err);
    // Validation helpers
    const bounds = { min: Number(cp.min)||0, max: Number(cp.max)||Infinity, step: Math.max(1, Number(cp.step)||1) };
    const validate = (raw)=>{
      const v = Number(raw);
      if(!Number.isFinite(v)) return { ok:false, msg:'من فضلك أدخل رقمًا صحيحًا' };
      if(v < bounds.min) return { ok:false, msg:`الحد الأدنى ${bounds.min} ${cpUnit==='g'?'جرام':'مللي'}` };
      if(Number.isFinite(bounds.max) && v > bounds.max) return { ok:false, msg:`الحد الأقصى ${bounds.max} ${cpUnit==='g'?'جرام':'مللي'}` };
      if(v % bounds.step !== 0) return { ok:false, msg:`يجب أن تكون القيمة مضاعفات ${bounds.step}` };
      return { ok:true };
    };
    const clamp = (v)=>{
      let n = Math.floor(Number(v)||0);
      n = Math.round(n / bounds.step) * bounds.step;
      if(n < bounds.min) n = bounds.min; if(n > bounds.max) n = bounds.max;
      return n;
    };
    const showErr = (msg)=>{ err.textContent = msg||''; err.style.display = msg ? '' : 'none'; };
    const onInput = ()=>{
      const res = validate(input.value);
      if(!res.ok){ showErr(res.msg); return; }
      showErr(''); customAmount = Number(input.value);
      if(!customActive) activateCustom();
      syncPrice(); setMainBtnState(Cart ? Cart.getQty(currentId()) : 0);
    };
    const onBlur = ()=>{
      const n = clamp(input.value);
      if(String(n)!==String(input.value)) input.value = String(n);
      showErr(''); customAmount = n; if(!customActive) activateCustom(); syncPrice();
    };
    input.addEventListener('input', onInput);
    input.addEventListener('change', onInput);
    input.addEventListener('blur', onBlur);
    // Replace-on-type UX: select on focus and clear on first key press
    let primed = false;
    input.addEventListener('focus', ()=>{ try{ input.select(); }catch{} primed = false; });
    input.addEventListener('keydown', (e)=>{
      if(!primed){
        const k = e.key;
        if(k === 'Backspace' || k === 'Delete' || (typeof k === 'string' && k.length === 1)){
          input.value = '';
          primed = true;
        }
      }
    });
  }

  // Description
  const desc = el('p','pd-desc'); desc.textContent = product.description || '';

  // Add to cart + custom quantity controls for product page
  const action = el('div','pd-action');
  const actionTop = el('div','pd-action__top');
  const mainBtn = el('button','btn btn--add pd-main-btn');
  mainBtn.type = 'button';
  // Keep manual binding; do not allow autoBind to attach controls here
  mainBtn.setAttribute('data-cart-bound','1');
  mainBtn.innerHTML = 'أضف إلى السلة <i class="fa-solid fa-cart-shopping"></i>';

  // Quantity box
  const qtyBox = el('div','pd-qty');
  const btnPlus = el('button','pd-qty__btn'); btnPlus.type='button'; btnPlus.setAttribute('aria-label','زيادة'); btnPlus.textContent = '+';
  const qtyCount = el('span','pd-qty__count'); qtyCount.textContent = '0';
  const btnMinus = el('button','pd-qty__btn'); btnMinus.type='button'; btnMinus.setAttribute('aria-label','نقصان'); btnMinus.textContent = '−';
  qtyBox.appendChild(btnPlus); qtyBox.appendChild(qtyCount); qtyBox.appendChild(btnMinus);

  actionTop.appendChild(mainBtn);
  actionTop.appendChild(qtyBox);
  action.appendChild(actionTop);

  // Buy Now button under the row
  const buyBtn = el('button','btn pd-buy-btn');
  buyBtn.type = 'button';
  buyBtn.textContent = 'شراء الآن';
  action.appendChild(buyBtn);

  info.appendChild(title);
  info.appendChild(badgesRow);
  info.appendChild(meta);
  info.appendChild(priceWrap);
  if(weightBox) info.appendChild(weightBox);
  if(customBox) info.appendChild(customBox);
  info.appendChild(desc);
  info.appendChild(action);

  grid.appendChild(info);
  grid.appendChild(media);
  root.appendChild(grid);

  // Custom behavior synced with Cart
  const Cart = window.Cart;
  const currentId = ()=>{
    if(customActive && cpValid){ return `${baseId}::custom-${cpUnit}-${customAmount||0}`; }
    return (selected && weights) ? makeVariantId(baseId, selected) : baseId;
  };
  const stockQty = Number(product.stockQuantity ?? Infinity);
  const stockStatus = String(product.stockStatus||'in_stock');
  const isOut = (stockStatus==='out_of_stock') || (Number.isFinite(stockQty) && stockQty<=0);
  const minQty = Math.max(0, Number(product.minOrderQty ?? 0));
  const maxQty = Math.max(0, Number(product.maxOrderQt ?? product.maxOrderQty ?? Infinity));
  const labelAdd = product.preOrder ? 'اطلب مسبقًا' : 'أضف إلى السلة';

  const setQtyDisabled = (disabled)=>{
    btnPlus.disabled = disabled; btnMinus.disabled = disabled;
    if(disabled){ qtyBox.classList.add('pd-qty--disabled'); }
    else{ qtyBox.classList.remove('pd-qty--disabled'); }
  };

  const setMainBtnState = (q)=>{
    if(isOut){
      mainBtn.disabled = true;
      mainBtn.classList.add('pd-main-btn--disabled');
      mainBtn.textContent = 'غير متوفر';
      setQtyDisabled(true);
      buyBtn.disabled = true;
      buyBtn.classList.add('is-disabled');
    } else if(q>0){
      mainBtn.classList.add('pd-main-btn--remove');
      mainBtn.textContent = 'إزالة من السلة';
      setQtyDisabled(false);
      buyBtn.disabled = false;
      buyBtn.classList.remove('is-disabled');
    }else{
      mainBtn.classList.remove('pd-main-btn--remove');
      mainBtn.innerHTML = `${labelAdd} <i class="fa-solid fa-cart-shopping"></i>`;
      mainBtn.disabled = false;
      setQtyDisabled(false);
      buyBtn.disabled = false;
      buyBtn.classList.remove('is-disabled');
    }
    qtyCount.textContent = String(q);
  };

  const add = (delta)=>{
    if(!Cart) return;
    // clamp with stock and min/max constraints
    const cur = Cart.getQty(currentId());
    if(delta>0){
      let target = cur + delta;
      if(Number.isFinite(maxQty)) target = Math.min(target, maxQty);
      if(Number.isFinite(stockQty)) target = Math.min(target, stockQty);
      // ensure at least min when first adding
      if(cur===0 && minQty>1) target = Math.max(target, minQty);
      delta = target - cur;
    }else if(delta<0){
      let target = Math.max(0, cur + delta);
      // do not enforce min on decrease; allow going to 0
      delta = target - cur;
    }
    if(delta===0) return;
    const next = Cart.add(currentId(), delta);
    setMainBtnState(next);
  };

  // initial state from storage
  const initialQ = Cart ? Cart.getQty(currentId()) : 0;
  setMainBtnState(initialQ);

  mainBtn.addEventListener('click', ()=>{
    const q = Cart ? Cart.getQty(currentId()) : 0;
    if(isOut){ return; }
    if(q>0){
      // remove all
      add(-q);
    }else{
      add(+1);
    }
  });

  btnPlus.addEventListener('click', ()=>{ if(isOut) return; add(+1); });
  btnMinus.addEventListener('click', ()=>{
    const q = Cart ? Cart.getQty(currentId()) : 0;
    if(isOut) return;
    if(q>0) add(-1);
  });

  // Buy behavior: ensure at least 1 in cart
  buyBtn.addEventListener('click', ()=>{
    if(isOut) return;
    let q = Cart ? Cart.getQty(currentId()) : 0;
    if(q<=0){ add(+1); q = Cart ? Cart.getQty(currentId()) : 1; }
    // Go straight to cart/checkout page
    window.location.href = 'cart.html';
  });

  // keep in sync if cart changes elsewhere
  document.addEventListener('cart:change', (e)=>{
    if(e.detail && e.detail.id === currentId()){ setMainBtnState(Number(e.detail.qty||0)); }
  });

  // Render badges with required priority
  (function renderBadges(){
    const add = (text, cls='product-badge product-badge--new')=>{ const b = el('span', cls); b.textContent = text; badgesRow.appendChild(b); };
    // 1) Out of stock (only)
    if(isOut){ add('غير متوفر حاليا', 'product-badge product-badge--oos'); return; }
    // 2) Group: New + Bestseller + Discount (together)
    if(product.newArrival) add('جديد');
    if(product.bestseller) add('الأكثر مبيعاً');
    if(product.discount && product.discount.type === 'percentage' && typeof product.discount.value === 'number') add(`${product.discount.value}%`, 'product-badge product-badge--sale');
    // 3) PreOrder
    if(product.preOrder) add('طلب مسبق');
    // 4) Remaining
    if(product.limitedEdition) add('إصدار محدود');
    if(product.bundle) add('باقة');
    if(product.featured) add('مميّز', 'product-badge product-badge--featured');
  })();
})();
