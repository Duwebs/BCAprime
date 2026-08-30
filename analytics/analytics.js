/* ============================================================
   BCAPrime Analytics Suite — analytics.js
   Standalone analytics dashboard with admin-only access
   ============================================================ */
console.info('[BCAPrime Analytics] v1 loaded');

/* ---- Supabase Client ---- */
const $ = id => document.getElementById(id);
let session = null;
let currentRange = 1; // days (1 = today)
let refreshTimer = null;
let livePollTimer = null;
let charts = {};

/* ---- Chart.js defaults ---- */
if (typeof Chart !== 'undefined') {
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.borderColor = 'rgba(148, 163, 184, .1)';
  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.animation.duration = 800;
  Chart.defaults.animation.easing = 'easeOutQuart';
}

/* ============================================================
   AUTH GATE
   ============================================================ */
$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('authMsg');
  msg.textContent = 'Authenticating…';
  msg.style.color = '';

  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;

  if (!supabaseClient) { msg.textContent = 'Supabase is not configured.'; return; }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) { msg.textContent = error.message; return; }

  const role = data.session?.user?.app_metadata?.role;
  if (role !== 'admin') {
    await supabaseClient.auth.signOut();
    msg.textContent = 'Access denied: This account is not an administrator.';
    return;
  }

  session = data.session;
  showDashboard();
});

async function signOut() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  session = null;
  $('authGate').style.display = '';
  $('dashboard').hidden = true;
  stopPolling();
}

/* Check existing session on load */
(async () => {
  if (!supabaseClient) {
    $('authMsg').textContent = 'Supabase is not configured.';
    return;
  }
  const { data } = await supabaseClient.auth.getSession();
  if (data.session && data.session.user?.app_metadata?.role === 'admin') {
    session = data.session;
    showDashboard();
  }
})();

function showDashboard() {
  $('authGate').style.display = 'none';
  $('dashboard').hidden = false;
  refreshAll();
  startPolling();
}

/* ============================================================
   SIDEBAR NAVIGATION
   ============================================================ */
function switchSection(section) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const el = $('section-' + section);
  const nav = document.querySelector(`.nav-item[data-section="${section}"]`);
  if (el) el.classList.add('active');
  if (nav) nav.classList.add('active');

  /* Lazy-load section data */
  if (section === 'live') loadLiveFeed();
  if (section === 'content') loadContentMatrix();
  if (section === 'search') loadSearchIntel();
  if (section === 'funnel') loadFunnel();
  if (section === 'system') loadSystemHealth();

  /* Close mobile sidebar */
  $('sidebar').classList.remove('open');
}

/* Mobile hamburger */
$('hamburgerBtn')?.addEventListener('click', () => $('sidebar').classList.add('open'));
$('sidebarClose')?.addEventListener('click', () => $('sidebar').classList.remove('open'));

/* ============================================================
   DATE RANGE
   ============================================================ */
function setRange(days) {
  currentRange = days;
  document.querySelectorAll('.date-btn').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.range) === days);
  });
  refreshAll();
}

function getDateRange() {
  if (currentRange === 0) return { start: null, end: null };
  const end = new Date();
  const start = new Date(Date.now() - currentRange * 86400000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/* ============================================================
   REFRESH ALL
   ============================================================ */
async function refreshAll() {
  const btn = $('refreshBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

  try {
    await Promise.all([
      loadOverview(),
      loadActiveUsers()
    ]);
    $('lastRefresh').textContent = new Date().toLocaleTimeString();
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Refresh'; }
  }
}

/* ============================================================
   POLLING (auto-refresh every 30s)
   ============================================================ */
function startPolling() {
  stopPolling();
  refreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible') refreshAll();
  }, 30000);
  livePollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') loadActiveUsers();
  }, 15000);
}

function stopPolling() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  if (livePollTimer) { clearInterval(livePollTimer); livePollTimer = null; }
}

/* ============================================================
   A. OVERVIEW — KPI Cards + Charts
   ============================================================ */
async function loadOverview() {
  const { start, end } = getDateRange();

  try {
    // Use RPC for optimized aggregation
    const { data: summary, error: sumErr } = await supabaseClient.rpc('get_analytics_summary', {
      p_start: start,
      p_end: end
    });

    if (sumErr) {
      // Fallback: direct query
      await loadOverviewFallback();
      return;
    }

    if (summary) {
      $('kpiVisitors').textContent = fmtNum(summary.total_visitors || 0);
      $('kpiViews').textContent = fmtNum(summary.views || 0);
      $('kpiDownloads').textContent = fmtNum(summary.downloads || 0);
      $('kpiSignedUp').textContent = fmtNum(summary.signed_up || 0);
      $('kpiSearches').textContent = fmtNum(summary.searches || 0);
      $('kpiAvgTime').textContent = fmtDuration(summary.avg_duration || 0);
      $('kpiUploads').textContent = fmtNum(summary.uploads || 0);
      $('kpiGuests').textContent = fmtNum(summary.guests || 0);

      renderDeviceChips(summary.devices || [], summary.browsers || [], summary.os || []);
      renderEventDistChart(summary);
    }

    // Load trend chart
    const { data: trend } = await supabaseClient.rpc('get_daily_trend', { p_days: currentRange || 30 });
    if (trend) renderTrendChart(trend);

    // Load top resources
    const { data: topRes } = await supabaseClient.rpc('get_top_resources', { p_limit: 10 });
    if (topRes) renderTopResources(topRes);

  } catch (err) {
    console.error('[Analytics] Overview error:', err);
    await loadOverviewFallback();
  }
}

/* Fallback: query events directly when RPC not deployed */
async function loadOverviewFallback() {
  let query = supabaseClient.from('analytics_events').select('*').order('created_at', { ascending: false }).limit(5000);
  if (currentRange > 0) query = query.gte('created_at', new Date(Date.now() - currentRange * 86400000).toISOString());
  const { data: events } = await query;
  if (!events || !events.length) {
    ['kpiVisitors','kpiViews','kpiDownloads','kpiSignedUp','kpiSearches','kpiUploads','kpiGuests'].forEach(id => { $(id).textContent = '0'; });
    $('kpiAvgTime').textContent = '0s';
    return;
  }

  const visitors = new Set(), signedUp = new Set(), guests = new Set();
  let downloads = 0, views = 0, uploads = 0, searches = 0, durSum = 0, durCount = 0;
  const deviceMap = {}, browserMap = {}, osMap = {}, resourceMap = {};

  events.forEach(ev => {
    visitors.add(ev.visitor_id);
    if (ev.user_email) signedUp.add(ev.user_email);
    else guests.add(ev.visitor_id);
    if (ev.event_type === 'download') downloads++;
    if (ev.event_type === 'view') views++;
    if (ev.event_type === 'upload') uploads++;
    if (ev.event_type === 'search') searches++;
    if ((ev.event_type === 'session_end' || ev.event_type === 'session_heartbeat') && ev.duration_seconds > 0) {
      durSum += ev.duration_seconds;
      durCount++;
    }
    if (ev.device) deviceMap[ev.device] = (deviceMap[ev.device] || 0) + 1;
    if (ev.browser) browserMap[ev.browser] = (browserMap[ev.browser] || 0) + 1;
    if (ev.os) osMap[ev.os] = (osMap[ev.os] || 0) + 1;
    if ((ev.event_type === 'view' || ev.event_type === 'download') && ev.resource_title) {
      const r = resourceMap[ev.resource_title] || (resourceMap[ev.resource_title] = { views: 0, downloads: 0, type: ev.resource_type || '' });
      if (ev.event_type === 'view') r.views++; else r.downloads++;
    }
  });

  $('kpiVisitors').textContent = fmtNum(visitors.size);
  $('kpiViews').textContent = fmtNum(views);
  $('kpiDownloads').textContent = fmtNum(downloads);
  $('kpiSignedUp').textContent = fmtNum(signedUp.size);
  $('kpiSearches').textContent = fmtNum(searches);
  $('kpiAvgTime').textContent = fmtDuration(durCount ? durSum / durCount : 0);
  $('kpiUploads').textContent = fmtNum(uploads);
  $('kpiGuests').textContent = fmtNum(guests.size);

  const devices = Object.entries(deviceMap).map(([d, c]) => ({ device: d, cnt: c }));
  const browsers = Object.entries(browserMap).map(([b, c]) => ({ browser: b, cnt: c }));
  const osList = Object.entries(osMap).map(([o, c]) => ({ os: o, cnt: c }));
  renderDeviceChips(devices, browsers, osList);

  const topRes = Object.entries(resourceMap)
    .map(([title, r]) => ({ title, type: r.type, reads: r.views, downloads: r.downloads, download_rate: r.views > 0 ? ((r.downloads / (r.views + r.downloads)) * 100).toFixed(1) : 0 }))
    .sort((a, b) => (b.downloads * 2 + b.reads) - (a.downloads * 2 + a.reads))
    .slice(0, 10);
  renderTopResources(topRes);

  // Build fallback trend data
  const days = currentRange || 30;
  const dayData = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const dayEvs = events.filter(e => String(e.created_at).slice(0, 10) === key);
    dayData.push({
      date: key,
      visits: dayEvs.filter(e => e.event_type === 'visit').length,
      views: dayEvs.filter(e => e.event_type === 'view').length,
      downloads: dayEvs.filter(e => e.event_type === 'download').length,
      searches: dayEvs.filter(e => e.event_type === 'search').length
    });
  }
  renderTrendChart(dayData);
}

/* ============================================================
   B. LIVE FEED
   ============================================================ */
async function loadActiveUsers() {
  try {
    const { data } = await supabaseClient.rpc('get_active_users', { p_minutes: 5 });
    if (data) {
      $('activeUserCount').textContent = data.active_count || 0;
      $('navLiveBadge').textContent = data.active_count || 0;
      $('liveBigCount').textContent = data.active_count || 0;
    }
  } catch (err) {
    // Fallback
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    const { count } = await supabaseClient.from('analytics_events')
      .select('visitor_id', { count: 'exact', head: true })
      .gte('created_at', fiveMinAgo);
    const c = count || 0;
    $('activeUserCount').textContent = c;
    $('navLiveBadge').textContent = c;
    $('liveBigCount').textContent = c;
  }
}

async function loadLiveFeed() {
  const stream = $('liveStream');
  if (!stream) return;

  try {
    const { data: feed } = await supabaseClient.rpc('get_live_feed', { p_limit: 40 });
    if (feed && feed.length) {
      stream.innerHTML = feed.map(renderLiveEvent).join('');
    } else {
      stream.innerHTML = '<div class="empty-state"><i class="fa-solid fa-satellite-dish"></i><br>No activity in the last 24 hours</div>';
    }
  } catch (err) {
    // Fallback: direct query
    const twentyFourHrsAgo = new Date(Date.now() - 86400000).toISOString();
    const { data } = await supabaseClient.from('analytics_events')
      .select('*')
      .gte('created_at', twentyFourHrsAgo)
      .order('created_at', { ascending: false })
      .limit(40);

    if (data && data.length) {
      stream.innerHTML = data.map(renderLiveEvent).join('');
    } else {
      stream.innerHTML = '<div class="empty-state"><i class="fa-solid fa-satellite-dish"></i><br>No activity in the last 24 hours</div>';
    }
  }
}

const EVENT_ICONS = {
  visit: 'fa-solid fa-globe',
  view: 'fa-solid fa-book-open',
  download: 'fa-solid fa-download',
  upload: 'fa-solid fa-cloud-arrow-up',
  save: 'fa-solid fa-bookmark',
  search: 'fa-solid fa-magnifying-glass',
  session_end: 'fa-solid fa-clock',
  session_heartbeat: 'fa-solid fa-heart-pulse'
};

function renderLiveEvent(ev) {
  const icon = EVENT_ICONS[ev.event_type] || 'fa-solid fa-circle';
  const what = ev.resource_title ? `<b>${esc(ev.resource_title)}</b>` : '';
  const who = ev.user_name || ev.user_email || 'Guest';
  const extra = ev.duration_seconds ? ` (${fmtDuration(ev.duration_seconds)})` : '';
  const semText = ev.semester ? ` · Sem ${ev.semester}` : '';
  const time = timeAgo(ev.created_at);

  return `<div class="live-event">
    <div class="live-event-icon"><i class="${icon}"></i></div>
    <div class="live-event-body">
      <div class="live-event-text">${esc(who)} ${ev.event_type === 'view' ? 'opened' : ev.event_type === 'download' ? 'downloaded' : ev.event_type === 'search' ? 'searched' : ev.event_type} ${what}${extra}</div>
      <div class="live-event-meta">${esc(ev.subject || '')}${semText} · ${esc(ev.device || '')}</div>
    </div>
    <span class="live-event-time">${time}</span>
  </div>`;
}

/* ============================================================
   C. CONTENT PERFORMANCE MATRIX
   ============================================================ */
let allContentData = [];

async function loadContentMatrix() {
  try {
    const { data } = await supabaseClient.rpc('get_top_resources', { p_limit: 50 });
    allContentData = data || [];
  } catch (err) {
    // Fallback
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: events } = await supabaseClient.from('analytics_events')
      .select('resource_title, resource_type, subject, semester, event_type')
      .gte('created_at', thirtyDaysAgo)
      .in('event_type', ['view', 'download'])
      .not('resource_title', 'eq', '');

    const map = {};
    (events || []).forEach(ev => {
      const r = map[ev.resource_title] || (map[ev.resource_title] = {
        title: ev.resource_title, type: ev.resource_type, subject: ev.subject, semester: ev.semester, reads: 0, downloads: 0
      });
      if (ev.event_type === 'view') r.reads++;
      else r.downloads++;
    });
    allContentData = Object.values(map).map(r => ({
      ...r,
      download_rate: (r.reads + r.downloads) > 0 ? ((r.downloads / (r.reads + r.downloads)) * 100).toFixed(1) : 0
    }));
  }

  renderContentMatrix();
  loadContentTrendChart();
}

function renderContentMatrix() {
  const sort = $('contentSort')?.value || 'score';
  let sorted = [...allContentData];

  if (sort === 'reads') sorted.sort((a, b) => b.reads - a.reads);
  else if (sort === 'downloads') sorted.sort((a, b) => b.downloads - a.downloads);
  else if (sort === 'rate') sorted.sort((a, b) => Number(b.download_rate) - Number(a.download_rate));
  else sorted.sort((a, b) => (b.downloads * 2 + b.reads) - (a.downloads * 2 + a.reads));

  const tbody = $('contentMatrixBody');
  if (!tbody) return;

  tbody.innerHTML = sorted.length ? sorted.map(r =>
    `<tr>
      <td><b>${esc(r.title)}</b><small>${esc(r.type || '')}</small></td>
      <td>${esc(r.type || '—')}</td>
      <td>${esc(r.subject || '—')}</td>
      <td>${r.semester || '—'}</td>
      <td><b>${r.reads}</b></td>
      <td><b>${r.downloads}</b></td>
      <td><b>${r.download_rate}%</b></td>
    </tr>`
  ).join('') : '<tr><td colspan="7" class="empty-state">No content data yet</td></tr>';
}

function sortContentTable() { renderContentMatrix(); }

function sortBy(field) {
  const sel = $('contentSort');
  if (!sel) return;
  if (field === 'reads') sel.value = 'reads';
  else if (field === 'downloads') sel.value = 'downloads';
  else if (field === 'rate') sel.value = 'rate';
  else sel.value = 'score';
  renderContentMatrix();
}

async function loadContentTrendChart() {
  try {
    const { data: trend } = await supabaseClient.rpc('get_daily_trend', { p_days: currentRange || 30 });
    if (trend) renderContentTrendChart(trend);
  } catch (err) {
    console.warn('Content trend fallback needed');
  }
}

function renderContentTrendChart(data) {
  const ctx = $('contentTrendChart');
  if (!ctx) return;
  if (charts.contentTrend) charts.contentTrend.destroy();

  charts.contentTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => {
        const dt = new Date(d.date);
        return dt.getDate() + '/' + (dt.getMonth() + 1);
      }),
      datasets: [
        {
          label: 'Views',
          data: data.map(d => d.views || 0),
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, .1)',
          fill: true,
          tension: .4,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5
        },
        {
          label: 'Downloads',
          data: data.map(d => d.downloads || 0),
          borderColor: '#34d399',
          backgroundColor: 'rgba(52, 211, 153, .1)',
          fill: true,
          tension: .4,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 16 } } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: 'rgba(148, 163, 184, .06)' } }
      },
      interaction: { mode: 'index', intersect: false }
    }
  });
}

/* ============================================================
   D. SEARCH INTELLIGENCE
   ============================================================ */
let allSearchData = [];

async function loadSearchIntel() {
  try {
    const { data } = await supabaseClient.rpc('get_search_trends', { p_limit: 60 });
    allSearchData = data || [];
  } catch (err) {
    // Fallback
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: events } = await supabaseClient.from('analytics_events')
      .select('resource_title, results_count, created_at, visitor_id')
      .eq('event_type', 'search')
      .gte('created_at', thirtyDaysAgo)
      .not('resource_title', 'eq', '');

    const map = {};
    (events || []).forEach(ev => {
      const q = ev.resource_title;
      const m = map[q] || (map[q] = { query: q, total_count: 0, zero_result_count: 0, result_count: 0, last_searched: ev.created_at });
      m.total_count++;
      if (ev.results_count === 0 || ev.results_count == null) m.zero_result_count++;
      else m.result_count++;
    });
    allSearchData = Object.values(map).map(m => ({ ...m, is_failing: m.zero_result_count > 0 }));
  }

  renderSearchTable();
  renderSearchCloud();
  renderDemandGaps();
}

function renderSearchTable() {
  const tbody = $('searchTableBody');
  if (!tbody) return;

  const showFailing = $('showFailingOnly')?.checked;
  let data = allSearchData;
  if (showFailing) data = data.filter(d => d.is_failing);

  tbody.innerHTML = data.length ? data.map(d => {
    const rowClass = d.is_failing ? 'zero-result' : '';
    return `<tr class="${rowClass}">
      <td><b>${esc(d.query)}</b></td>
      <td>${d.total_count}</td>
      <td>${d.result_count}</td>
      <td>${d.zero_result_count}</td>
      <td>${d.is_failing
        ? '<span style="color:var(--danger);font-weight:700">⚠ MISSING</span>'
        : '<span style="color:var(--accent)">✓ OK</span>'
      }</td>
      <td style="font-size:12px;color:var(--muted)">${timeAgo(d.last_searched)}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="6" class="empty-state">No search data yet</td></tr>';
}

function filterSearchTable() { renderSearchTable(); }

function renderSearchCloud() {
  const container = $('topSearchCloud');
  if (!container) return;
  const top = allSearchData.slice(0, 20);
  container.innerHTML = top.length ? top.map(d =>
    `<span class="tag-item${d.is_failing ? ' danger' : ''}"><b>${esc(d.query)}</b> ×${d.total_count}</span>`
  ).join('') : '<span class="tag-item">No searches yet</span>';
}

function renderDemandGaps() {
  const container = $('demandGaps');
  if (!container) return;
  const gaps = allSearchData.filter(d => d.is_failing).sort((a, b) => b.zero_result_count - a.zero_result_count).slice(0, 10);
  container.innerHTML = gaps.length ? gaps.map(d =>
    `<div class="demand-gap">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>${esc(d.query)}</span>
      <b>${d.zero_result_count}× failed</b>
    </div>`
  ).join('') : '<div class="empty-state">No demand gaps — all queries returning results 🎉</div>';
}

/* ============================================================
   E. CONVERSION FUNNEL
   ============================================================ */
async function loadFunnel() {
  try {
    const { start, end } = getDateRange();
    const { data } = await supabaseClient.rpc('get_conversion_funnel', { p_start: start, p_end: end });
    if (data) {
      $('funnelGuests').textContent = fmtNum(data.total_guests || 0);
      $('funnelReads').textContent = fmtNum(data.pdf_reads || 0);
      $('funnelDownloads').textContent = fmtNum(data.download_attempts || 0);
      $('funnelSearch').textContent = fmtNum(data.search_users || 0);
      $('funnelSignups').textContent = fmtNum(data.successful_signups || 0);

      $('funnelRate1').textContent = `${data.rate_reads || 0}% →`;
      $('funnelRate2').textContent = `${data.rate_downloads || 0}% →`;
      $('funnelRate3').textContent = `${data.rate_search || 0}% →`;
      $('funnelRate4').textContent = `${data.rate_signup || 0}%`;

      // Set bar widths proportionally
      const max = data.total_guests || 1;
      const steps = [
        { id: 'funnelStep1', val: data.total_guests },
        { id: 'funnelStep2', val: data.pdf_reads },
        { id: 'funnelStep3', val: data.download_attempts },
        { id: 'funnelStep4', val: data.search_users },
        { id: 'funnelStep5', val: data.successful_signups }
      ];
      steps.forEach(s => {
        const el = document.querySelector(`#${s.id} .funnel-bar`);
        if (el) el.style.setProperty('--w', Math.max(15, (s.val / max) * 100) + '%');
      });
    }
  } catch (err) {
    console.warn('Funnel fallback needed:', err);
    // Fallback
    await loadFunnelFallback();
  }
}

async function loadFunnelFallback() {
  let query = supabaseClient.from('analytics_events').select('visitor_id, event_type, user_email');
  if (currentRange > 0) query = query.gte('created_at', new Date(Date.now() - currentRange * 86400000).toISOString());
  const { data: events } = await query;
  if (!events) return;

  const allVisitors = new Set(), readVisitors = new Set(), dlVisitors = new Set(), searchVisitors = new Set(), signedUp = new Set();
  events.forEach(ev => {
    allVisitors.add(ev.visitor_id);
    if (ev.event_type === 'view') readVisitors.add(ev.visitor_id);
    if (ev.event_type === 'download') dlVisitors.add(ev.visitor_id);
    if (ev.event_type === 'search') searchVisitors.add(ev.visitor_id);
    if (ev.user_email) signedUp.add(ev.user_email);
  });

  const tg = allVisitors.size || 1;
  $('funnelGuests').textContent = fmtNum(allVisitors.size);
  $('funnelReads').textContent = fmtNum(readVisitors.size);
  $('funnelDownloads').textContent = fmtNum(dlVisitors.size);
  $('funnelSearch').textContent = fmtNum(searchVisitors.size);
  $('funnelSignups').textContent = fmtNum(signedUp.size);

  $('funnelRate1').textContent = ((readVisitors.size / tg) * 100).toFixed(1) + '% →';
  $('funnelRate2').textContent = (readVisitors.size > 0 ? ((dlVisitors.size / readVisitors.size) * 100).toFixed(1) : '0') + '% →';
  $('funnelRate3').textContent = (dlVisitors.size > 0 ? ((searchVisitors.size / dlVisitors.size) * 100).toFixed(1) : '0') + '% →';
  $('funnelRate4').textContent = (searchVisitors.size > 0 ? ((signedUp.size / searchVisitors.size) * 100).toFixed(1) : '0') + '%';

  const steps = [
    { id: 'funnelStep1', val: allVisitors.size },
    { id: 'funnelStep2', val: readVisitors.size },
    { id: 'funnelStep3', val: dlVisitors.size },
    { id: 'funnelStep4', val: searchVisitors.size },
    { id: 'funnelStep5', val: signedUp.size }
  ];
  steps.forEach(s => {
    const el = document.querySelector(`#${s.id} .funnel-bar`);
    if (el) el.style.setProperty('--w', Math.max(15, (s.val / tg) * 100) + '%');
  });
}

/* ============================================================
   F. SYSTEM HEALTH
   ============================================================ */
async function loadSystemHealth() {
  try {
    const { data: summary } = await supabaseClient.rpc('get_analytics_summary', { p_start: null, p_end: null });
    if (summary) {
      $('sysTotalEvents').textContent = fmtNum((summary.visits || 0) + (summary.views || 0) + (summary.downloads || 0) + (summary.uploads || 0) + (summary.saves || 0) + (summary.searches || 0) + (summary.sessions || 0));
      $('sysLastEvent').textContent = summary.last_event_at ? timeAgo(summary.last_event_at) : '—';
      renderEventDistChart(summary);
    }

    // Recent event log
    const { data: recent } = await supabaseClient.from('analytics_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(25);

    const tbody = $('sysEventLog');
    if (tbody) {
      tbody.innerHTML = (recent || []).map(ev =>
        `<tr>
          <td style="font-family:var(--font-mono);font-size:11px">${timeAgo(ev.created_at)}</td>
          <td>${EVENT_ICONS[ev.event_type] ? '<i class="' + EVENT_ICONS[ev.event_type] + '"></i> ' : ''}${esc(ev.event_type)}</td>
          <td>${esc(ev.user_email || ev.user_name || ev.visitor_id?.slice(0, 12) || '—')}</td>
          <td>${esc(ev.resource_title || '—')}</td>
          <td>${esc(ev.device || '—')}</td>
        </tr>`
      ).join('');
    }
  } catch (err) {
    console.error('System health error:', err);
  }
}

function refreshAnalyticsCache() {
  supabaseClient.rpc('refresh_analytics_cache').then(() => {
    toast('Analytics cache refreshed');
  }).catch(err => {
    toast('Cache refresh failed: ' + err.message);
  });
}

/* ============================================================
   CHARTS
   ============================================================ */
function renderTrendChart(data) {
  const ctx = $('trendChart');
  if (!ctx) return;
  if (charts.trend) charts.trend.destroy();

  charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => {
        const dt = new Date(d.date);
        return dt.getDate() + '/' + (dt.getMonth() + 1);
      }),
      datasets: [
        {
          label: 'Visits',
          data: data.map(d => d.visits || 0),
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, .08)',
          fill: true,
          tension: .4,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5
        },
        {
          label: 'Views',
          data: data.map(d => d.views || 0),
          borderColor: '#34d399',
          backgroundColor: 'rgba(52, 211, 153, .08)',
          fill: true,
          tension: .4,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5
        },
        {
          label: 'Downloads',
          data: data.map(d => d.downloads || 0),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, .08)',
          fill: true,
          tension: .4,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: 'rgba(148, 163, 184, .06)' } }
      },
      interaction: { mode: 'index', intersect: false }
    }
  });
}

function renderDeviceChips(devices, browsers, osList) {
  const container = $('deviceChips');
  if (!container) return;

  let html = '';
  devices.forEach(d => { html += `<span class="device-chip"><b>${esc(d.device)}</b> ${d.cnt}</span>`; });
  osList.forEach(o => { html += `<span class="device-chip">${esc(o.os)} · ${o.cnt}</span>`; });
  browsers.forEach(b => { html += `<span class="device-chip">${esc(b.browser)} · ${b.cnt}</span>`; });
  container.innerHTML = html || '<span class="device-chip">No data</span>';

  // Device donut chart
  const ctx = $('deviceChart');
  if (!ctx || !devices.length) return;
  if (charts.device) charts.device.destroy();

  const colors = ['#60a5fa', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#fb923c'];
  charts.device = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: devices.map(d => d.device),
      datasets: [{
        data: devices.map(d => d.cnt),
        backgroundColor: colors.slice(0, devices.length),
        borderWidth: 0,
        spacing: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 11 } } }
      }
    }
  });
}

function renderEventDistChart(summary) {
  const ctx = $('eventDistChart');
  if (!ctx) return;
  if (charts.eventDist) charts.eventDist.destroy();

  const labels = ['Visits', 'Views', 'Downloads', 'Uploads', 'Saves', 'Searches', 'Sessions'];
  const values = [summary.visits || 0, summary.views || 0, summary.downloads || 0, summary.uploads || 0, summary.saves || 0, summary.searches || 0, summary.sessions || 0];
  const colors = ['#60a5fa', '#34d399', '#f59e0b', '#a78bfa', '#f87171', '#fb923c', '#38bdf8'];

  charts.eventDist = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => c + '40'),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: 'rgba(148, 163, 184, .06)' } }
      }
    }
  });
}

function renderTopResources(data) {
  const tbody = $('topResourcesBody');
  if (!tbody) return;

  tbody.innerHTML = data.length ? data.map(r =>
    `<tr>
      <td><b>${esc(r.title)}</b><small>${esc(r.type || '')} ${r.subject ? '· ' + esc(r.subject) : ''}</small></td>
      <td>${r.reads || 0}</td>
      <td>${r.downloads || 0}</td>
      <td>${r.download_rate || 0}%</td>
    </tr>`
  ).join('') : '<tr><td colspan="4" class="empty-state">No resource data yet</td></tr>';
}

/* ============================================================
   CSV EXPORT
   ============================================================ */
function exportCSV() {
  const activeSection = document.querySelector('.content-section.active');
  if (!activeSection) return;

  const sectionId = activeSection.id.replace('section-', '');
  let rows = [];
  let filename = 'bcaprime-analytics.csv';

  if (sectionId === 'overview') {
    filename = 'bcaprime-overview.csv';
    rows = [
      ['Metric', 'Value'],
      ['Total Users', $('kpiVisitors').textContent],
      ['Views', $('kpiViews').textContent],
      ['Downloads', $('kpiDownloads').textContent],
      ['Signed Up', $('kpiSignedUp').textContent],
      ['Searches', $('kpiSearches').textContent],
      ['Avg Session', $('kpiAvgTime').textContent],
      ['Uploads', $('kpiUploads').textContent],
      ['Guests', $('kpiGuests').textContent]
    ];
  } else if (sectionId === 'content') {
    filename = 'bcaprime-content-performance.csv';
    rows = [['Resource', 'Type', 'Subject', 'Semester', 'Reads', 'Downloads', 'DL Rate']];
    allContentData.forEach(r => {
      rows.push([r.title, r.type || '', r.subject || '', r.semester || '', r.reads, r.downloads, r.download_rate + '%']);
    });
  } else if (sectionId === 'search') {
    filename = 'bcaprime-search-intelligence.csv';
    rows = [['Query', 'Total', 'Has Results', 'Zero Results', 'Is Failing', 'Last Searched']];
    allSearchData.forEach(d => {
      rows.push([d.query, d.total_count, d.result_count, d.zero_result_count, d.is_failing ? 'YES' : 'no', d.last_searched]);
    });
  } else if (sectionId === 'funnel') {
    filename = 'bcaprime-conversion-funnel.csv';
    rows = [
      ['Step', 'Count', 'Conversion Rate'],
      ['Total Visitors', $('funnelGuests').textContent, '100%'],
      ['PDF Reads', $('funnelReads').textContent, $('funnelRate1').textContent],
      ['Downloads', $('funnelDownloads').textContent, $('funnelRate2').textContent],
      ['Search/Explore', $('funnelSearch').textContent, $('funnelRate3').textContent],
      ['Signed Up', $('funnelSignups').textContent, $('funnelRate4').textContent]
    ];
  }

  if (!rows.length) return;

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('CSV exported ✓');
}

/* ============================================================
   HELPERS
   ============================================================ */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function fmtDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  if (seconds < 60) return Math.round(seconds) + 's';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m + 'm ' + s + 's';
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 0) return 'just now';
  if (diff < 10) return 'just now';
  if (diff < 60) return Math.floor(diff) + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function toast(msg) {
  // Simple toast notification
  let t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:12px 20px;background:rgba(30,41,59,.95);color:#f1f5f9;border:1px solid rgba(148,163,184,.15);border-radius:10px;font:600 13px "DM Sans",sans-serif;z-index:9999;backdrop-filter:blur(8px);box-shadow:0 8px 32px rgba(0,0,0,.35);animation:fadeUp .3s ease;opacity:0;transition:opacity .3s';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.style.opacity = '1');
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}
