(async function(){
  const grid = document.getElementById('mixesGrid');
  if(!grid) return;

  const el = (tag, cls) => { const e = document.createElement(tag); if(cls) e.className = cls; return e; };
  // No inline fallback: products must come from data/products.json

  let data = null;
  try{
    const res = await fetch('data/products.json', {cache:'no-store'});
    if(!res.ok) throw new Error('تعذر تحميل ملف المنتجات');
    data = await res.json();
  }catch(err){
    const p = el('p','section-subtitle');
    p.textContent = 'تعذر تحميل ملف المنتجات. الرجاء المحاولة لاحقًا.';
    grid.appendChild(p);
    console.error(err);
    return;
  }

  try{
    if(!data) throw new Error('no-data');
    const currency = data.currency || 'EGP';
    // only active mixes, sorted by optional sortOrder
    const mixes = (data.products||[])
      .filter(p=> p.categoryId === 'c-mixes' && (p.status||'active') === 'active')
      .sort((a,b)=> (Number(a.categorySortOrder ?? a.sortOrder ?? 9999)) - (Number(b.categorySortOrder ?? b.sortOrder ?? 9999)));

    if(mixes.length === 0){
      const p = el('p','section-subtitle');
      p.textContent = 'لا توجد خلطات متاحة حاليًا.';
      grid.appendChild(p);
      return;
    }

    const priceFmt = (value)=> `${value} ج.م`;
    const unitLabel = (grams)=>{
      if(!grams) return '';
      if(grams >= 1000) return '/ كيلو';
      if(grams === 500) return '/ 500 جم';
      if(grams === 250) return '/ 250 جم';
      return `/ ${grams} جم`;
    };
    const perPage = 6;
    const pager = el('div','pagination');

    const renderPage = (page=1)=>{
      grid.innerHTML = '';
      const start = (page-1)*perPage;
      const items = mixes.slice(start, start+perPage);

      items.forEach((p, idx)=>{
        const card = el('article','product-card reveal');
        card.setAttribute('data-animate','fade-up');
        card.setAttribute('data-delay', String(140 + idx*60));

        const a = el('a','product-media');
        a.href = `product.html?id=${encodeURIComponent(p.id)}`;
        a.setAttribute('aria-label', p.title);
        const img = el('img');
        img.src = (p.thumbnail || (p.images && p.images[0]) || 'imgs/honey.jpeg');
        img.alt = p.title;
        img.loading = 'lazy';
        a.appendChild(img);

        (function renderBadges(){
          const isOut = (p.stockStatus === 'out_of_stock') || (typeof p.stockQuantity === 'number' && p.stockQuantity <= 0);
          const add = (text, cls='product-badge product-badge--new')=>{ const b = el('span', cls); b.textContent = text; a.appendChild(b); };
          if(isOut){ add('غير متوفر حاليا', 'product-badge product-badge--oos'); return; }
          if(p.discount && p.discount.type === 'percentage' && typeof p.discount.value === 'number') add(`${p.discount.value}%`, 'product-badge product-badge--sale');
          if(p.newArrival) add('جديد');
          if(p.bestseller) add('الأكثر مبيعاً');
          if(p.limitedEdition) add('إصدار محدود');
          if(p.preOrder) add('طلب مسبق');
          if(p.bundle) add('باقة');
        })();

        const content = el('div','product-content');
        const title = el('h3','product-title'); title.textContent = p.title;
        const priceWrap = el('div','product-price');
        const current = el('span','product-price__current');
        const old = el('span','product-price__old');

        const weights = Array.isArray(p.weights) ? p.weights : null;
        let selected = weights && weights.find(w=> w.inStock !== false) || (weights && weights[0]) || null;

        const syncPrice = ()=>{
          const curPrice = selected ? selected.price : p.price;
          const cmpPrice = selected ? (selected.compareAtPrice || null) : (p.compareAtPrice || null);
          current.textContent = `${priceFmt(curPrice)} ${selected ? unitLabel(selected.grams) : ''}`.trim();
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
            opt.textContent = w.label || (w.grams ? (w.grams===1000? '1 كيلو' : w.grams===500? '½ كيلو' : w.grams===250? '¼ كيلو' : `${w.grams} جم`) : 'خيار');
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

        let btn = el('button','btn btn--add');
        btn.type='button';
        btn.innerHTML='أضف إلى السلة <i class="fa-solid fa-cart-shopping"></i>';

        content.appendChild(title); content.appendChild(priceWrap); if(weightBox) content.appendChild(weightBox); content.appendChild(btn);

        card.appendChild(a);
        card.appendChild(content);

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
          entries.forEach((entry)=>{
            if(entry.isIntersecting){
              const elx = entry.target;
              const delay = parseInt(elx.getAttribute('data-delay')||'0', 10);
              elx.classList.add('reveal');
              setTimeout(()=> elx.classList.add('in-view'), delay);
              io.unobserve(elx);
            }
          });
        },{ threshold: .15, rootMargin: '0px 0px -10%' });
        toObserve.forEach(el=> io.observe(el));
      }

      const pages = Math.ceil(mixes.length / perPage);
      pager.innerHTML = '';
      if(pages > 1){
        const makeBtn = (label, p, isCurrent=false)=>{
          const b = el('button');
          b.textContent = label;
          if(isCurrent) b.setAttribute('aria-current','page');
          b.addEventListener('click', ()=> renderPage(p));
          return b;
        };
        const prev = makeBtn('‹', Math.max(1, page-1));
        pager.appendChild(prev);
        for(let i=1;i<=pages;i++) pager.appendChild(makeBtn(String(i), i, i===page));
        const next = makeBtn('›', Math.min(pages, page+1));
        pager.appendChild(next);
      }
    };

    renderPage(1);
    grid.after(pager);

  }catch(err){
    const msg = el('p','section-subtitle');
    msg.textContent = 'حدث خطأ أثناء تحميل الخلطات.';
    grid.appendChild(msg);
    console.error(err);
  }
})();
