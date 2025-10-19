#!/usr/bin/env node
/*
  Generate sitemap.xml and ensure robots.txt contains Sitemap line
  - Reads data/products.json
  - Outputs sitemap.xml at project root
  - Ensures robots.txt exists with Allow and correct Sitemap URL
*/
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

(async () => {
  try {
    const projectRoot = process.cwd();
    const baseUrl = 'https://qarsatnahlah.github.io';

    // Load products.json
    const dataPath = path.join(projectRoot, 'data', 'products.json');
    const raw = await fsp.readFile(dataPath, 'utf8');
    const data = JSON.parse(raw);
    const products = Array.isArray(data.products) ? data.products : [];

    // Collect active product URLs
    const productUrls = products
      .filter(p => (p && (p.status || 'active') === 'active' && p.id))
      .map(p => `${baseUrl}/product.html?id=${encodeURIComponent(String(p.id))}`);

    // Static pages
    const staticPaths = [
      '/',
      '/honey.html',
      '/herbs.html',
      '/oils.html',
      '/mixes.html',
      '/contact.html',
      '/cart.html'
    ];
    const staticUrls = staticPaths.map(p => `${baseUrl}${p}`);

    // Build sitemap XML
    const urls = [...new Set([...staticUrls, ...productUrls])];
    const now = new Date().toISOString();
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
urls.map(u => `  <url>\n    <loc>${u}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`).join('\n') +
`\n</urlset>\n`;

    const sitemapPath = path.join(projectRoot, 'sitemap.xml');
    await fsp.writeFile(sitemapPath, xml, 'utf8');
    console.log(`Wrote ${sitemapPath} with ${urls.length} URLs`);

    // Ensure robots.txt
    const robotsPath = path.join(projectRoot, 'robots.txt');
    let robots = '';
    try { robots = await fsp.readFile(robotsPath, 'utf8'); } catch { robots = ''; }

    const lines = robots.split(/\r?\n/).filter(Boolean);
    const hasUserAgent = lines.some(l => /^\s*User-agent:/i.test(l));
    const hasAllow = lines.some(l => /^\s*Allow:\s*\/\s*$/i.test(l));
    const sitemapLine = `Sitemap: ${baseUrl}/sitemap.xml`;
    const hasSitemap = lines.some(l => /^\s*Sitemap:/i.test(l));

    let out = lines.slice();
    if (!hasUserAgent) out.unshift('User-agent: *');
    if (!hasAllow) out.push('Allow: /');
    if (!hasSitemap) out.push(sitemapLine); else {
      // Replace any existing Sitemap lines with the correct one
      out = out.map(l => /^\s*Sitemap:/i.test(l) ? sitemapLine : l);
    }

    // Deduplicate consecutive empties and ensure newline at end
    const normalized = out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    await fsp.writeFile(robotsPath, normalized, 'utf8');
    console.log(`Ensured ${robotsPath}`);

  } catch (err) {
    console.error('Failed to generate sitemap/robots:', err);
    process.exit(1);
  }
})();
