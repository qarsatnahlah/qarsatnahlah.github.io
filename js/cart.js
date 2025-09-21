// Lightweight cart module: manages quantities per product and updates UI/badge
(function(){
  const STORAGE_KEY = 'cart:v1';
  const state = load();

  function load(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{}; }catch{ return {}; }
  }
  function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch{} }

  function totalQty(){ return Object.values(state).reduce((a,b)=> a + (Number(b)||0), 0); }

  function updateBadge(){
    const badge = document.querySelector('.cart__badge');
    if(!badge) return;
    const t = totalQty();
    if(t > 0){ badge.textContent = String(t); badge.style.display = ''; }
    else{ badge.textContent = '0'; badge.style.display = 'none'; }
  }

  function add(id, delta){
    const cur = Number(state[id]||0);
    const next = Math.max(0, cur + delta);
    if(next <= 0) delete state[id]; else state[id] = next;
    save();
    updateBadge();
    document.dispatchEvent(new CustomEvent('cart:change', { detail: { id, qty: next, total: totalQty() } }));
    return next;
  }

  function getQty(id){ return Number(state[id]||0); }

  // Build inline controls next to a given Add button
  function buildControls(btn, id){
    const wrap = document.createElement('div');
    wrap.className = 'qty-controls';

    // meta pill (label + count)
    const meta = document.createElement('span');
    meta.className = 'qty-meta';
    const label = document.createElement('span');
    label.className = 'qty-label';
    label.textContent = 'الكمية المطلوبة :';
    const count = document.createElement('span');
    count.className = 'qty-count';
    count.textContent = '0';
    meta.appendChild(label);
    meta.appendChild(count);

    const plusBtn = document.createElement('button');
    plusBtn.type='button'; plusBtn.className='qty-btn qty-plus'; plusBtn.textContent = '+1';

    const minusBtn = document.createElement('button');
    minusBtn.type='button'; minusBtn.className='qty-btn qty-minus'; minusBtn.textContent = '-1';

    const removeBtn = document.createElement('button');
    removeBtn.type='button'; removeBtn.className='qty-btn qty-remove'; removeBtn.textContent = 'إزالة';

    // order: meta, +1, -1, إزالة
    wrap.appendChild(meta);
    wrap.appendChild(plusBtn);
    wrap.appendChild(minusBtn);
    wrap.appendChild(removeBtn);

    const sync = ()=>{
      const q = getQty(id);
      // Show controls when q>0; show -1 only when q>1
      wrap.style.display = q>0 ? 'flex' : 'none';
      minusBtn.style.display = q>1 ? '' : 'none';
      btn.style.display = q>0 ? 'none' : '';
      count.textContent = String(q);
    };

    removeBtn.addEventListener('click', ()=>{ add(id, -getQty(id)); sync(); });
    plusBtn.addEventListener('click', ()=>{ add(id, +1); sync(); });
    minusBtn.addEventListener('click', ()=>{ add(id, -1); sync(); });

    // Initial state
    sync();
    // React to global cart changes
    document.addEventListener('cart:change', (e)=>{ if(e.detail && e.detail.id === id) sync(); });

    return wrap;
  }

  function bindButton(btn, id){
    if(!btn || !id) return;
    // Create controls after the button
    const controls = buildControls(btn, id);
    btn.parentNode && btn.parentNode.appendChild(controls);

    btn.addEventListener('click', ()=>{
      add(id, +1); // first add
      // After first add, controls will appear, and -1 remains hidden until qty>1
      // Immediate UI sync to avoid relying only on event timing
      const q = getQty(id);
      controls.style.display = 'flex';
      btn.style.display = 'none';
      const minus = controls.querySelector('.qty-minus');
      if(minus) minus.style.display = q>1 ? '' : 'none';
      const cnt = controls.querySelector('.qty-count');
      if(cnt) cnt.textContent = String(q);
    });

    // Ensure UI reflects stored qty on load
    const event = new CustomEvent('cart:change', { detail: { id, qty: getQty(id), total: totalQty() } });
    document.dispatchEvent(event);
  }

  // Auto-bind any static buttons that declare data-product-id
  function autoBind(){
    document.querySelectorAll('button.btn.btn--add[data-product-id]:not([data-cart-bound])').forEach(btn=>{
      const id = btn.getAttribute('data-product-id');
      if(!id) return;
      window.Cart && window.Cart.bindButton(btn, id);
      btn.setAttribute('data-cart-bound','1');
    });
  }

  // Expose globally
  window.Cart = { add, getQty, totalQty, updateBadge, bindButton, autoBind };

  // On load, update badge once and bind static buttons
  updateBadge();
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', autoBind);
  }else{
    autoBind();
  }

  // Observe DOM for dynamically injected buttons
  try{
    const mo = new MutationObserver((mutations)=>{
      let shouldBind = false;
      for(const m of mutations){
        if(m.addedNodes && m.addedNodes.length){ shouldBind = true; break; }
      }
      if(shouldBind) autoBind();
    });
    mo.observe(document.documentElement || document.body, { childList:true, subtree:true });
  }catch{}
})();
