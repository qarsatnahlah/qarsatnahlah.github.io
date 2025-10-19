(async function(){
  const grid = document.getElementById('allGrid');
  const pager = document.getElementById('allPager');
  const catList = document.getElementById('catList');
  const priceMin = document.getElementById('priceMin');
  const priceMax = document.getElementById('priceMax');
  const priceMinLabel = document.getElementById('priceMinLabel');
  const priceMaxLabel = document.getElementById('priceMaxLabel');
  const applyBtn = document.getElementById('applyFilters');
  const filterToggle = document.getElementById('filterToggle');
  const shopSidebar = document.getElementById('shopSidebar');
  const searchInput = document.getElementById('navSearchInput') || document.getElementById('productSearch');
  if(!grid) return;

  const el = (tag, cls) => { const e = document.createElement(tag); if(cls) e.className = cls; return e; };
  // Normalize Arabic text for search: remove diacritics, unify forms, remove tatweel
  const normalizeArabic = (txt='')=> (
    String(txt)
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[\u064B-\u0652]/g, '') // harakat
      .replace(/\u0640/g, '') // tatweel
      .replace(/[\u0622\u0623\u0625]/g, '\u0627') // آأإ -> ا
      .replace(/\u0629/g, '\u0647') // ة -> ه
      .replace(/\u0649/g, '\u064A') // ى -> ي
  );
  const makeSearchIndex = (p)=> normalizeArabic([p.title, p.description, (p.tags||[]).join(' ')].join(' '));
  const debounce = (fn, ms=250)=>{ let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=> fn(...args), ms); }; };
  // No inline fallback: products must come from data/products.json

  let data = null;
  try{
    const res = await fetch('data/products.json', {cache:'no-store'});
    if(!res.ok) throw new Error('تعذر تحميل ملف المنتجات');
    data = await res.json();
  }catch(err){
    const p = document.createElement('p');
    p.className = 'section-subtitle';
    p.textContent = 'تعذر تحميل ملف المنتجات. الرجاء المحاولة لاحقًا.';
    grid && grid.appendChild(p);
    console.error(err);
    return;
  }

  try{
    if(!data) throw new Error('no-data');
    const currency = data.currency || 'EGP';
    // only active products
    const products = (data.products || []).filter(p=> (p.status||'active') === 'active');
    // sort by sortOrderAll ?? sortOrder
    const orderAllVal = (p)=> Number(p.sortOrderAll ?? p.sortOrder ?? 9999);
    products.sort((a,b)=> orderAllVal(a) - orderAllVal(b));
    // precompute simple search index
    products.forEach(p=>{ p._search = makeSearchIndex(p); });

    // Helpers: default weight picker and max price per product
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
    const getMaxPrice = (p)=>{
      const ws = Array.isArray(p.weights) ? p.weights : null;
      if(ws && ws.length){ return Math.max(...ws.map(w=> Number(w.price)||0)); }
      return Number(p.price)||0;
    };
    // Unit formatter supporting unit/amount or fallback to grams
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
    // Setup price bounds using highest variant price; enforce minimum of 1
    const prices = products.map(getMaxPrice);
    const minBoundRaw = Math.min(...prices);
    const maxBoundRaw = Math.max(...prices);
    const minBound = Math.max(1, Number.isFinite(minBoundRaw) ? Math.floor(minBoundRaw) : 1);
    const maxBound = Math.max(minBound, Number.isFinite(maxBoundRaw) ? Math.ceil(maxBoundRaw) : (Number(priceMax ? priceMax.max : 500) || 500));
    // Initialize sliders robustly: browsers may clamp value to initial max in HTML, so force into bounds
    if(priceMin){
      priceMin.min = String(minBound);
      priceMin.max = String(maxBound);
      let v = Number(priceMin.value);
      if(!Number.isFinite(v) || v < minBound) v = minBound;
      if(v > maxBound) v = minBound;
      priceMin.value = String(v);
    }
    if(priceMax){
      priceMax.min = String(minBound);
      priceMax.max = String(maxBound);
      let v = Number(priceMax.value);
      // If current value is not finite or less than computed maxBound, bump to maxBound to avoid accidental filtering
      if(!Number.isFinite(v) || v < maxBound) v = maxBound;
      if(v < minBound) v = maxBound;
      priceMax.value = String(v);
    }
    if(priceMinLabel && priceMin) priceMinLabel.textContent = String(priceMin.value);
    if(priceMaxLabel && priceMax) priceMaxLabel.textContent = String(priceMax.value);

    // Categories map
    const catName = (id)=> (data.categories||[]).find(c=> c.id===id)?.name || id;
    const cats = ['all', ...Array.from(new Set(products.map(p=> p.categoryId)))];
    let selectedCat = 'all';
    // pick initial search from URL (?q=...)
    const params = new URLSearchParams(window.location.search || '');
    let searchQuery = params.get('q') || '';
    if(searchInput && searchQuery){ searchInput.value = searchQuery; }

    const priceFmt = (value)=> `${value} ج.م`;
    const perPage = 6;

    const buildCatList = ()=>{
      if(!catList) return;
      catList.innerHTML = '';
      cats.forEach(cid=>{
        const li = document.createElement('li');
        const name = cid==='all' ? 'الكل' : catName(cid);
        const count = (cid==='all') 
          ? products.length 
          : products.filter(p=> p.categoryId===cid).length;
        li.innerHTML = `<span>${name}</span><span class="count">${count}</span>`;
        if((cid==='all' && selectedCat==='all') || (cid===selectedCat)) li.setAttribute('aria-current','true');
        li.addEventListener('click', ()=>{ selectedCat = cid; render(1); });
        catList.appendChild(li);
      });
    };

    const applyFilters = (items)=>{
      let minV = priceMin ? Number(priceMin.value) : minBound;
      let maxV = priceMax ? Number(priceMax.value) : maxBound;
      // Clamp values and ensure max >= min
      minV = Math.max(1, minBound, Number.isFinite(minV) ? minV : minBound);
      maxV = Math.max(minV, Number.isFinite(maxV) ? maxV : maxBound);
      const q = normalizeArabic(searchQuery);
      const bySearch = q ? items.filter(p=> p._search && p._search.includes(q)) : items;
      // Filter using highest price among weights (or product price)
      const byPrice = bySearch.filter(p=> {
        const price = getMaxPrice(p);
        return price >= minV && price <= maxV;
      });
      const byCat = selectedCat==='all' ? byPrice : byPrice.filter(p=> p.categoryId === selectedCat);
      return byCat;
    };

    const renderCards = (items)=>{
      grid.innerHTML = '';
      items.forEach((p, idx)=>{
        const card = el('article','product-card reveal');
        card.setAttribute('data-animate','fade-up');
        card.setAttribute('data-delay', String(140 + idx*60));

        const a = el('a','product-media');
        a.href = `product.html?id=${encodeURIComponent(p.id)}`; a.setAttribute('aria-label', p.title);
        const img = el('img'); img.src = p.thumbnail || (p.images && p.images[0]) || 'imgs/honey.jpeg'; img.alt = p.title; img.loading = 'lazy';
        img.decoding = 'async';
        img.fetchPriority = 'low';
        a.appendChild(img);

        // badges container (stacked)
        const badgesBox = el('div','product-badges');
        a.appendChild(badgesBox);

        (function renderBadges(){
          const isOut = (p.stockStatus === 'out_of_stock') || (typeof p.stockQuantity === 'number' && p.stockQuantity <= 0);
          const add = (text, cls='product-badge product-badge--new')=>{ const b = el('span', cls); b.textContent = text; badgesBox.appendChild(b); };
          // 1) Out of stock only
          if(isOut){ add('غير متوفر حاليا', 'product-badge product-badge--oos'); return; }
          // 2) Group: New + Bestseller + Discount (together)
          if(p.newArrival) add('جديد');
          if(p.bestseller) add('الأكثر مبيعاً');
          if(p.discount && ['percentage','percent','precent'].includes(String(p.discount.type||'').toLowerCase()) && typeof p.discount.value === 'number') add(`${p.discount.value}%`, 'product-badge product-badge--sale');
          // 3) PreOrder
          if(p.preOrder) add('طلب مسبق');
          // 4) Remaining
          if(p.limitedEdition) add('إصدار محدود');
          if(p.bundle) add('باقة');
          if(p.featured) add('مميّز', 'product-badge product-badge--featured');
        })();

        const content = el('div','product-content');
        const title = el('h3','product-title'); title.textContent = p.title;
        const priceWrap = el('div','product-price');
        const current = el('span','product-price__current');
        const old = el('span','product-price__old');

        // Any product that defines weights gets variants UI
        const weights = Array.isArray(p.weights) ? p.weights : null;
        const special = (p.id === 'p-honey-wild');
        let selected = pickDefaultWeight(weights, p);

        const syncPrice = ()=>{
          const curPrice = selected ? selected.price : p.price;
          const cmpPrice = selected ? (selected.compareAtPrice || null) : (p.compareAtPrice || null);
          current.textContent = `${priceFmt(curPrice)} ${selected ? formatUnit(selected) : ''}`.trim();
          old.textContent = '';
          if(cmpPrice && cmpPrice > curPrice){
            old.textContent = priceFmt(cmpPrice);
            if(!old.parentNode) priceWrap.appendChild(old);
          } else {
            if(old.parentNode) old.remove();
          }
        };
        if(!special){
          syncPrice();
          priceWrap.appendChild(current);
        }

        let weightBox = null;
        const makeVariantId = (prodId, w)=> `${prodId}::${w.id||String(w.grams||'custom')}`;
        if(!special && weights && weights.length){
          weightBox = el('div','weight-options');
          weights.forEach((w, i)=>{
            const opt = el('button','weight-option');
            opt.type = 'button';
            opt.textContent = optionLabel(w);
            if(w.inStock === false){ opt.disabled = true; opt.setAttribute('aria-disabled','true'); }
            if((selected && (w === selected)) || (!selected && i===0)) opt.classList.add('is-selected');
            // Per-variant quantity badge
            const variantId = makeVariantId(p.id, w);
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
              rebindCartForSelection();
              syncBadge();
            });
            weightBox.appendChild(opt);
          });
        }

        // Compact helper row with inline small custom button (above variant options)
        if(!special && p.customPricing && p.customPricing.enabled && Number(p.customPricing.pricePerUnit)>0){
          const cpUnit = String(p.customPricing.unit||'').toLowerCase();
          const row = el('div','card-custom-row');
          const help = el('p','card-custom-help');
          const noun = (cpUnit==='ml') ? 'المللي' : 'الجرام';
          help.innerHTML = `سعر ${noun}: <b>${p.customPricing.pricePerUnit} ج.م</b>`;
          row.appendChild(help);
          const cpLabel = p.customPricing.label || (cpUnit==='ml' ? 'تحديد المللي' : 'تحديد الجرامات');
          const cpBtn = el('a','weight-option weight-option--custom weight-option--sm');
          cpBtn.href = `product.html?id=${encodeURIComponent(p.id)}&custom=1`;
          cpBtn.setAttribute('aria-label', cpLabel);
          cpBtn.textContent = cpLabel;
          row.appendChild(cpBtn);
          content.classList.add('has-custom-inline');
          content.appendChild(row);
        }

        let btn = el('button','btn btn--add');
        btn.type='button';
        if(special){
          btn.textContent = 'ادخل لتحديد نوع العسل';
          btn.addEventListener('click', ()=>{ window.location.href = `product.html?id=${encodeURIComponent(p.id)}`; });
        } else {
          btn.innerHTML='أضف إلى السلة <i class="fa-solid fa-cart-shopping"></i>';
        }

        content.appendChild(title);
        // Always append priceWrap to keep consistent card height; it's empty for special case
        content.appendChild(priceWrap);
        if(!special && weightBox) content.appendChild(weightBox);
        content.appendChild(btn);
        card.appendChild(a); card.appendChild(content);
        grid.appendChild(card);

        // Bind per variant or product; avoid duplicate qty-controls/listeners
        if(!special){
          const rebindCartForSelection = ()=>{
            const id = selected && weights ? makeVariantId(p.id, selected) : p.id;
            try{ const parent = btn.parentNode; if(parent){ parent.querySelectorAll('.qty-controls').forEach(n=> n.remove()); } }catch{}
            try{ const fresh = btn.cloneNode(true); btn.replaceWith(fresh); btn = fresh; }catch{}
            btn.setAttribute('data-product-id', id);
            btn.removeAttribute('data-cart-bound');
            if(window.Cart && typeof window.Cart.bindButton==='function'){ window.Cart.bindButton(btn, id); btn.setAttribute('data-cart-bound','1'); }
          };
          rebindCartForSelection();
        }

        // Make entire card clickable (except buttons)
        card.style.cursor = 'pointer';
        card.tabIndex = 0;
        const go = ()=>{ window.location.href = `product.html?id=${encodeURIComponent(p.id)}`; };
        card.addEventListener('click', (e)=>{ if(e.target.closest('button')) return; go(); });
        card.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' '){ if(document.activeElement && document.activeElement.closest('button')) return; e.preventDefault(); go(); } });
      });

      if(window && 'IntersectionObserver' in window){
        const toObserve = grid.querySelectorAll('.reveal');
        const io = new IntersectionObserver((entries)=>{
          entries.forEach((entry)=>{ if(entry.isIntersecting){ const elx = entry.target; const delay = parseInt(elx.getAttribute('data-delay')||'0', 10); elx.classList.add('reveal'); setTimeout(()=> elx.classList.add('in-view'), delay); io.unobserve(elx); } });
        },{ threshold: .15, rootMargin: '0px 0px -10%' });
        toObserve.forEach(elm=> io.observe(elm));
      }
    };

    const buildPager = (page, totalPages, onGo)=>{
      if(!pager) return;
      pager.innerHTML='';
      if(totalPages <= 1) return;
      const mk = (label, p, current=false)=>{ const b = document.createElement('button'); b.textContent = label; if(current) b.setAttribute('aria-current','page'); b.addEventListener('click', ()=> onGo(p)); return b; };
      pager.appendChild(mk('‹', Math.max(1, page-1)));
      for(let i=1;i<=totalPages;i++) pager.appendChild(mk(String(i), i, i===page));
      pager.appendChild(mk('›', Math.min(totalPages, page+1)));
    };

    const render = (page=1)=>{
      // Update labels while rendering
      if(priceMinLabel && priceMin) priceMinLabel.textContent = String(priceMin.value);
      if(priceMaxLabel && priceMax) priceMaxLabel.textContent = String(priceMax.value);

      const filtered = applyFilters(products);
      buildCatList();

      const per = perPage;
      const pages = Math.ceil(filtered.length / per) || 1;
      const start = (page-1)*per;
      renderCards(filtered.slice(start, start+per));
      buildPager(page, pages, (p)=> render(p));
    };

    // Initial
    render(1);

    // Wire controls
    if(priceMin) priceMin.addEventListener('input', ()=>{
      // Enforce min >= 1 and not exceed priceMax
      let v = Number(priceMin.value)||minBound;
      v = Math.max(1, minBound, Math.min(v, Number(priceMax ? priceMax.value : maxBound)));
      priceMin.value = String(v);
      if(priceMinLabel) priceMinLabel.textContent = String(v);
      // Ensure priceMax is >= priceMin
      if(priceMax && Number(priceMax.value) < v){ priceMax.value = String(v); if(priceMaxLabel) priceMaxLabel.textContent = String(v); }
    });
    if(priceMax) priceMax.addEventListener('input', ()=>{
      // Enforce max >= min
      let v = Number(priceMax.value)||maxBound;
      const minV = Number(priceMin ? priceMin.value : minBound) || minBound;
      v = Math.max(minV, v);
      priceMax.value = String(v);
      if(priceMaxLabel) priceMaxLabel.textContent = String(v);
    });
    if(applyBtn) applyBtn.addEventListener('click', ()=> render(1));

    if(searchInput){
      const onSearch = debounce(()=>{ searchQuery = searchInput.value || ''; render(1); }, 200);
      searchInput.addEventListener('input', onSearch);
      // Other handlers are managed globally in script.js
    }

    // Mobile filter toggle behavior
    const BREAKPOINT = 981;
    const applyLayout = ()=>{
      const w = window.innerWidth || document.documentElement.clientWidth;
      if(!shopSidebar) return;
      if(w < BREAKPOINT){
        // mobile: keep hidden by default, show toggle
        if(filterToggle) filterToggle.style.display = 'inline-flex';
        shopSidebar.setAttribute('hidden','');
        if(filterToggle) filterToggle.setAttribute('aria-expanded','false');
      }else{
        // desktop: show sidebar and hide toggle
        shopSidebar.removeAttribute('hidden');
        if(filterToggle) filterToggle.style.display = 'none';
      }
    };
    applyLayout();
    window.addEventListener('resize', applyLayout, {passive:true});

    if(filterToggle && shopSidebar){
      filterToggle.addEventListener('click', ()=>{
        const isHidden = shopSidebar.hasAttribute('hidden');
        if(isHidden) shopSidebar.removeAttribute('hidden'); else shopSidebar.setAttribute('hidden','');
        filterToggle.setAttribute('aria-expanded', String(isHidden));
      });
    }

  }catch(err){
    const p = el('p','section-subtitle'); p.textContent = 'حدث خطأ أثناء تحميل جميع المنتجات.'; grid.appendChild(p); console.error(err);
  }
})();
