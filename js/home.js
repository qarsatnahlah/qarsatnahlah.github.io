(async function(){
  const grid = document.getElementById('featuredGrid');
  if(!grid) return;

  const el = (tag, cls) => { const e = document.createElement(tag); if(cls) e.className = cls; return e; };

  try{
    const res = await fetch('data/products.json', {cache:'no-store'});
    if(!res.ok) throw new Error('تعذر تحميل ملف المنتجات');
    const data = await res.json();

    // Only active products
    const products = (data.products||[])
      .filter(p=> (p.status||'active') === 'active');
    // Featured sorted by featuredSortOrder ?? sortOrder ?? 9999
    const orderVal = (p)=> Number(p.featuredSortOrder ?? p.sortOrder ?? 9999);
    const featured = products
      .filter(p=> p.featured === true)
      .sort((a,b)=> orderVal(a) - orderVal(b))
      .slice(0, 4);

    if(featured.length === 0){
      const p = el('p','section-subtitle');
      p.textContent = 'لا توجد منتجات مميّزة حالياً.';
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

    grid.innerHTML = '';
    featured.forEach((p, idx)=>{
      const card = el('article','product-card reveal');
      card.setAttribute('data-animate','fade-up');
      card.setAttribute('data-delay', String(140 + idx*60));

      const a = el('a','product-media');
      a.href = `product.html?id=${encodeURIComponent(p.id)}`; a.setAttribute('aria-label', p.title);
      const img = el('img'); img.src = p.thumbnail || (p.images && p.images[0]) || 'imgs/honey.jpeg'; img.alt = p.title; img.loading='lazy';
      a.appendChild(img);

      if(p.discount && p.discount.type === 'percentage' && typeof p.discount.value === 'number'){
        const sale = el('span','product-badge product-badge--sale'); sale.textContent = `${p.discount.value}%`; a.appendChild(sale);
      } else if(p.newArrival || p.featured){
        const badge = el('span','product-badge product-badge--new'); badge.textContent = 'جديد'; a.appendChild(badge);
      }

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
        current.textContent = `${priceFmt(curPrice)} ${selected ? unitLabel(selected.grams) : ''}`.trim();
        old.textContent = '';
        if(cmpPrice && cmpPrice > curPrice){
          old.textContent = priceFmt(cmpPrice);
          if(!old.parentNode) priceWrap.appendChild(old);
        } else {
          if(old.parentNode) old.remove();
        }
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

      let btn = el('button','btn btn--add'); btn.type='button'; btn.innerHTML='أضف إلى السلة <i class="fa-solid fa-cart-shopping"></i>';

      content.appendChild(title); content.appendChild(priceWrap); if(weightBox) content.appendChild(weightBox); content.appendChild(btn);

      const rebindCartForSelection = ()=>{
        const id = selected && weights ? makeVariantId(p.id, selected) : p.id;
        try{ const parent = btn.parentNode; if(parent){ parent.querySelectorAll('.qty-controls').forEach(n=> n.remove()); } }catch{}
        try{ const fresh = btn.cloneNode(true); btn.replaceWith(fresh); btn = fresh; }catch{}
        btn.setAttribute('data-product-id', id);
        btn.removeAttribute('data-cart-bound');
        if(window.Cart){ window.Cart.bindButton(btn, id); btn.setAttribute('data-cart-bound','1'); }
      };
      rebindCartForSelection();

      card.appendChild(a); card.appendChild(content);
      grid.appendChild(card);

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

  }catch(err){
    const p = el('p','section-subtitle'); p.textContent = 'حدث خطأ أثناء تحميل المنتجات المميّزة.'; grid.appendChild(p); console.error(err);
  }
})();
