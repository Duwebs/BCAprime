// ============================================================
// BCAPrime — api/resource.js
// Dynamic Open Graph & Meta Tags handler for /resource/:id
// Returns HTML with dynamic OG tags (WhatsApp/Twitter/FB previews)
// and redirects real browser users seamlessly to the resource.
// ============================================================
'use strict';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://kjesjaakjddfxykisssh.supabase.co').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ZZ-StuiDnSwyJ9xNRjbY7A_eoyZF7Fl';

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

module.exports = async function handler(req, res) {
  const queryId = (req.query && req.query.id ? String(req.query.id) : '').trim();

  // If no ID provided, redirect to home
  if (!queryId) {
    res.writeHead(302, { Location: '/' });
    res.end();
    return;
  }

  const headers = req.headers || {};
  const proto = headers['x-forwarded-proto'] || 'https';
  const host = headers['x-forwarded-host'] || headers.host || 'bcaprime.vercel.app';
  const origin = `${proto}://${host}`;

  let resource = null;

  // 1. Try fetching from Supabase by numeric ID or title slug
  try {
    const isNumeric = /^\d+$/.test(queryId);
    let endpoint = `${SUPABASE_URL}/rest/v1/resources?`;
    if (isNumeric) {
      endpoint += `id=eq.${queryId}&select=id,title,type,subject,semester,college,file_name,downloads,upvotes&limit=1`;
    } else {
      const clean = queryId.replace(/[-_]/g, ' ');
      endpoint += `title=ilike.*${encodeURIComponent(clean)}*&select=id,title,type,subject,semester,college,file_name,downloads,upvotes&limit=1`;
    }

    const sbRes = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    if (sbRes.ok) {
      const rows = await sbRes.json();
      if (Array.isArray(rows) && rows.length > 0) {
        resource = rows[0];
      }
    }
  } catch (err) {
    console.warn('[BCAPrime] Failed to query Supabase for resource:', err.message);
  }

  // 2. Prepare metadata (use DB data if found, otherwise clean fallback from queryId)
  const resourceId = resource ? resource.id : queryId;
  const rawTitle = resource ? resource.title : (decodeURIComponent(queryId).replace(/[-_]/g, ' ') || 'BCA Study Material');
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  const subject = (resource && resource.subject) ? resource.subject : 'Computer Applications';
  const semNum = (resource && resource.semester != null) ? String(resource.semester) : '';
  const semText = semNum ? `Semester ${semNum}` : 'All Semesters';
  const rawType = (resource && resource.type ? resource.type : 'notes').toLowerCase();
  const typeBadge = rawType === 'pyq' ? 'PYQ' : 'Notes';
  const typeText = rawType === 'pyq' ? 'Previous Year Question Paper (PYQ)' : 'Study Notes';
  const college = (resource && resource.college && resource.college !== 'all') ? resource.college.toUpperCase() : 'All Colleges';

  const directPageUrl = `${origin}/resource/${encodeURIComponent(resourceId)}`;
  const homeTargetUrl = `/?resource=${encodeURIComponent(resourceId)}`;

  // Construct dynamic OG Image URL (calling /api/og with query params for instant CDN render)
  const ogParams = new URLSearchParams({
    id: String(resourceId),
    title: title,
    subject: subject,
    sem: semNum,
    type: rawType,
    college: (resource && resource.college) || 'all'
  });
  const ogImageUrl = `${origin}/api/og?${ogParams.toString()}`;

  const description = `Access & download ${title} (${subject}, ${semText}) [${typeBadge}] on BCAPrime — free BCA notes, PYQs, and syllabus library.`;

  // 3. Render HTML with full Open Graph, Twitter cards, and auto-redirect
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} | BCAPrime</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <link rel="canonical" href="${directPageUrl}">

  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="BCAPrime">
  <meta property="og:url" content="${directPageUrl}">
  <meta property="og:title" content="${escapeHtml(title)} | BCAPrime">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:secure_url" content="${ogImageUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(title)} — BCAPrime">
  <!-- Fallback preview image -->
  <meta property="og:image" content="${origin}/assets/logo.png">

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@bcaprime">
  <meta name="twitter:url" content="${directPageUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)} | BCAPrime">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${ogImageUrl}">

  <link rel="icon" href="${origin}/assets/logo.png">
  <meta name="theme-color" content="#05080b">

  <!-- Instant Client-Side Redirect for browser users -->
  <script>
    (function(){
      try {
        window.location.replace('${homeTargetUrl}');
      } catch(e) {
        window.location.href = '${homeTargetUrl}';
      }
    })();
  </script>
  <meta http-equiv="refresh" content="0; url=${homeTargetUrl}">

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #05080b;
      color: #ededed;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Geist", sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .preview-card {
      width: min(100%, 520px);
      background: #0e1520;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      padding: 32px 28px;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .logo-mark {
      width: 54px;
      height: 54px;
      border-radius: 14px;
      background: linear-gradient(135deg, #0070f3 0%, #0051b3 100%);
      display: grid;
      place-items: center;
      box-shadow: 0 8px 24px rgba(0, 112, 243, 0.35);
    }
    .brand-name {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .brand-name span { color: #3291ff; }
    .badge-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .badge {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 6px;
      background: rgba(0, 112, 243, 0.18);
      color: #60a5fa;
      border: 1px solid rgba(0, 112, 243, 0.35);
    }
    .badge.pyq {
      background: rgba(139, 92, 246, 0.18);
      color: #c4b5fd;
      border-color: rgba(139, 92, 246, 0.35);
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      line-height: 1.3;
      color: #ffffff;
      margin-top: 4px;
    }
    .meta {
      font-size: 13.5px;
      color: #94a3b8;
      line-height: 1.5;
    }
    .cta-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 8px;
      width: 100%;
      height: 48px;
      border-radius: 12px;
      background: #0070f3;
      color: #ffffff;
      font-weight: 600;
      font-size: 15px;
      text-decoration: none;
      transition: background 0.2s ease, transform 0.1s ease;
    }
    .cta-btn:hover { background: #0060df; transform: translateY(-1px); }
    .redirect-note {
      font-size: 11.5px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="preview-card">
    <div class="logo-mark">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z" fill="#f59e0b"/>
        <text x="12" y="20" font-family="Arial,sans-serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle">B</text>
      </svg>
    </div>
    <div class="brand-name">BCA<span>Prime</span></div>
    
    <div class="badge-row">
      <span class="badge ${rawType === 'pyq' ? 'pyq' : ''}">${escapeHtml(typeBadge)}</span>
      <span class="badge">${escapeHtml(semText)}</span>
    </div>

    <h1 class="title">${escapeHtml(title)}</h1>
    <p class="meta">${escapeHtml(subject)} &bull; ${escapeHtml(college)}</p>

    <a href="${homeTargetUrl}" class="cta-btn">
      Open in BCAPrime &rarr;
    </a>
    <span class="redirect-note">Redirecting to your study desk&hellip;</span>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
  res.status(200).send(html);
};
