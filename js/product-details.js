(async function(){
  const root = document.getElementById('productDetail');
  if(!root) return;

  const params = new URLSearchParams(window.location.search || '');
  const id = params.get('id');

  const el = (tag, cls)=>{ const e = document.createElement(tag); if(cls) e.className = cls; return e; };
  const priceFmt = (value)=> `${value} ج.م`;
  const unitLabel = (grams)=>{
    if(!grams) return '';
    if(grams >= 1000) return '/ كيلو';
    if(grams === 500) return '/ 500 جم';
    if(grams === 250) return '/ 250 جم';
    return `/ ${grams} جم`;
  };

  function notFound(msg){
    const box = el('div','product-detail__empty');
    const p = el('p','section-subtitle');
    p.textContent = msg || 'المنتج غير موجود.';
    box.appendChild(p);
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

  const product = (data.products||[]).find(p=> p.id === id);
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
  const grid = el('div','product-detail__grid');

  // Media column (right in RTL)
  const media = el('div','pd-media');
  const main = el('div','pd-main');
  const mainImg = el('img');
  mainImg.src = (product.images && product.images[0]) || product.thumbnail || 'imgs/honey.jpeg';
  mainImg.alt = product.title;
  main.appendChild(mainImg);
  media.appendChild(main);

  // Thumbnails
  const thumbs = el('div','pd-thumbs');
  const imgs = (product.images && product.images.length ? product.images : [product.thumbnail || 'imgs/honey.jpeg']);
  imgs.forEach((src, i)=>{
    const b = el('button','pd-thumb');
    const im = el('img'); im.src = src; im.alt = product.title + ' صورة ' + (i+1);
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

  const syncPrice = ()=>{
    const curPrice = selected ? selected.price : product.price;
    const cmpPrice = selected ? (selected.compareAtPrice || null) : (product.compareAtPrice || null);
    current.textContent = `${priceFmt(curPrice)} ${selected ? unitLabel(selected.grams) : ''}`.trim();
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
      opt.textContent = w.label || (w.grams ? (w.grams===1000? '1 كيلو' : w.grams===500? '½ كيلو' : w.grams===250? '¼ كيلو' : `${w.grams} جم`) : 'خيار');
      if(w.inStock === false){ opt.disabled = true; opt.setAttribute('aria-disabled','true'); opt.title = 'غير متوفر حالياً'; }
      if((selected && (w === selected)) || (!selected && i===0)) opt.classList.add('is-selected');
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
        weightBox.querySelectorAll('.weight-option.is-selected').forEach(b=> b.classList.remove('is-selected'));
        opt.classList.add('is-selected');
        syncPrice();
        // re-sync quantity state to selected variant
        const q = Cart ? Cart.getQty(currentId()) : 0;
        setMainBtnState(q);
        syncBadge();
      });
      weightBox.appendChild(opt);
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
  info.appendChild(desc);
  info.appendChild(action);

  grid.appendChild(info);
  grid.appendChild(media);
  root.appendChild(grid);

  // Custom behavior synced with Cart
  const Cart = window.Cart;
  const currentId = ()=> (selected && weights) ? makeVariantId(baseId, selected) : baseId;
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
    if(product.featured && !product.newArrival) add('جديد');
  })();
})();
