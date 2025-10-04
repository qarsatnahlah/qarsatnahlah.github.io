// Reveal on scroll using IntersectionObserver
(function(){
  // 1) Auto-assign animations + delays for breadcrumb items (stagger)
  const crumbs = document.querySelectorAll('.nav-center .breadcrumb li');
  crumbs.forEach((li, i)=>{
    if(!li.hasAttribute('data-animate')) li.setAttribute('data-animate','fade-up');
    li.setAttribute('data-delay', String(80 * i));
  });

  // 2) Observe any .reveal or [data-animate] elements
  const items = new Set([
    ...document.querySelectorAll('.reveal'),
    ...document.querySelectorAll('[data-animate]')
  ]);

  const io = new IntersectionObserver((entries)=>{
    entries.forEach((entry)=>{
      if(entry.isIntersecting){
        const el = entry.target;
        const delay = parseInt(el.getAttribute('data-delay')||'0', 10);
        // ensure base hidden state if element didn't have .reveal
        el.classList.add('reveal');
        setTimeout(()=>{
          el.classList.add('in-view');
        }, delay);
        io.unobserve(el);
      }
    })
  },{ threshold: .15, rootMargin: '0px 0px -10%' });

  items.forEach(el=> io.observe(el));
})();

// Navbar search: submit navigates to index.html?q=...
(function(){
  const form = document.getElementById('navSearchForm');
  const input = document.getElementById('navSearchInput');
  if(!form || !input) return;
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const q = (input.value || '').trim();
    const url = `index.html?q=${encodeURIComponent(q)}`;
    // Always navigate to ensure consistent behavior across pages
    window.location.href = url;
  });
})();

// Global live search suggestions on all pages (header and page search)
(function(){
  const DESKTOP_BP = 981;
  const inputs = [
    document.getElementById('navSearchInput'),
    document.getElementById('productSearch')
  ].filter(Boolean);
  if(inputs.length === 0) return;

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
  const priceFmt = (v)=> `${Number(v||0)} ج.م`;
  const debounce = (fn, ms=200)=>{ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; };

  let cache = null; // {products:[...]} with _search
  const load = async()=>{
    if(cache) return cache;
    try{
      const res = await fetch('data/products.json', {cache:'no-store'});
      const data = await res.json();
      const products = (data.products||[])
        .filter(p=> (p.status||'active')==='active')
        .map(p=> ({ ...p, _search: normalizeArabic([p.title, p.description, (p.tags||[]).join(' ')].join(' ')) }));
      cache = { products };
      return cache;
    }catch(err){ console.error('search load failed', err); cache = {products:[]}; return cache; }
  };

  const allBoxes = new Set();
  const hideOthers = (except)=>{ allBoxes.forEach(b=>{ if(b!==except){ b.style.display='none'; b.innerHTML=''; b.__open=false; b.__index=-1; } }); };
  const attach = (input)=>{
    // Build suggest box once per input
    const box = document.createElement('ul'); box.className = 'search-suggest';
    box.style.zIndex = '1200';
    let open = false, index = -1;
    allBoxes.add(box);
    const isDesktop = ()=> (window.innerWidth||document.documentElement.clientWidth) >= DESKTOP_BP;
    const position = ()=>{
      if(!isDesktop()) return; const r = input.getBoundingClientRect(); const gap=6;
      const isRTL = (document.documentElement.dir||'').toLowerCase()==='rtl' || getComputedStyle(document.documentElement).direction==='rtl';
      const style = { position:'fixed', top:(r.bottom+gap)+'px', width:r.width+'px' };
      if(isRTL){
        style.right = (window.innerWidth - r.right) + 'px';
        style.left = 'auto';
      }else{
        style.left = r.left + 'px';
        style.right = 'auto';
      }
      Object.assign(box.style, style);
    };
    const mount = ()=>{
      if(isDesktop()){
        if(document.body && box.parentNode!==document.body){ document.body.appendChild(box); }
        position();
      }else{
        if(input.parentNode && box.parentNode!==input.parentNode){
          input.parentNode.style.position = input.parentNode.style.position||'relative';
          input.parentNode.appendChild(box);
          box.style.position=''; box.style.left=''; box.style.top=''; box.style.width='';
        }
      }
    };
    const show = ()=>{ hideOthers(box); mount(); if(!open){ box.style.display='block'; open=true; } else if(isDesktop()){ position(); } };
    const hide = ()=>{ box.style.display='none'; box.innerHTML=''; open=false; index=-1; };

    const build = async(query)=>{
      const qn = normalizeArabic(query||''); if(!qn){ hide(); return; }
      const {products} = await load();
      const matches = products.filter(p=> p._search.includes(qn)).slice(0,8);
      if(matches.length===0){ hide(); return; }
      box.innerHTML='';
      matches.forEach((p,i)=>{
        const li = document.createElement('li'); li.className='search-suggest__item'; li.setAttribute('role','option'); li.setAttribute('data-index', String(i));
        li.innerHTML = `<span class="t">${p.title}</span><span class="pr">${priceFmt(p.price)}</span>`;
        li.addEventListener('mousedown', (e)=>{ e.preventDefault(); window.location.href = `product.html?id=${encodeURIComponent(p.id)}`; });
        box.appendChild(li);
      });
      show(); if(isDesktop()) position();
    };

    const onInput = debounce(()=> build(input.value), 180);
    input.addEventListener('input', onInput);
    input.addEventListener('focus', ()=>{ hideOthers(box); if(input.value) build(input.value); });
    input.addEventListener('blur', ()=>{ setTimeout(hide, 120); });
    const onScrollResize = ()=>{ if(open && isDesktop()) position(); };
    window.addEventListener('scroll', onScrollResize, {passive:true});
    window.addEventListener('resize', ()=>{ mount(); onScrollResize(); }, {passive:true});

    input.addEventListener('keydown', (e)=>{
      if(!open) return; const items = Array.from(box.querySelectorAll('.search-suggest__item')); if(items.length===0) return;
      if(e.key==='ArrowDown'){ e.preventDefault(); index=(index+1)%items.length; }
      else if(e.key==='ArrowUp'){ e.preventDefault(); index=(index-1+items.length)%items.length; }
      else if(e.key==='Enter'){ e.preventDefault(); const el=items[index>=0?index:0]; if(el){ el.dispatchEvent(new MouseEvent('mousedown')); } }
      else if(e.key==='Escape'){ hide(); return; } else { return; }
      items.forEach((li,idx)=> li.classList.toggle('is-active', idx===index));
    });
  };

  inputs.forEach(attach);
})();

// Hide-on-scroll header: hide on scroll down, show on scroll up (robust)
(function(){
  const header = document.querySelector('.topbar');
  if(!header) return;
  let lastY = window.pageYOffset || document.documentElement.scrollTop || 0;
  let headerH = header.offsetHeight || 64;
  const updateHeaderH = ()=>{ headerH = header.offsetHeight || 64; };
  window.addEventListener('resize', updateHeaderH);
  const onScroll = ()=>{
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    // keep visible when menu is open
    if(document.body.classList.contains('menu-open')){ header.classList.remove('topbar--hidden'); lastY = y; return; }
    if(y <= headerH){
      header.classList.remove('topbar--hidden');
    } else if(y > lastY){
      // scrolling down
      header.classList.add('topbar--hidden');
    } else if(y < lastY){
      // scrolling up
      header.classList.remove('topbar--hidden');
    }
    lastY = y;
  };
  // attach
  window.addEventListener('scroll', onScroll, {passive:true});
  // initial
  onScroll();
})();

// Mark active link in navbar and side menu
(function(){
  const getPage = ()=>{
    try{
      const path = (location.pathname || '').split('/').filter(Boolean);
      let file = path.length ? path[path.length-1] : '';
      if(!file) file = 'index.html';
      // handle no extension cases
      if(!/\.html?$/.test(file)) file = 'index.html';
      return file.toLowerCase();
    }catch{ return 'index.html'; }
  };
  const current = getPage();
  const mark = (root)=>{
    if(!root) return;
    const links = root.querySelectorAll('a[href]');
    links.forEach(a=>{
      const href = (a.getAttribute('href')||'').split('#')[0].toLowerCase();
      const match = href === current || (current==='index.html' && (href==='' || href==='#' || href==='index.html'));
      if(match){ a.setAttribute('aria-current','page'); }
      else{ a.removeAttribute('aria-current'); }
    });
  };
  mark(document.querySelector('.nav-center'));
  mark(document.querySelector('.side-menu__list'));
})();

// Off-canvas menu for small screens
(function(){
  const body = document.body;
  const menu = document.getElementById('sideMenu');
  const toggle = document.querySelector('.menu-toggle');
  if(!menu || !toggle) return;
  const panel = menu.querySelector('.side-menu__panel');
  const backdrop = menu.querySelector('.side-menu__backdrop');
  const closeBtn = menu.querySelector('.side-menu__close');

  const open = ()=>{
    body.classList.add('menu-open');
    toggle.setAttribute('aria-expanded','true');
    menu.setAttribute('aria-hidden','false');
    // focus within panel for accessibility
    (closeBtn || panel).focus({preventScroll:true});
  };
  const close = ()=>{
    body.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded','false');
    menu.setAttribute('aria-hidden','true');
    toggle.focus({preventScroll:true});
  };

  toggle.addEventListener('click', ()=>{
    if(body.classList.contains('menu-open')) close(); else open();
  });
  closeBtn && closeBtn.addEventListener('click', close);
  backdrop && backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') close(); });
})();

// Parallax: subtle scale and translate for hero image
(function(){
  const img = document.getElementById('heroImg');
  if(!img) return;
  let y = 0;
  const onScroll = ()=>{
    const t = window.scrollY || document.documentElement.scrollTop;
    y = Math.min(20, t/10);
    img.style.transform = `translateY(${y}px) scale(1.04)`;
  };
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
})();

// Button interactive glow following mouse
(function(){
  const btns = document.querySelectorAll('.btn--primary');
  btns.forEach(btn=>{
    btn.addEventListener('pointermove', (e)=>{
      const rect = btn.getBoundingClientRect();
      const mx = e.clientX - rect.left; // within button
      const my = e.clientY - rect.top;
      btn.style.setProperty('--mx', `${mx}px`);
      btn.style.setProperty('--my', `${my}px`);
    });
  })
})();

// Cart micro-interaction: quick wiggle when clicked
(function(){
  const cart = document.querySelector('.cart');
  if(!cart) return;
  cart.addEventListener('click', ()=>{
    const anim = cart.animate([
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(8deg)' },
      { transform: 'rotate(-6deg)' },
      { transform: 'rotate(4deg)' },
      { transform: 'rotate(0deg)' }
    ], { duration: 450, easing: 'ease-in-out' });
    // After animation, navigate to cart page
    anim.finished.then(()=>{ window.location.href = 'cart.html'; }).catch(()=>{ window.location.href = 'cart.html'; });
  });
})();

// Smooth scroll with offset for in-page anchors (e.g., "تسوّق الآن")
(function(){
  // Delegate clicks on links that point to a hash on the same page
  document.addEventListener('click', (e)=>{
    const a = e.target.closest('a[href^="#"]');
    if(!a) return;
    const href = a.getAttribute('href');
    // allow just '#' to pass
    if(!href || href === '#') return;
    const id = href.slice(1);
    const target = document.getElementById(id);
    if(!target) return;
    // same-page only
    if(a.origin !== location.origin || a.pathname.split('#')[0] !== location.pathname.split('#')[0]) return;
    e.preventDefault();
    // Calculate offset for fixed topbar
    const header = document.querySelector('.topbar');
    const headerH = header ? header.offsetHeight : 0;
    const rect = target.getBoundingClientRect();
    const absoluteTop = rect.top + window.pageYOffset - headerH - 6; // a little extra breathing space
    window.scrollTo({ top: absoluteTop, behavior: 'smooth' });
  });
})();

