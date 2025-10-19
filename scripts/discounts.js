/*
  Dynamic Discount System for Static Sites (GitHub Pages friendly)
  - Reads settings from /config.json (root)
  - Renders a top banner during active discount window with countdown and CTA
  - Provides window.Discount API for cart/checkout calculations
*/
(function () {
  // Determine site base path for GitHub Pages (supports project pages) with optional meta override
  function getSiteBase() {
    // When opening files directly (file://), use relative paths
    if (location.protocol === 'file:') {
      return '';
    }
    // Optional meta override
    const meta = document.querySelector('meta[name="site-base"]');
    if (meta && meta.content) {
      let v = meta.content.trim();
      if (!v.endsWith('/')) v += '/';
      if (!v.startsWith('/')) v = '/' + v;
      return v;
    }
    // Heuristic for GitHub Pages project sites: username.github.io/repo
    const pathParts = location.pathname.split('/').filter(Boolean);
    // Only treat as project site if there are at least two segments, e.g. /repo/page or /repo/sub/...
    // This avoids mis-detecting user sites on subpages like /cart.html
    if (location.hostname.endsWith('github.io') && pathParts.length >= 2) {
      return '/' + pathParts[0] + '/';
    }
    return '/';
  }

  // Insert banner into DOM according to configured position
  function insertBannerToDOM(banner, position) {
    const mode = String(position || 'above_header');
    if (mode === 'below_header') {
      const header = document.querySelector('header.topbar');
      if (header && header.parentElement) {
        header.insertAdjacentElement('afterend', banner);
        return;
      }
    }
    if (mode === 'fixed_top') {
      document.body.appendChild(banner);
      return;
    }
    // Default: above header
    document.body.prepend(banner);
  }

  const SITE_BASE = getSiteBase();
  const CONFIG_URL = SITE_BASE + 'config.json';
  const REFRESH_MS = 60 * 1000; // re-poll config every 1 min (lightweight)

  // Public API
  const Discount = {
    // Returns a Promise<{ active, percentage, message, theme_color, start, end, cta_text, cta_url }>
    getConfig: async function () {
      const url = `${CONFIG_URL}?ts=${Date.now()}`; // avoid cache
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load config.json');
      const cfg = await res.json();
      return normalizeConfig(cfg);
    },

    // Apply discount to a numeric amount. Returns {original, percentage, discountAmount, total}
    applyToAmount: function (amount, percentage) {
      const original = toNumber(amount);
      const pct = Math.max(0, Math.min(100, toNumber(percentage)));
      const discountAmount = round2(original * (pct / 100));
      const total = round2(original - discountAmount);
      return { original, percentage: pct, discountAmount, total };
    },

    // Render a small summary UI inside a container (Element or selector) for an original amount
    // Example: Discount.renderSummary('#summary', 200, 'جنيه')
    renderSummary: async function (container, originalAmount, currencyLabel) {
      const el = typeof container === 'string' ? document.querySelector(container) : container;
      if (!el) return;
      try {
        const cfg = await Discount.getConfig();
        const active = isActiveNow(cfg);
        const pct = active ? cfg.percentage : 0;
        const calc = Discount.applyToAmount(originalAmount, pct);
        el.innerHTML = `
          <div class="discount-summary">
            <div class="row"><span>السعر الأصلي:</span><span>${formatMoney(calc.original)} ${currencyLabel || ''}</span></div>
            <div class="row"><span>الخصم (${calc.percentage}%):</span><span>- ${formatMoney(calc.discountAmount)} ${currencyLabel || ''}</span></div>
            <div class="row total"><span>الإجمالي بعد الخصم:</span><span>${formatMoney(calc.total)} ${currencyLabel || ''} ✅</span></div>
          </div>
        `;
      } catch (e) {
        // If config fails, show only original
        const original = toNumber(originalAmount);
        el.innerHTML = `
          <div class="discount-summary">
            <div class="row"><span>الإجمالي:</span><span>${formatMoney(original)} ${currencyLabel || ''}</span></div>
          </div>
        `;
      }
    }
  };

  // Banner logic
  let bannerTimer = null;
  let pollTimer = null;
  let resizeHandler = null;
  let sideMenuObserver = null;

  async function initBanner() {
    try {
      const cfg = await Discount.getConfig();
      if (!isActiveNow(cfg)) {
        // If offer inactive, keep banner but show "انتهى العرض" instead of removing abruptly
        renderBanner({ ...cfg, percentage: 0 });
      } else {
        renderBanner(cfg);
      }
      // Light periodic re-check
      clearTimeout(pollTimer);
      pollTimer = setTimeout(initBanner, REFRESH_MS);
    } catch (e) {
      // Do not remove banner on transient failures; just retry later
      clearTimeout(pollTimer);
      pollTimer = setTimeout(initBanner, REFRESH_MS);
    }
  }

  function renderBanner(cfg) {
    let banner = document.getElementById('discount-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'discount-banner';
      banner.innerHTML = `
        <div class="db-inner">
          <div class="db-message"></div>
          <div class="db-countdown" aria-live="polite"></div>
          <a class="db-cta" target="_self"></a>
          <button class="db-close" aria-label="إغلاق">×</button>
        </div>
      `;
      // Insert by desired position
      insertBannerToDOM(banner, cfg.banner_position);

      // Close button (no persistence across refresh)
      banner.querySelector('.db-close').addEventListener('click', () => {
        banner.classList.remove('show');
        banner.classList.add('hide');
        setTimeout(removeBanner, 300);
      });
    }

    // Always show on refresh (no session persistence)

    banner.style.setProperty('--db-color', cfg.theme_color || '#4CAF50');
    // Support line breaks in config message ("\n")
    const msgEl = banner.querySelector('.db-message');
    const safeMsg = String(cfg.message||'');
    msgEl.innerHTML = safeMsg.replace(/\n/g, '<br>');
    const cta = banner.querySelector('.db-cta');
    cta.textContent = cfg.cta_text || 'تسوق الآن';
    cta.href = cfg.cta_url || '/';

    // Toggle fixed mode class
    const isFixed = cfg.banner_position === 'fixed_top';
    banner.classList.toggle('fixed', isFixed);

    // Start countdown
    startCountdown(banner.querySelector('.db-countdown'), cfg.end);

    // Apply body padding for fixed mode to avoid overlap
    if (isFixed) {
      requestAnimationFrame(() => {
        const h = banner.offsetHeight || 0;
        document.body.classList.add('db-has-fixed');
        document.body.style.setProperty('--db-banner-h', h + 'px');
      });
    } else {
      document.body.classList.remove('db-has-fixed');
      document.body.style.removeProperty('--db-banner-h');
    }

    // Below header mode: offset banner by header height so it doesn't overlap navbar
    const wantBelow = cfg.banner_position === 'below_header';
    const header = document.querySelector('header.topbar');
    function setBelowOffset() {
      if (!wantBelow || !header) return;
      const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      // Only attempt offset on larger screens; on small screens keep normal flow to avoid gaps
      if (vw <= 969) {
        banner.style.top = '';
        banner.style.position = '';
        return;
      }
      const pos = (getComputedStyle(header).position || '').toLowerCase();
      if (pos === 'fixed' || pos === 'sticky') {
        const h = header.offsetHeight || 0;
        banner.style.position = 'sticky';
        banner.style.top = h + 'px';
      } else {
        // Normal flow under header
        banner.style.top = '';
        banner.style.position = '';
      }
    }
    if (wantBelow && header) {
      setBelowOffset();
      if (!resizeHandler) {
        resizeHandler = () => setBelowOffset();
        window.addEventListener('resize', resizeHandler);
      }
    } else {
      // Clean styles and listener if previously set
      banner.style.top = '';
      banner.style.position = '';
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
      }
    }

    // Hide banner when side menu (mobile nav) is open
    const sideMenu = document.getElementById('sideMenu');
    if (sideMenu && !sideMenuObserver) {
      try {
        sideMenuObserver = new MutationObserver(() => {
          const hiddenAttr = sideMenu.getAttribute('aria-hidden');
          const isOpen = hiddenAttr === 'false' || hiddenAttr === false;
          if (isOpen) {
            banner.style.display = 'none';
            // also remove any fixed padding to avoid layout jumps
            document.body.classList.remove('db-has-fixed');
            document.body.style.removeProperty('--db-banner-h');
          } else {
            banner.style.display = '';
            // re-apply fixed padding if needed
            if (isFixed) {
              const h = banner.offsetHeight || 0;
              document.body.classList.add('db-has-fixed');
              document.body.style.setProperty('--db-banner-h', h + 'px');
            }
            // ensure below_header offset recalculates after menu closes
            setTimeout(setBelowOffset, 50);
          }
        });
        sideMenuObserver.observe(sideMenu, { attributes: true, attributeFilter: ['aria-hidden'] });
      } catch {}
    }

    // Animate in
    requestAnimationFrame(() => {
      banner.classList.add('show');
    });
  }

  function removeBanner() {
    const banner = document.getElementById('discount-banner');
    if (!banner) return;
    clearInterval(bannerTimer);
    bannerTimer = null;
    banner.parentElement && banner.parentElement.removeChild(banner);
    // Clean fixed padding if any
    document.body.classList.remove('db-has-fixed');
    document.body.style.removeProperty('--db-banner-h');
  }

  function startCountdown(container, endDate) {
    clearInterval(bannerTimer);
    function update() {
      const now = new Date();
      const dist = endDate - now;
      if (dist <= 0) {
        container.textContent = 'انتهى العرض';
        // Keep banner visible; just stop the timer.
        clearInterval(bannerTimer);
        return;
      }
      const d = Math.floor(dist / (1000 * 60 * 60 * 24));
      const h = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((dist % (1000 * 60)) / 1000);
      container.textContent = `${d} يوم و  ${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    update();
    bannerTimer = setInterval(update, 1000);
  }

  // Helpers
  function normalizeConfig(raw) {
    // Support the exact keys requested by the user
    const active = !!raw.discount_active;
    const percentage = toNumber(raw.discount_percentage);
    const message = String(raw.discount_message || '').trim();
    const theme_color = String(raw.theme_color || '#4CAF50');
    const cta_text = String(raw.cta_text || 'تسوق الآن');
    const cta_url = String(raw.cta_url || '/');
    const banner_position = String(raw.banner_position || 'above_header');
    const discount_label = String(raw.discount_label || '').trim();

    // Date parsing with timezone support
    const start = parseDate(raw.start_date);
    const end = parseDate(raw.end_date);

    return { active, percentage, message, theme_color, start, end, cta_text, cta_url, banner_position, discount_label };
  }

  function parseDate(v) {
    // Accept ISO strings like 2025-10-01T00:00:00+03:00
    // Fallback to local parsing if needed
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function isActiveNow(cfg) {
    if (!cfg || !cfg.active) return false;
    const now = new Date();
    if (cfg.start && now < cfg.start) return false;
    if (cfg.end && now > cfg.end) return false;
    if (!isFinite(cfg.percentage) || cfg.percentage <= 0) return false;
    return true;
  }

  function toNumber(x) {
    const n = Number(x);
    return isFinite(n) ? n : 0;
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function formatMoney(n) {
    try {
      return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(n);
    } catch (e) {
      return n.toFixed(2);
    }
  }

  // Expose API globally for cart/checkout usage
  window.Discount = Discount;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBanner);
  } else {
    initBanner();
  }
})(); 
