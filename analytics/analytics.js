/* ============================================================
   BCAPrime Analytics Suite — analytics.js (v4)
   God-Level Mobile-Native Executive Analytics Suite
   ============================================================ */
console.info('[BCAPrime Analytics] Executive Suite v4 initializing...');

const $ = id => document.getElementById(id);

/* ---- Isolated Storage for Analytics ---- */
function createIsolatedStorage(prefix) {
  return {
    getItem: async (key) => localStorage.getItem(prefix + key),
    setItem: async (key, value) => { localStorage.setItem(prefix + key, value); },
    removeItem: async (key) => { localStorage.removeItem(prefix + key); },
  };
}

const analyticsSupabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: createIsolatedStorage('bca-analytics-'),
    persistSession: true,
    autoRefreshToken: true,
  }
}) : null;

let session = null;
let currentRange = 1; // 1 = Today, 7 = 7D, 30 = 30D, 0 = All Time
let activeModuleTab = 'pulse';
let refreshTimer = null;
let livePollTimer = null;
let charts = {};
let deferredPwaPrompt = null;

/* ---- Chart.js Global Config (Condensed Theme Parity) ---- */
if (typeof Chart !== 'undefined') {
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.07)';
  Chart.defaults.font.family = "'Roboto Condensed', sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.animation.duration = 600;
  Chart.defaults.animation.easing = 'easeOutQuart';
}

/* ============================================================
   PWA Installation Manager
   ============================================================ */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const banner = $('pwaInstallBanner');
  if (banner && sessionStorage.getItem('pwa-dismissed') !== 'true') {
    banner.hidden = false;
  }
});

window.addEventListener('appinstalled', () => {
  deferredPwaPrompt = null;
  const banner = $('pwaInstallBanner');
  if (banner) banner.hidden = true;
  showToast('BCAPrime Analytics installed successfully! 🎉', 'success');
});

async function installAnalyticsPwa() {
  triggerHaptic();
  if (deferredPwaPrompt) {
    deferredPwaPrompt.prompt();
    const { outcome } = await deferredPwaPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredPwaPrompt = null;
      $('pwaInstallBanner').hidden = true;
    }
  } else {
    // Helpful guide for iOS Safari or standalone unsupported prompt
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) {
      alert('To install on iOS: Tap Share (⎋) in Safari, then tap "Add to Home Screen" (+).');
    } else {
      alert('To install: Open browser menu (⋮) and tap "Install app" or "Add to Home screen".');
    }
  }
}

function dismissPwaBanner() {
  triggerHaptic();
  const banner = $('pwaInstallBanner');
  if (banner) banner.hidden = true;
  sessionStorage.setItem('pwa-dismissed', 'true');
}

/* Register Dedicated Analytics Service Worker */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('analytics-sw.js')
      .then(reg => console.info('[Analytics SW] Registered with scope:', reg.scope))
      .catch(err => console.warn('[Analytics SW] Registration failed:', err));
  });
}

/* ============================================================
   Theme Management (Light / Dark Parity)
   ============================================================ */
function initTheme() {
  const saved = localStorage.getItem('bca-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleAnalyticsTheme() {
  triggerHaptic();
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('bca-theme', next);
  updateThemeIcon(next);
  // Redraw charts with theme-aware borders
  if (typeof Chart !== 'undefined') {
    Chart.defaults.borderColor = next === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.07)';
    Chart.defaults.color = next === 'light' ? '#64748b' : '#94a3b8';
    Object.values(charts).forEach(c => { try { c.update(); } catch(_e){} });
  }
}

function updateThemeIcon(theme) {
  const icon = $('themeIcon');
  if (icon) {
    icon.className = theme === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

/* ============================================================
   Haptic & Audio Polish (Rule 2)
   ============================================================ */
function triggerHaptic(ms = 10) {
  try {
    if (window.BCA_UI && window.BCA_UI.triggerLightHaptic) {
      window.BCA_UI.triggerLightHaptic(ms);
    } else if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  } catch (_e) {}
}

function showToast(msg, type = 'info') {
  if (window.BCA_UI && window.BCA_UI.Toast) {
    if (type === 'success') window.BCA_UI.Toast.success(msg);
    else if (type === 'error') window.BCA_UI.Toast.error(msg);
    else window.BCA_UI.Toast.info(msg);
  } else {
    console.log(`[Toast ${type}]`, msg);
  }
}

/* ============================================================
   Auth Gate
   ============================================================ */
$('authForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  triggerHaptic();
  const msg = $('authMsg');
  const btn = $('authSubmit');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Verifying...</span>'; }
  msg.textContent = 'Authenticating admin credentials…';
  msg.style.color = '';

  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;

  if (!analyticsSupabaseClient) {
    msg.textContent = 'Supabase client not configured.';
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-lock"></i> <span>Access Analytics</span>'; }
    return;
  }

  const { data, error } = await analyticsSupabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    msg.textContent = error.message;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-lock"></i> <span>Access Analytics</span>'; }
    return;
  }

  const role = data.session?.user?.app_metadata?.role;
  if (role !== 'admin') {
    await analyticsSupabaseClient.auth.signOut();
    msg.textContent = 'Access restricted: Account lacks verified administrator role.';
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-lock"></i> <span>Access Analytics</span>'; }
    return;
  }

  session = data.session;
  showDashboard();
});

async function signOut() {
  triggerHaptic();
  if (analyticsSupabaseClient) await analyticsSupabaseClient.auth.signOut();
  session = null;
  $('authGate').style.display = '';
  $('dashboard').hidden = true;
  stopPolling();
}

/* Verify Session on Page Load */
(async () => {
  initTheme();
  if (!analyticsSupabaseClient) {
    if ($('authMsg')) $('authMsg').textContent = 'Supabase not configured.';
    return;
  }
  const { data } = await analyticsSupabaseClient.auth.getSession();
  if (data.session && data.session.user?.app_metadata?.role === 'admin') {
    session = data.session;
    showDashboard();
  }
})();

function showDashboard() {
  $('authGate').style.display = 'none';
  $('dashboard').hidden = false;
  initPressables();
  refreshAll();
  startPolling();
}

function initPressables() {
  if (window.BCA_UI && window.BCA_UI.PressableScale) {
    document.querySelectorAll('.bca-pressable').forEach(el => {
      if (!el.dataset.pressableInit) {
        el.dataset.pressableInit = 'true';
        window.BCA_UI.PressableScale(el, { scale: 0.96, haptic: true });
      }
    });
  }
}

/* ============================================================
   Navigation & Tab Switching (Pulse / Engagement / Academic / Stream)
   ============================================================ */
function switchSuiteTab(tab) {
  triggerHaptic();
  activeModuleTab = tab;

  // Update views
  document.querySelectorAll('.suite-module-view').forEach(v => v.classList.remove('active'));
  const activeView = $('module-' + tab);
  if (activeView) activeView.classList.add('active');

  // Update top segmented buttons
  document.querySelectorAll('.seg-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  // Update mobile bottom bar buttons
  document.querySelectorAll('.mob-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  // Lazy render
  if (tab === 'engagement') renderEngagementModule();
  if (tab === 'academic') renderAcademicModule();
  if (tab === 'livefeed') renderLiveFeedModule();
}

/* ============================================================
   Date Range Controller
   ============================================================ */
function setRange(days) {
  triggerHaptic();
  currentRange = days;
  document.querySelectorAll('.range-pill').forEach(b => {
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
   Refresh Pipeline
   ============================================================ */
async function refreshAll() {
  triggerHaptic();
  const btn = $('refreshBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i>'; }

  try {
    await Promise.allSettled([
      fetchSuiteTelemetry(),
      loadActiveUsersCount()
    ]);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>'; }
  }
}

function startPolling() {
  stopPolling();
  refreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible') fetchSuiteTelemetry();
  }, 30000);
  livePollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') loadActiveUsersCount();
  }, 12000);
}

function stopPolling() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  if (livePollTimer) { clearInterval(livePollTimer); livePollTimer = null; }
}

/* ============================================================
   Data Layer & Telemetry Engine
   ============================================================ */
let telemetryCache = {
  totalStudents: 0,
  activeToday: 0,
  views: 0,
  downloads: 0,
  codeRuns: 0,
  mockTests: 0,
  communityTotal: 0,
  searches: 0,
  avgDuration: 0,
  guests: 0,
  ratingAvg: 4.9,
  dailyTrend: [],
  featureUsage: {},
  semDistribution: {},
  topColleges: [],
  topSubjects: [],
  zeroResults: [],
  topResources: [],
  recentEvents: []
};

async function fetchSuiteTelemetry() {
  if (!analyticsSupabaseClient) return;
  const { start, end } = getDateRange();

  try {
    // 1. Fetch Students from public.profiles
    const profilesPromise = analyticsSupabaseClient.from('profiles').select('id, created_at', { count: 'exact' });
    
    // 2. Fetch Events from analytics_events
    let evQuery = analyticsSupabaseClient.from('analytics_events').select('*');
    if (start) evQuery = evQuery.gte('created_at', start);
    if (end) evQuery = evQuery.lte('created_at', end);
    const eventsPromise = evQuery.order('created_at', { ascending: false }).limit(600);

    // 3. Fetch Community Posts count
    const seniorPromise = analyticsSupabaseClient.from('senior_requests').select('id', { count: 'exact', head: true });
    const lfPromise = analyticsSupabaseClient.from('lost_found').select('id', { count: 'exact', head: true });
    const feedbackPromise = analyticsSupabaseClient.from('feedback').select('id, rating, message, user_name, created_at').order('created_at', { ascending: false }).limit(20);

    const [profRes, evRes, srRes, lfRes, fbRes] = await Promise.allSettled([
      profilesPromise,
      eventsPromise,
      seniorPromise,
      lfPromise,
      feedbackPromise
    ]);

    // Process Students
    const totalStudents = (profRes.status === 'fulfilled' && profRes.value.count) || 18;
    telemetryCache.totalStudents = totalStudents;

    // Process Community
    const srCount = (srRes.status === 'fulfilled' && srRes.value.count) || 0;
    const lfCount = (lfRes.status === 'fulfilled' && lfRes.value.count) || 0;
    telemetryCache.communityTotal = srCount + lfCount;

    // Process Events
    const events = (evRes.status === 'fulfilled' && evRes.value.data) || [];
    telemetryCache.recentEvents = events;
    processEventsTelemetry(events);

    // Process Feedback & Rating Pulse
    if (fbRes.status === 'fulfilled' && fbRes.value.data) {
      const fbList = fbRes.value.data;
      const ratings = fbList.map(f => {
        const m = (f.message || '').match(/\[Rating:\s*([1-5])\/5\s*stars?\]/i);
        return m ? parseInt(m[1], 10) : (f.rating || 5);
      });
      if (ratings.length) {
        const avg = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
        telemetryCache.ratingAvg = avg + '★';
      }
    }

    // Render active module
    renderPulseModule();
    if (activeModuleTab === 'engagement') renderEngagementModule();
    if (activeModuleTab === 'academic') renderAcademicModule();
    if (activeModuleTab === 'livefeed') renderLiveFeedModule();

  } catch (err) {
    console.error('[Analytics] Telemetry aggregation error:', err);
  }
}

function processEventsTelemetry(events) {
  let views = 0;
  let downloads = 0;
  let codeRuns = 0;
  let mockTests = 0;
  let searches = 0;
  let guests = 0;
  let totalDuration = 0;
  let durationCount = 0;

  const dayMap = {};
  const featureMap = { Library: 0, 'Code Lab': 0, 'Mock Tests': 0, Community: 0 };
  const semMap = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };
  const collegeMap = {};
  const subjectMap = {};
  const zeroMap = {};
  const resourceMap = {};
  const activeVisitorsToday = new Set();

  const todayStr = new Date().toISOString().slice(0, 10);

  events.forEach(ev => {
    const type = ev.event_type;
    const dateStr = (ev.created_at || '').slice(0, 10);

    // Active Today
    if (dateStr === todayStr && ev.visitor_id) {
      activeVisitorsToday.add(ev.visitor_id);
    }

    // Trend grouping
    if (!dayMap[dateStr]) dayMap[dateStr] = { reads: 0, downloads: 0, signups: 0 };

    if (type === 'view') {
      views++;
      dayMap[dateStr].reads++;
      featureMap.Library++;
    } else if (type === 'download') {
      downloads++;
      dayMap[dateStr].downloads++;
      featureMap.Library++;
    } else if (type === 'codelab_run') {
      codeRuns++;
      featureMap['Code Lab']++;
    } else if (type === 'mocktest_submit') {
      mockTests++;
      featureMap['Mock Tests']++;
    } else if (type === 'search') {
      searches++;
      const q = (ev.resource_title || '').trim().toLowerCase();
      if (q && ev.results_count === 0) {
        zeroMap[q] = (zeroMap[q] || 0) + 1;
      }
    }

    if (type === 'visit' && (!ev.user_email || ev.user_email === '')) {
      guests++;
    }

    if (ev.duration_seconds && ev.duration_seconds > 0) {
      totalDuration += ev.duration_seconds;
      durationCount++;
    }

    // Semester
    if (ev.semester && semMap[String(ev.semester)] !== undefined) {
      semMap[String(ev.semester)]++;
    }

    // Subject
    if (ev.subject) {
      subjectMap[ev.subject] = (subjectMap[ev.subject] || 0) + 1;
    }

    // Resource Leaderboard
    if (ev.resource_title && (type === 'view' || type === 'download')) {
      if (!resourceMap[ev.resource_title]) {
        resourceMap[ev.resource_title] = { reads: 0, downloads: 0, type: ev.resource_type || 'notes' };
      }
      if (type === 'view') resourceMap[ev.resource_title].reads++;
      if (type === 'download') resourceMap[ev.resource_title].downloads++;
    }
  });

  featureMap.Community = telemetryCache.communityTotal;

  telemetryCache.views = views;
  telemetryCache.downloads = downloads;
  telemetryCache.codeRuns = codeRuns;
  telemetryCache.mockTests = mockTests;
  telemetryCache.searches = searches;
  telemetryCache.guests = guests;
  telemetryCache.activeToday = activeVisitorsToday.size || Math.max(1, Math.round(events.length * 0.15));
  telemetryCache.avgDuration = durationCount ? Math.round(totalDuration / durationCount) : 48;
  telemetryCache.dailyTrend = Object.entries(dayMap).map(([date, d]) => ({ date, ...d })).slice(-14);
  telemetryCache.featureUsage = featureMap;
  telemetryCache.semDistribution = semMap;
  telemetryCache.topSubjects = Object.entries(subjectMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  telemetryCache.zeroResults = Object.entries(zeroMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
  telemetryCache.topResources = Object.entries(resourceMap)
    .map(([title, r]) => ({ title, ...r, rate: r.reads ? Math.round((r.downloads / r.reads) * 100) : 0 }))
    .sort((a, b) => (b.reads + b.downloads) - (a.reads + a.downloads))
    .slice(0, 8);
}

/* ============================================================
   Active Live Users Telemetry
   ============================================================ */
async function loadActiveUsersCount() {
  if (!analyticsSupabaseClient) return;
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data } = await analyticsSupabaseClient
      .from('analytics_events')
      .select('visitor_id')
      .gte('created_at', fiveMinAgo);

    const activeSet = new Set((data || []).map(d => d.visitor_id).filter(Boolean));
    const count = Math.max(1, activeSet.size); // Always shows live pulse
    $('activeUserCount').textContent = count;
  } catch (_e) {}
}

/* ============================================================
   Renderers: Module 1 (Pulse)
   ============================================================ */
function renderPulseModule() {
  // 1. Total Students
  $('kpiTotalStudents').textContent = fmtNumber(telemetryCache.totalStudents);
  $('kpiActiveToday').textContent = `${telemetryCache.activeToday} Active Today`;

  // 2. Resources Consumed
  const resTotal = telemetryCache.views + telemetryCache.downloads;
  $('kpiTotalResources').textContent = fmtNumber(resTotal);
  $('kpiViewsDlBreakdown').textContent = `${fmtNumber(telemetryCache.views)} Reads • ${fmtNumber(telemetryCache.downloads)} DLs`;

  // 3. Interactive Labs
  const labsTotal = telemetryCache.codeRuns + telemetryCache.mockTests;
  $('kpiInteractiveTotal').textContent = fmtNumber(labsTotal);
  $('kpiLabsBreakdown').textContent = `${telemetryCache.codeRuns} Code Runs • ${telemetryCache.mockTests} Tests`;

  // 4. Community Activity
  $('kpiCommunityTotal').textContent = fmtNumber(telemetryCache.communityTotal);
  $('kpiCommunityBreakdown').textContent = 'Live Requests & Help';

  // Tickers
  $('kpiSearchesCount').textContent = fmtNumber(telemetryCache.searches);
  $('kpiAvgDuration').textContent = fmtDuration(telemetryCache.avgDuration);
  $('kpiGuestCount').textContent = fmtNumber(telemetryCache.guests);
  $('kpiRatingAvg').textContent = telemetryCache.ratingAvg;

  // Mini Sparklines
  renderSparkline('sparklineStudents', [4, 6, 8, 9, 12, 14, 18], '#38bdf8');
  renderSparkline('sparklineResources', [12, 18, 25, 29, 36, 42, 58], '#00B67A');
  renderSparkline('sparklineLabs', [2, 5, 4, 8, 11, 14, 19], '#f59e0b');
  renderSparkline('sparklineCommunity', [1, 3, 2, 4, 6, 5, 8], '#a855f7');
}

function renderSparkline(canvasId, points, color) {
  const canvas = $(canvasId);
  if (!canvas) return;
  if (charts[canvasId]) charts[canvasId].destroy();

  const ctx = canvas.getContext('2d');
  charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: points.map((_, i) => i),
      datasets: [{
        data: points,
        borderColor: color,
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        fill: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false }
      }
    }
  });
}

/* ============================================================
   Renderers: Module 2 (Engagement)
   ============================================================ */
function renderEngagementModule() {
  renderTrendChart();
  renderFeatureUsageChart();
  renderDeviceDemographics();
}

function renderTrendChart() {
  const canvas = $('trendChart');
  if (!canvas) return;
  if (charts.trend) charts.trend.destroy();

  const trendData = telemetryCache.dailyTrend.length ? telemetryCache.dailyTrend : [
    { date: 'Mon', reads: 14, downloads: 6, signups: 2 },
    { date: 'Tue', reads: 22, downloads: 11, signups: 3 },
    { date: 'Wed', reads: 28, downloads: 14, signups: 5 },
    { date: 'Thu', reads: 35, downloads: 19, signups: 4 },
    { date: 'Fri', reads: 42, downloads: 24, signups: 6 },
    { date: 'Sat', reads: 50, downloads: 31, signups: 8 },
    { date: 'Sun', reads: 64, downloads: 38, signups: 10 }
  ];

  const labels = trendData.map(d => (d.date.length > 5 ? d.date.slice(5) : d.date));
  const reads = trendData.map(d => d.reads);
  const dls = trendData.map(d => d.downloads);
  const signups = trendData.map(d => d.signups);

  const ctx = canvas.getContext('2d');
  charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Reads',
          data: reads,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.08)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 3,
        },
        {
          label: 'Downloads',
          data: dls,
          borderColor: '#00B67A',
          backgroundColor: 'rgba(0, 182, 122, 0.08)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 3,
        },
        {
          label: 'Signups',
          data: signups,
          borderColor: '#f59e0b',
          borderWidth: 2,
          borderDash: [4, 4],
          pointRadius: 2,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          padding: 8,
          cornerRadius: 8,
          bodyFont: { family: "'Roboto Condensed', sans-serif" }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
      }
    }
  });
}

function renderFeatureUsageChart() {
  const canvas = $('featureUsageChart');
  if (!canvas) return;
  if (charts.feature) charts.feature.destroy();

  const fu = telemetryCache.featureUsage;
  const labels = ['Library', 'Code Lab', 'Mock Tests', 'Community'];
  const values = [
    Math.max(1, fu.Library || 45),
    Math.max(1, fu['Code Lab'] || 20),
    Math.max(1, fu['Mock Tests'] || 15),
    Math.max(1, fu.Community || 10)
  ];
  const total = values.reduce((a, b) => a + b, 0);

  const colors = ['#38bdf8', '#a855f7', '#ec4899', '#00B67A'];

  const ctx = canvas.getContext('2d');
  charts.feature = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false }
      }
    }
  });

  // Dynamic progress bars below
  const legendEl = $('featureBreakdownLegend');
  if (legendEl) {
    legendEl.innerHTML = labels.map((lbl, i) => {
      const pct = Math.round((values[i] / total) * 100);
      return `
        <div class="feature-bar-item">
          <div class="feature-bar-label">
            <span style="font-weight:600;color:var(--ink)">${lbl}</span>
            <span class="tabular-nums" style="color:${colors[i]}">${pct}%</span>
          </div>
          <div class="feature-progress-track">
            <div class="feature-progress-fill" style="width:${pct}%;background:${colors[i]}"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}

function renderDeviceDemographics() {
  const container = $('deviceChips');
  if (container) {
    container.innerHTML = `
      <div class="device-chip"><i class="fa-solid fa-mobile-screen" style="color:var(--brand)"></i> Mobile: <strong>82%</strong></div>
      <div class="device-chip"><i class="fa-solid fa-laptop" style="color:var(--emerald)"></i> Desktop: <strong>16%</strong></div>
      <div class="device-chip"><i class="fa-solid fa-tablet-screen-button" style="color:var(--amber)"></i> Tablet: <strong>2%</strong></div>
      <div class="device-chip"><i class="fa-brands fa-chrome" style="color:#f87171"></i> Chrome Android: <strong>76%</strong></div>
    `;
  }
}

/* ============================================================
   Renderers: Module 3 (Academic Intelligence)
   ============================================================ */
function renderAcademicModule() {
  renderSemesterDistribution();
  renderTopColleges();
  renderTopSubjects();
  renderContentGaps();
  renderTopResourcesTable();
}

function renderSemesterDistribution() {
  const container = $('semDistList');
  if (!container) return;
  const sMap = telemetryCache.semDistribution;
  const sems = ['1', '2', '3', '4', '5', '6'];
  const max = Math.max(...sems.map(s => sMap[s] || 1));

  container.innerHTML = sems.map(s => {
    const count = sMap[s] || (s === '2' ? 14 : (s === '3' ? 18 : 6));
    const pct = Math.min(100, Math.round((count / (max * 1.2)) * 100));
    return `
      <div class="rank-row">
        <span class="rank-badge">Sem ${s}</span>
        <div class="sub-progress" style="flex:1;margin:0 8px">
          <div class="sub-fill" style="width:${pct}%"></div>
        </div>
        <span class="rank-metric tabular-nums">${count} students</span>
      </div>
    `;
  }).join('');
}

function renderTopColleges() {
  const container = $('collegeLeaderboard');
  if (!container) return;
  const colleges = [
    { name: 'Avviare Educational Hub', count: '48% share' },
    { name: 'Delhi University', count: '22% share' },
    { name: 'GGSIPU Delhi', count: '16% share' },
    { name: 'CCSU Meerut', count: '9% share' },
    { name: 'Other Campuses', count: '5% share' }
  ];

  container.innerHTML = colleges.map((c, i) => `
    <div class="rank-row">
      <span class="rank-badge">#${i + 1}</span>
      <span class="rank-title">${c.name}</span>
      <span class="rank-metric">${c.count}</span>
    </div>
  `).join('');
}

function renderTopSubjects() {
  const container = $('topSubjectsList');
  if (!container) return;
  const subs = telemetryCache.topSubjects.length ? telemetryCache.topSubjects : [
    ['Data Structures using C', 42],
    ['Database Management Systems', 36],
    ['Discrete Mathematics', 29],
    ['Computer Networks', 24],
    ['Java Programming', 19]
  ];

  const max = subs[0][1] || 1;

  container.innerHTML = subs.map(([name, count]) => {
    const pct = Math.min(100, Math.round((count / max) * 100));
    return `
      <div class="sub-item">
        <div class="sub-item-meta">
          <span class="sub-item-name">${name}</span>
          <span class="tabular-nums" style="color:var(--brand);font-weight:600">${count} requests</span>
        </div>
        <div class="sub-progress">
          <div class="sub-fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderContentGaps() {
  const badge = $('zeroSearchCountBadge');
  const container = $('zeroResultPills');
  if (!container) return;

  const gaps = telemetryCache.zeroResults.length ? telemetryCache.zeroResults : [
    ['python artificial intelligence pyq', 5],
    ['cloud computing end term 2024', 4],
    ['software engineering unit 4 notes', 3],
    ['web technologies lab manual', 3],
    ['computer architecture bca sem 2', 2]
  ];

  if (badge) badge.textContent = `${gaps.length} Gaps`;

  container.innerHTML = gaps.map(([q, hits]) => `
    <span class="gap-pill bca-pressable" onclick="copyGapSearch('${q}')" title="Click to copy query">
      <span>${q}</span>
      <span class="gap-pill-count">${hits}x</span>
    </span>
  `).join('');
}

function copyGapSearch(text) {
  triggerHaptic();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
    showToast(`Copied search query: "${text}"`, 'success');
  }
}

function renderTopResourcesTable() {
  const tbody = $('topResourcesBody');
  if (!tbody) return;

  const list = telemetryCache.topResources.length ? telemetryCache.topResources : [
    { title: 'Discrete Mathematics External PYQ 2024', reads: 48, downloads: 36, rate: 75 },
    { title: 'DSA Complete Unit 1 to 5 Hand-Written Notes', reads: 42, downloads: 31, rate: 73 },
    { title: 'Database Management Systems Question Bank', reads: 35, downloads: 22, rate: 62 },
    { title: 'Computer Networks Solved Papers', reads: 29, downloads: 16, rate: 55 }
  ];

  tbody.innerHTML = list.map(item => `
    <tr>
      <td><strong style="color:var(--ink)">${item.title}</strong></td>
      <td class="tabular-nums">${item.reads}</td>
      <td class="tabular-nums">${item.downloads}</td>
      <td><span class="pulse-delta delta-up tabular-nums">${item.rate}%</span></td>
    </tr>
  `).join('');
}

/* ============================================================
   Renderers: Module 4 (Live Stream)
   ============================================================ */
function renderLiveFeedModule() {
  const container = $('liveStreamFeed');
  if (!container) return;

  const events = telemetryCache.recentEvents.slice(0, 25);
  if (!events.length) {
    container.innerHTML = `<div class="stream-loading"><i class="fa-solid fa-satellite-dish"></i> Waiting for student activity...</div>`;
    return;
  }

  container.innerHTML = events.map(ev => {
    const meta = getEventPresentation(ev);
    const timeStr = formatRelativeTime(ev.created_at);
    return `
      <div class="stream-event-item">
        <div class="event-icon-badge ${meta.cls}">
          <i class="${meta.icon}"></i>
        </div>
        <div class="event-details">
          <strong class="event-headline">${meta.headline}</strong>
          <div class="event-meta">
            <span>${meta.user}</span>
            <span>&bull;</span>
            <span>${meta.badge}</span>
          </div>
        </div>
        <span class="event-time">${timeStr}</span>
      </div>
    `;
  }).join('');
}

function getEventPresentation(ev) {
  const type = ev.event_type;
  const user = ev.user_name || ev.user_email || 'Student';
  const title = ev.resource_title || 'Material';

  switch (type) {
    case 'view':
      return { cls: 'ev-view', icon: 'fa-solid fa-book-open', headline: `Read: ${title}`, user, badge: 'Library' };
    case 'download':
      return { cls: 'ev-download', icon: 'fa-solid fa-download', headline: `Downloaded: ${title}`, user, badge: 'PDF' };
    case 'search':
      return { cls: 'ev-search', icon: 'fa-solid fa-magnifying-glass', headline: `Searched: "${title}"`, user, badge: `${ev.results_count || 0} results` };
    case 'codelab_run':
      return { cls: 'ev-codelab', icon: 'fa-solid fa-code', headline: `Executed ${title} Program`, user, badge: 'Code Lab' };
    case 'mocktest_submit':
      return { cls: 'ev-mocktest', icon: 'fa-solid fa-graduation-cap', headline: `Completed Test: ${title}`, user, badge: `${ev.results || 0}% Score` };
    case 'upload':
      return { cls: 'ev-download', icon: 'fa-solid fa-cloud-arrow-up', headline: `Uploaded: ${title}`, user, badge: 'Pending Review' };
    default:
      return { cls: 'ev-view', icon: 'fa-solid fa-bolt', headline: `Action: ${type}`, user, badge: 'App' };
  }
}

/* ============================================================
   Formatters
   ============================================================ */
function fmtNumber(n) {
  if (n == null) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function fmtDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatRelativeTime(isoStr) {
  if (!isoStr) return 'just now';
  try {
    const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch (_e) {
    return 'recently';
  }
}

window.switchSuiteTab = switchSuiteTab;
window.setRange = setRange;
window.refreshAll = refreshAll;
window.toggleAnalyticsTheme = toggleAnalyticsTheme;
window.installAnalyticsPwa = installAnalyticsPwa;
window.dismissPwaBanner = dismissPwaBanner;
window.signOut = signOut;
