(async function(){
  const grid = document.getElementById('oilsGrid');
  if(!grid) return;

  const el = (tag, cls) => { const e = document.createElement(tag); if(cls) e.className = cls; return e; };

  // No inline fallback: products must come from data/products.json

  let data = null;
  try{
    const res = await fetch('data/products.json', {cache:'no-store'});
    if(!res.ok) throw new Error('تعذر تحميل ملف المنتجات');
    data = await res.json();
  }catch(err){
    const msg = el('p','section-subtitle'); msg.textContent = 'تعذر تحميل ملف المنتجات. الرجاء المحاولة لاحقًا.'; grid.appendChild(msg); console.error(err); return;
  }

  try{
    if(!data) throw new Error('no-data');
    // only active oils, sorted by optional sortOrder
    const oils = (data.products||[])
      .filter(p=> p.categoryId === 'c-oils' && (p.status||'active') === 'active')
      .sort((a,b)=> (Number(a.categorySortOrder ?? a.sortOrder ?? 9999)) - (Number(b.categorySortOrder ?? b.sortOrder ?? 9999)));

    if(oils.length === 0){
      const p = el('p','section-subtitle');
      p.textContent = 'لا توجد منتجات زيوت متاحة حاليًا.';
      grid.appendChild(p);
      return;
    }

    const priceFmt = (value)=> `${value} ج.م`;
    // Format unit text from weight object (supports unit/amount or fallback to grams)
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
        // Fallback generic
        if(Number.isFinite(amt)) return `/ ${amt} ${unit}`;
        return '';
      }
      // Fallback to grams if provided
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

    const perPage = 6;
    const pager = el('div','pagination');

    const renderPage = (page=1)=>{
      grid.innerHTML = '';
      const start = (page-1)*perPage;
      const items = oils.slice(start, start+perPage);

      items.forEach((p, idx)=>{
        const card = el('article','product-card reveal');
        card.setAttribute('data-animate','fade-up');
        card.setAttribute('data-delay', String(140 + idx*60));

        const a = el('a','product-media');
        a.href = `product.html?id=${encodeURIComponent(p.id)}`; a.setAttribute('aria-label', p.title);
        const img = el('img'); img.src = p.thumbnail || (p.images && p.images[0]) || 'imgs/oils.jpeg'; img.alt = p.title; img.loading='lazy';
        a.appendChild(img);

        // badges container (stacked)
        const badgesBox = el('div','product-badges');
        a.appendChild(badgesBox);

        (function renderBadges(){
          const isOut = (p.stockStatus === 'out_of_stock') || (typeof p.stockQuantity === 'number' && p.stockQuantity <= 0);
          const add = (text, cls='product-badge product-badge--new')=>{ const b = el('span', cls); b.textContent = text; badgesBox.appendChild(b); };
          // 1) Out of stock only (red)
          if(isOut){ add('غير متوفر حاليا', 'product-badge product-badge--oos'); return; }
          // 2) Group: New + Bestseller + Discount (together)
          if(p.newArrival) add('جديد');
          if(p.bestseller) add('الأكثر مبيعاً');
          if(p.discount && p.discount.type === 'percentage' && typeof p.discount.value === 'number') add(`${p.discount.value}%`, 'product-badge product-badge--sale');
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

        const weights = Array.isArray(p.weights) ? p.weights : null;
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
        let selected = pickDefaultWeight(weights, p);

        const syncPrice = ()=>{
          const curPrice = selected ? selected.price : p.price;
          const cmpPrice = selected ? (selected.compareAtPrice || null) : (p.compareAtPrice || null);
          current.textContent = `${priceFmt(curPrice)} ${selected ? formatUnit(selected) : ''}`.trim();
          old.textContent = '';
          if(cmpPrice && cmpPrice > curPrice){ old.textContent = priceFmt(cmpPrice); if(!old.parentNode) priceWrap.appendChild(old); }
          else{ if(old.parentNode) old.parentNode.remove(); }
        };
        syncPrice();
        priceWrap.appendChild(current);

        let weightBox = null;
        const makeVariantId = (prodId, w)=> `${prodId}::${w.id||String(w.grams||'custom')}`;
        if(weights && weights.length){
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

        // Compact helper row with inline small custom button (above weight options)
        if(p.customPricing && p.customPricing.enabled && Number(p.customPricing.pricePerUnit)>0){
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
        btn.innerHTML='أضف إلى السلة <i class="fa-solid fa-cart-shopping"></i>';

        content.appendChild(title); content.appendChild(priceWrap);
        // helper row already added above if enabled
        if(weightBox) content.appendChild(weightBox);
        content.appendChild(btn);
        card.appendChild(a); card.appendChild(content);
        grid.appendChild(card);

        // Bind per variant or product; avoid duplicate qty-controls/listeners
        const rebindCartForSelection = ()=>{
          const id = selected && weights ? makeVariantId(p.id, selected) : p.id;
          try{ const parent = btn.parentNode; if(parent){ parent.querySelectorAll('.qty-controls').forEach(n=> n.remove()); } }catch{}
          try{ const fresh = btn.cloneNode(true); btn.replaceWith(fresh); btn = fresh; }catch{}
          btn.setAttribute('data-product-id', id);
          btn.removeAttribute('data-cart-bound');
          if(window.Cart && typeof window.Cart.bindButton==='function'){ window.Cart.bindButton(btn, id); btn.setAttribute('data-cart-bound','1'); }
        };
        rebindCartForSelection();
        // Allow cart.js autoBind/MutationObserver to bind once automatically
      });

      if(window && 'IntersectionObserver' in window){
        const toObserve = grid.querySelectorAll('.reveal');
        const io = new IntersectionObserver((entries)=>{
          entries.forEach((entry)=>{ if(entry.isIntersecting){ const el = entry.target; const delay = parseInt(el.getAttribute('data-delay')||'0', 10); el.classList.add('reveal'); setTimeout(()=> el.classList.add('in-view'), delay); io.unobserve(el); } });
        },{ threshold: .15, rootMargin: '0px 0px -10%' });
        toObserve.forEach(el=> io.observe(el));
      }

      const pages = Math.ceil(oils.length / perPage);
      pager.innerHTML = '';
      if(pages > 1){
        const makeBtn = (label, p, isCurrent=false)=>{ const b = el('button'); b.textContent = label; if(isCurrent) b.setAttribute('aria-current','page'); b.addEventListener('click', ()=> renderPage(p)); return b; };
        pager.appendChild(makeBtn('‹', Math.max(1, page-1)));
        for(let i=1;i<=pages;i++) pager.appendChild(makeBtn(String(i), i, i===page));
        pager.appendChild(makeBtn('›', Math.min(pages, page+1)));
      }
    };

    renderPage(1);
    grid.after(pager);
  }catch(err){
    const msg = el('p','section-subtitle'); msg.textContent = 'حدث خطأ أثناء تحميل المنتجات.'; grid.appendChild(msg); console.error(err);
  }
})();
