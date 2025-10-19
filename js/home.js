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
    // Featured sorted by featuredSortOrder ?? sortOrder; show all
    const orderVal = (p)=> Number(p.featuredSortOrder ?? p.sortOrder ?? 9999);
    const featured = products
      .filter(p=> p.featured === true)
      .sort((a,b)=> orderVal(a) - orderVal(b));

    if(featured.length === 0){
      const p = el('p','section-subtitle');
      p.textContent = 'لا توجد منتجات مميّزة حالياً.';
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

    grid.innerHTML = '';
    featured.forEach((p, idx)=>{
      const card = el('article','product-card reveal');
      card.setAttribute('data-animate','fade-up');
      card.setAttribute('data-delay', String(140 + idx*60));

      const a = el('a','product-media');
      a.href = `product.html?id=${encodeURIComponent(p.id)}`; a.setAttribute('aria-label', p.title);
      const img = el('img'); img.src = p.thumbnail || (p.images && p.images[0]) || 'imgs/honey.jpeg'; img.alt = p.title; img.loading='lazy';
      img.decoding = 'async';
      img.fetchPriority = 'low';
      a.appendChild(img);

      if(p.discount && ['percentage','percent','precent'].includes(String(p.discount.type||'').toLowerCase()) && typeof p.discount.value === 'number'){
        const sale = el('span','product-badge product-badge--sale'); sale.textContent = `${p.discount.value}%`; a.appendChild(sale);
      } else if(p.newArrival){
        const badge = el('span','product-badge product-badge--new'); badge.textContent = 'جديد'; a.appendChild(badge);
      } else if(p.featured){
        const badge = el('span','product-badge product-badge--featured'); badge.textContent = 'مميّز'; a.appendChild(badge);
      }

      const content = el('div','product-content');
      const title = el('h3','product-title'); title.textContent = p.title;
      const priceWrap = el('div','product-price');
      const current = el('span','product-price__current');
      const old = el('span','product-price__old');

      const weights = Array.isArray(p.weights) ? p.weights : null;
      const special = (p.id === 'p-honey-wild');
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
          opt.textContent = w.label || (formatUnit(w).replace(/^\s*\/\s*/, '') || 'خيار');
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

      let btn = el('button','btn btn--add'); btn.type='button';
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

      if(!special){
        const rebindCartForSelection = ()=>{
          const id = selected && weights ? makeVariantId(p.id, selected) : p.id;
          try{ const parent = btn.parentNode; if(parent){ parent.querySelectorAll('.qty-controls').forEach(n=> n.remove()); } }catch{}
          try{ const fresh = btn.cloneNode(true); btn.replaceWith(fresh); btn = fresh; }catch{}
          btn.setAttribute('data-product-id', id);
          btn.removeAttribute('data-cart-bound');
          if(window.Cart){ window.Cart.bindButton(btn, id); btn.setAttribute('data-cart-bound','1'); }
        };
        rebindCartForSelection();
      }

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
