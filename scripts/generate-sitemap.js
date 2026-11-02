#!/usr/bin/env node
/* ============================================================
   BCAPrime — scripts/generate-sitemap.js
   Automated Sitemap.xml Generator for BCAPrime

   Builds a standards-compliant XML sitemap covering all core
   pages, filters, views, and approved Supabase resources.
   Includes timeout & offline fallback so builds never fail.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://bcaprime.vercel.app';
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kjesjaakjddfxykisssh.supabase.co').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ZZ-StuiDnSwyJ9xNRjbY7A_eoyZF7Fl';

function escapeXml(unsafe) {
  return String(unsafe || '').replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function formatDate(d) {
  try {
    const date = d ? new Date(d) : new Date();
    if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
    return date.toISOString().split('T')[0];
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
}

async function fetchApprovedResources() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const endpoint = `${SUPABASE_URL}/rest/v1/resources?select=id,title,type,subject,semester,college,created_at,updated_at&status=eq.approved&order=id.desc&limit=1000`;
    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    clearTimeout(timeoutId);
    if (!res.ok) {
      console.warn(`[BCAPrime Sitemap] Supabase returned status ${res.status}. Falling back to core routes.`);
      return [];
    }

    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[BCAPrime Sitemap] Supabase fetch omitted (${err.message || 'offline/timeout'}). Generating with core static routes.`);
    return [];
  }
}

async function generate() {
  const today = formatDate();

  // 1. Core static routes & application hubs
  const staticEntries = [
    { loc: `${BASE_URL}/`, changefreq: 'daily', priority: '1.0', lastmod: today },
    { loc: `${BASE_URL}/?type=notes`, changefreq: 'daily', priority: '0.9', lastmod: today },
    { loc: `${BASE_URL}/?type=pyq`, changefreq: 'daily', priority: '0.9', lastmod: today },
    { loc: `${BASE_URL}/#mocktests`, changefreq: 'weekly', priority: '0.8', lastmod: today },
    { loc: `${BASE_URL}/?sem=1`, changefreq: 'weekly', priority: '0.8', lastmod: today },
    { loc: `${BASE_URL}/?sem=2`, changefreq: 'weekly', priority: '0.8', lastmod: today },
    { loc: `${BASE_URL}/?sem=3`, changefreq: 'weekly', priority: '0.8', lastmod: today },
    { loc: `${BASE_URL}/?sem=4`, changefreq: 'weekly', priority: '0.8', lastmod: today },
    { loc: `${BASE_URL}/?sem=5`, changefreq: 'weekly', priority: '0.8', lastmod: today },
    { loc: `${BASE_URL}/?sem=6`, changefreq: 'weekly', priority: '0.8', lastmod: today },
    { loc: `${BASE_URL}/#ask-seniors`, changefreq: 'daily', priority: '0.7', lastmod: today },
    { loc: `${BASE_URL}/#juniors-request`, changefreq: 'daily', priority: '0.7', lastmod: today },
    { loc: `${BASE_URL}/#lostfound`, changefreq: 'daily', priority: '0.7', lastmod: today },
    { loc: `${BASE_URL}/privacy.html`, changefreq: 'monthly', priority: '0.4', lastmod: '2026-10-22' },
    { loc: `${BASE_URL}/terms.html`, changefreq: 'monthly', priority: '0.4', lastmod: '2026-10-22' }
  ];

  // 2. Fetch approved study resources
  const dynamicResources = await fetchApprovedResources();
  const resourceEntries = dynamicResources
    .filter(r => r && r.id)
    .map(r => ({
      loc: `${BASE_URL}/resource/${encodeURIComponent(r.id)}`,
      changefreq: 'weekly',
      priority: '0.7',
      lastmod: formatDate(r.updated_at || r.created_at)
    }));

  const allEntries = [...staticEntries, ...resourceEntries];

  // 3. Build XML
  const xmlLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9',
    '        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">'
  ];

  for (const entry of allEntries) {
    xmlLines.push('  <url>');
    xmlLines.push(`    <loc>${escapeXml(entry.loc)}</loc>`);
    if (entry.lastmod) xmlLines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
    if (entry.changefreq) xmlLines.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
    if (entry.priority) xmlLines.push(`    <priority>${escapeXml(entry.priority)}</priority>`);
    xmlLines.push('  </url>');
  }

  xmlLines.push('</urlset>');
  xmlLines.push('');

  const xmlContent = xmlLines.join('\n');
  const targetPath = path.join(__dirname, '..', 'sitemap.xml');
  fs.writeFileSync(targetPath, xmlContent, 'utf8');

  console.info(`[BCAPrime] sitemap.xml generated successfully at root with ${allEntries.length} URLs (${staticEntries.length} core, ${resourceEntries.length} resources).`);
}

generate().catch(err => {
  console.error('[BCAPrime] Error generating sitemap.xml:', err);
  process.exit(1);
});

