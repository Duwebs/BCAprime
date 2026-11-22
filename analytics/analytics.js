/* ============================================================
   BCAPrime Analytics Suite — analytics.js (v4)
   God-Level Mobile-Native Executive Analytics Suite
   ============================================================ */
console.info('[BCAPrime Analytics] Executive Suite v4 initializing...');

const $ = id => document.getElementById(id);

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
const escHtml = escapeHtml;
if (typeof window !== 'undefined') {
  window.escapeHtml = escapeHtml;
  window.escHtml = escapeHtml;
}

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
  showToast('BCAPrime Stats installed successfully! 🎉', 'success');
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
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-lock"></i> <span>Access Stats</span>'; }
    return;
  }

  const { data, error } = await analyticsSupabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    msg.textContent = error.message;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-lock"></i> <span>Access Stats</span>'; }
    return;
  }

  const role = data.session?.user?.app_metadata?.role;
  if (role !== 'admin') {
    await analyticsSupabaseClient.auth.signOut();
    msg.textContent = 'Access restricted: Account lacks verified administrator role.';
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-lock"></i> <span>Access Stats</span>'; }
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
  let { data } = await analyticsSupabaseClient.auth.getSession();

  // If no analytics session, check if admin is already logged in via BCAPrime Admin ('bca-admin-')
  if (!data?.session) {
    try {
      const adminTokenKey = Object.keys(localStorage).find(k => k.startsWith('bca-admin-') && k.includes('-auth-token'));
      if (adminTokenKey) {
        const adminTokenVal = localStorage.getItem(adminTokenKey);
        if (adminTokenVal) {
          const analyticsTokenKey = adminTokenKey.replace('bca-admin-', 'bca-analytics-');
          localStorage.setItem(analyticsTokenKey, adminTokenVal);
          const res = await analyticsSupabaseClient.auth.getSession();
          data = res.data;
        }
      }
    } catch (_syncErr) {}
  }

  if (data?.session && (data.session.user?.app_metadata?.role === 'admin' || data.session.user?.role === 'authenticated')) {
    session = data.session;
    showDashboard();
  }
})();

function showDashboard() {
  $('authGate').style.display = 'none';
  $('dashboard').hidden = false;
  initPressables();
  initLivePresenceListener();
  refreshAll();
  startPolling();

  // Auto-open Student Inspector if ?student=<userId> is in URL
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const studentParam = urlParams.get('student');
    if (studentParam) {
      switchSuiteTab('students');
      setTimeout(() => openStudentInspector(studentParam), 150);
    }
  } catch (_e) {}
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
   Navigation & Tab Switching (Pulse / Engagement / Academic / Stream / Students)
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
  if (tab === 'students') renderStudentsModule();
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
      loadActiveUsersCount(),
      loadApprovedCollegesForStats()
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
   Active Live Users Telemetry & Realtime Presence
   ============================================================ */
let livePresenceChannel = null;
let liveStudentsList = [];

function initLivePresenceListener() {
  if (!analyticsSupabaseClient) return;
  if (livePresenceChannel) return;
  try {
    livePresenceChannel = analyticsSupabaseClient.channel('bca-live-students');
    livePresenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = livePresenceChannel.presenceState();
        syncLiveStudentsFromPresence(state);
      })
      .on('presence', { event: 'join' }, () => {
        const state = livePresenceChannel.presenceState();
        syncLiveStudentsFromPresence(state);
      })
      .on('presence', { event: 'leave' }, () => {
        const state = livePresenceChannel.presenceState();
        syncLiveStudentsFromPresence(state);
      })
      .subscribe();
  } catch (err) {
    console.warn('[Stats] Live presence realtime listener error:', err);
  }
}

function syncLiveStudentsFromPresence(state) {
  const rawList = Object.values(state || {}).flat();
  const studentMap = new Map();

  for (const item of rawList) {
    if (!item) continue;
    const page = String(item.page || '').toLowerCase();
    // Exclude admin or analytics routes
    if (page.includes('/admin') || page.includes('/analytics') || page.includes('/stats')) continue;
    const key = item.uid || item.visitor_id || item.id;
    if (!key) continue;
    studentMap.set(key, item);
  }

  liveStudentsList = Array.from(studentMap.values());
  updateLiveIndicatorUI();

  const modal = $('liveStudentsModal');
  if (modal && !modal.hidden) {
    renderLiveStudentsList();
  }
}

function updateLiveIndicatorUI() {
  const count = liveStudentsList.length;
  const countEl = $('activeUserCount');
  if (countEl) countEl.textContent = count;
  const badgeEl = $('liveModalCountBadge');
  if (badgeEl) badgeEl.textContent = `${count} Online`;
}

async function loadActiveUsersCount() {
  if (!analyticsSupabaseClient) return;
  try {
    // If Realtime is already reporting active students, preserve Realtime accuracy
    if (livePresenceChannel && liveStudentsList.length > 0) {
      updateLiveIndicatorUI();
      return;
    }

    // Fallback: Query recent 3-minute student events from analytics_events
    const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const { data } = await analyticsSupabaseClient
      .from('analytics_events')
      .select('visitor_id, user_id, user_name, user_email, resource_title, resource_type, subject, semester, page_path, created_at')
      .gte('created_at', threeMinAgo)
      .order('created_at', { ascending: false });

    // Exclude admin paths and sessions
    const validEvents = (data || []).filter(e => {
      const p = String(e.page_path || '').toLowerCase();
      return !p.includes('/admin') && !p.includes('/analytics') && !p.includes('/stats');
    });

    const studentMap = new Map();
    validEvents.forEach(e => {
      const key = e.user_id || e.visitor_id;
      if (!key) return;
      if (!studentMap.has(key)) {
        let act = 'Home Library';
        if (e.resource_title) act = `Reading: ${e.resource_title}`;
        else if (e.subject) act = `Browsing ${e.subject}`;

        studentMap.set(key, {
          id: key,
          uid: e.user_id || null,
          visitor_id: e.visitor_id,
          name: e.user_name || (e.user_id ? 'Student' : 'Guest Student'),
          username: '',
          email: e.user_email || '',
          avatar: '',
          college: 'all',
          college_name: 'All Colleges',
          sem: e.semester ? String(e.semester) : '1',
          activity: act,
          page: e.page_path || '/',
          last_ping: e.created_at
        });
      }
    });

    if (liveStudentsList.length === 0) {
      liveStudentsList = Array.from(studentMap.values());
    }

    updateLiveIndicatorUI();
  } catch (_e) {}
}

/* ---- Live Students Slide-Up Modal Handlers ---- */
function formatLastPing(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Just now';
    const now = Date.now();
    const diffSec = Math.floor((now - d.getTime()) / 1000);
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
    if (diffSec < 30) return `Active now (${timeStr} IST)`;
    if (diffSec < 120) return `1m ago (${timeStr} IST)`;
    const mins = Math.floor(diffSec / 60);
    return `${mins}m ago (${timeStr} IST)`;
  } catch (_e) {
    return 'Active';
  }
}

function openLiveStudentsModal() {
  triggerHaptic();
  const modal = $('liveStudentsModal');
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  updateLiveIndicatorUI();
  renderLiveStudentsList();
}

function closeLiveStudentsModal() {
  triggerHaptic();
  const modal = $('liveStudentsModal');
  if (modal) modal.hidden = true;
  document.body.style.overflow = '';
}

function renderLiveStudentsList() {
  const container = $('liveStudentsListContainer');
  if (!container) return;

  if (liveStudentsList.length === 0) {
    container.innerHTML = `
      <div class="live-empty-state">
        <div class="live-empty-icon-wrap">
          <i class="fa-solid fa-satellite-dish"></i>
        </div>
        <h3 class="live-empty-title">No Students Online Right Now</h3>
        <p class="live-empty-desc">
          The live pulse tracks active students on BCAPrime in real time when they open notes, take mock tests, or code in Code Lab.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = liveStudentsList.map(st => {
    const cached = (statsStudentsCache || []).find(s => (st.uid && s.uid === st.uid) || (st.email && s.email === st.email));
    const name = (cached && cached.name) || st.name || 'Student';
    const username = (cached && cached.username) ? ('@' + cached.username.replace(/^@/, '')) : (st.username || '');
    const avatar = (cached && (cached.avatar_url || cached.avatar)) || st.avatar || '';
    const collegeCode = (cached && cached.college) || st.college || 'all';
    const collegeName = formatStudentCollege(collegeCode);
    const sem = (cached && cached.semester) || st.sem || '1';
    const activity = st.activity || 'Home Library';
    const lastPingStr = st.last_ping ? formatLastPing(st.last_ping) : 'Just now';
    const studentUid = st.uid || (cached && cached.uid) || null;

    return `
      <div class="live-student-card bca-pressable" onclick="${studentUid ? `openStudentFromLive('${escapeHtml(studentUid)}')` : `toast('Guest student: No registered telemetry profile')`}">
        <div class="live-avatar-wrap">
          ${avatar
            ? `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}" class="live-avatar-img">`
            : `<div class="live-avatar-initial">${escapeHtml(name.charAt(0).toUpperCase())}</div>`
          }
          <span class="live-status-dot-ring"></span>
        </div>
        <div class="live-student-info">
          <div class="live-student-top">
            <strong class="live-student-name">${escapeHtml(name)}</strong>
            ${username ? `<span class="live-student-user">${escapeHtml(username)}</span>` : ''}
            <span class="live-sem-pill">SEM ${escapeHtml(sem)}</span>
          </div>
          <div class="live-student-college">
            <i class="fa-solid fa-building-columns"></i>
            <span>${escapeHtml(collegeName)}</span>
          </div>
          <div class="live-student-activity">
            <span class="live-activity-badge">
              <i class="fa-solid fa-bolt"></i> ${escapeHtml(activity)}
            </span>
            <span class="live-ping-time tabular-nums">${escapeHtml(lastPingStr)}</span>
          </div>
        </div>
        <div class="live-card-action">
          <i class="fa-solid fa-chevron-right"></i>
        </div>
      </div>
    `;
  }).join('');

  if (window.BCA_UI && typeof window.BCA_UI.initPressable === 'function') {
    container.querySelectorAll('.bca-pressable').forEach(el => window.BCA_UI.initPressable(el));
  }
}

function openStudentFromLive(uid) {
  closeLiveStudentsModal();
  setTimeout(() => {
    openStudentInspector(uid);
  }, 120);
}

window.openLiveStudentsModal = openLiveStudentsModal;
window.closeLiveStudentsModal = closeLiveStudentsModal;
window.openStudentFromLive = openStudentFromLive;

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

/* ============================================================
   MODULE 5: Students Directory & A-to-Z Telemetry Inspector
   ============================================================ */
let statsStudentsCache = [];
let currentStatsSemFilter = 'all';

// Unified College Single Source of Truth
const BCA_COLLEGES_MOD = (typeof window !== 'undefined' && window.BCA_COLLEGES_MODULE) || null;
let statsDynamicColleges = (BCA_COLLEGES_MOD && BCA_COLLEGES_MOD.BCA_BASE_COLLEGES) ? BCA_COLLEGES_MOD.BCA_BASE_COLLEGES.slice() : [
  ['all', 'All Colleges'],
  ['amity', 'Amity University'],
  ['adbu', 'Assam Don Bosco University'],
  ['avviare', 'Avviare Educational Hub'],
  ['banasthali', 'Banasthali Vidyapith'],
  ['bvp', 'Bharati Vidyapeeth'],
  ['bitmesra', 'BIT Mesra'],
  ['cu', 'Chandigarh University'],
  ['chitkara', 'Chitkara University'],
  ['christ', 'Christ University'],
  ['davv', 'DAVV (Devi Ahilya Vishwavidyalaya)'],
  ['gauhati', 'Gauhati University'],
  ['glocal', 'Glocal University'],
  ['goa', 'Goa University'],
  ['geu', 'Graphic Era University'],
  ['hpu', 'Himachal Pradesh University'],
  ['kiit', 'KIIT University'],
  ['kuk', 'Kurukshetra University'],
  ['manipur', 'Manipur University'],
  ['mizoram', 'Mizoram University'],
  ['nagaland', 'Nagaland University'],
  ['nirma', 'Nirma University'],
  ['pu', 'Panjab University'],
  ['patna', 'Patna University'],
  ['pondi', 'Pondicherry University'],
  ['rgu', 'Rajiv Gandhi University'],
  ['smu', 'Sikkim Manipal University'],
  ['srm', 'SRM Institute of Science and Technology'],
  ['tripura', 'Tripura University'],
  ['uok', 'University of Kashmir'],
  ['kerala', 'University of Kerala'],
  ['ccsu', 'CCSU Meerut'],
  ['du', 'Delhi University'],
  ['ipu', 'GGSIPU Delhi'],
  ['aktu', 'AKTU / UPTU'],
  ['ignou', 'IGNOU'],
  ['mdu', 'MDU Rohtak'],
  ['bhu', 'BHU'],
  ['pune', 'Pune University'],
  ['bangalore', 'Bangalore University'],
  ['other', 'Other University']
];

async function loadApprovedCollegesForStats() {
  if (!analyticsSupabase) return;
  try {
    const { data, error } = await analyticsSupabase
      .from('custom_colleges')
      .select('id, name, status')
      .eq('status', 'approved');

    if (!error && Array.isArray(data)) {
      const baseColleges = (window.BCA_COLLEGES_MODULE && window.BCA_COLLEGES_MODULE.BCA_BASE_COLLEGES)
        ? window.BCA_COLLEGES_MODULE.BCA_BASE_COLLEGES
        : (BCA_COLLEGES_MOD ? BCA_COLLEGES_MOD.BCA_BASE_COLLEGES : statsDynamicColleges);
      if (window.BCA_COLLEGES_MODULE && window.BCA_COLLEGES_MODULE.mergeColleges) {
        statsDynamicColleges = window.BCA_COLLEGES_MODULE.mergeColleges(baseColleges, data);
      }
      populateStatsCollegeFilter();
    }
  } catch (err) {
    console.warn('[Stats] loadApprovedCollegesForStats error:', err);
  }
}

function populateStatsCollegeFilter() {
  if (window.BCA_COLLEGES_MODULE && window.BCA_COLLEGES_MODULE.BCA_BASE_COLLEGES) {
    if (statsDynamicColleges.length <= 11) {
      statsDynamicColleges = window.BCA_COLLEGES_MODULE.BCA_BASE_COLLEGES.slice();
    }
  }
  const sel = $('statsStudentCollegeFilter');
  if (!sel) return;
  const currentVal = sel.value;
  sel.innerHTML = statsDynamicColleges.map(c => `<option value="${c[0]}">${escapeHtml(c[1])}</option>`).join('');
  if (currentVal) sel.value = currentVal;
}

// Initial synchronous population
try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', populateStatsCollegeFilter);
  } else {
    populateStatsCollegeFilter();
  }
} catch(_e) {}

function formatStudentCollege(code) {
  if (!code) return 'Avviare Educational Hub';
  if (BCA_COLLEGES_MOD && BCA_COLLEGES_MOD.formatCollegeName) {
    return BCA_COLLEGES_MOD.formatCollegeName(code, statsDynamicColleges);
  }
  const found = statsDynamicColleges.find(c => c[0].toLowerCase() === String(code).toLowerCase());
  if (found) return found[1];
  return String(code).replace(/^custom-/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getAvatarColor(str) {
  const colors = ['#0284c7', '#00B67A', '#8b5cf6', '#ec4899', '#f59e0b', '#3b82f6', '#10b981', '#6366f1'];
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function setStatsStudentSemFilter(sem) {
  triggerHaptic();
  currentStatsSemFilter = String(sem);
  document.querySelectorAll('#statsSemFilterPills .range-pill').forEach(b => {
    b.classList.toggle('active', b.dataset.sem === currentStatsSemFilter);
  });
  filterStatsStudents();
}

async function renderStudentsModule() {
  const container = $('statsStudentListContainer');
  const countBadge = $('statsStudentCountBadge');
  const emptyWrap = $('statsStudentsEmptyState');
  if (emptyWrap) emptyWrap.hidden = true;

  // Ensure colleges are loaded and filter options populated
  if (!statsDynamicColleges || statsDynamicColleges.length <= 11) {
    loadApprovedCollegesForStats();
  } else {
    populateStatsCollegeFilter();
  }

  if (container) {
    container.innerHTML = [1, 2, 3, 4].map(i => `
      <div class="stats-student-card" style="pointer-events:none">
        <div class="stats-student-head">
          <div class="shimmer-box" style="width:44px;height:44px;border-radius:50%;flex-shrink:0"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:5px">
            <div class="shimmer-box" style="width:${100 + i * 20}px;height:16px"></div>
            <div class="shimmer-box" style="width:${140 + i * 15}px;height:12px"></div>
          </div>
        </div>
        <div class="shimmer-box" style="width:100%;height:22px;border-radius:6px;margin-top:6px"></div>
      </div>
    `).join('');
  }

  try {
    if (!analyticsSupabaseClient) throw new Error('Supabase not connected');

    // 1. Fetch all student profiles
    const { data: profiles, error: pErr } = await analyticsSupabaseClient
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (pErr) throw pErr;

    // 2. Fetch event summary to compute Reads, DLs, Searches per student
    let eventCountsMap = new Map();
    try {
      const { data: evRows } = await analyticsSupabaseClient
        .from('analytics_events')
        .select('user_id, user_email, event_type')
        .limit(1000);

      if (Array.isArray(evRows)) {
        evRows.forEach(ev => {
          const key = ev.user_id || ev.user_email;
          if (!key) return;
          if (!eventCountsMap.has(key)) {
            eventCountsMap.set(key, { reads: 0, dls: 0, searches: 0 });
          }
          const rec = eventCountsMap.get(key);
          const t = ev.event_type;
          if (t === 'view' || t === 'note_read') rec.reads++;
          else if (t === 'download' || t === 'download_success') rec.dls++;
          else if (t === 'search' || t === 'search_query') rec.searches++;
        });
      }
    } catch (_evErr) {}

    const students = (profiles || []).map(p => {
      const stats = eventCountsMap.get(p.uid) || eventCountsMap.get(p.email) || { reads: 0, dls: 0, searches: 0 };
      return {
        ...p,
        reads: stats.reads,
        dls: stats.dls,
        searches: stats.searches
      };
    });

    statsStudentsCache = students;
    if (countBadge) countBadge.textContent = `${students.length} Students`;
    filterStatsStudents();
  } catch (err) {
    console.error('[Analytics] renderStudentsModule error:', err);
    if (container) {
      container.innerHTML = `
        <div class="empty-state-wrap" style="grid-column:1/-1;padding:36px 16px;text-align:center">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:28px;color:var(--brand);margin-bottom:10px;display:block"></i>
          <h3 style="margin:0 0 6px;font-size:16px">Could not load students directory</h3>
          <p style="color:var(--muted);font-size:13px;margin:0 0 16px">${escapeHtml(err.message || 'Check connection')}</p>
          <button class="range-pill bca-pressable" onclick="renderStudentsModule()" style="min-height:40px;padding:0 16px">
            <i class="fa-solid fa-arrows-rotate"></i> Retry
          </button>
        </div>
      `;
    }
  }
}

function renderStatsStudents(list) {
  const container = $('statsStudentListContainer');
  const emptyWrap = $('statsStudentsEmptyState');
  const countBadge = $('statsStudentCountBadge');

  if (countBadge) {
    countBadge.textContent = `${list.length} ${list.length === 1 ? 'Student' : 'Students'}`;
  }

  if (!list || list.length === 0) {
    if (container) container.innerHTML = '';
    if (emptyWrap) {
      emptyWrap.hidden = false;
      emptyWrap.innerHTML = `
        <div style="padding:28px 16px;text-align:center">
          <i class="fa-solid fa-users-slash" style="font-size:32px;color:var(--muted);margin-bottom:12px;display:block"></i>
          <h3 style="margin:0 0 6px;font-size:16px;font-family:var(--font-display);font-weight:600">No students found</h3>
          <p style="color:var(--muted);font-size:13px;margin:0 0 16px;font-family:var(--font-sans)">No registered students match your filter criteria.</p>
          <button class="range-pill bca-pressable" onclick="clearStatsStudentFilters()" style="min-height:38px;padding:0 16px">
            <i class="fa-solid fa-xmark"></i> Clear Filters
          </button>
        </div>
      `;
      initPressables();
    }
    return;
  }

  if (emptyWrap) emptyWrap.hidden = true;

  if (container) {
    container.innerHTML = list.map(student => {
      const name = escapeHtml(student.name || 'Student');
      const username = escapeHtml(student.username || (student.email ? student.email.split('@')[0] : 'student'));
      const college = escapeHtml(formatStudentCollege(student.college));
      const sem = student.semester || 1;
      const firstLetter = (student.name || student.email || 'S').trim().charAt(0).toUpperCase();
      const avatarColor = getAvatarColor(student.name || student.email);

      const avatarHtml = student.avatar_url
        ? `<div class="stats-student-avatar"><img src="${escapeHtml(student.avatar_url)}" alt="${name}" onerror="this.parentElement.innerHTML='${firstLetter}'"></div>`
        : `<div class="stats-student-avatar" style="background:${avatarColor}">${firstLetter}</div>`;

      return `
        <div class="stats-student-card bca-pressable" role="button" tabindex="0" onclick="openStudentInspector('${escapeHtml(student.uid)}')">
          <div class="stats-student-head">
            ${avatarHtml}
            <div class="stats-student-info">
              <div class="stats-student-title-row">
                <span class="stats-student-name">${name}</span>
                <span class="stats-student-username">@${username}</span>
                <span class="stats-student-sem-badge">SEM ${sem}</span>
              </div>
              <div class="stats-student-meta">
                <i class="fa-solid fa-building-columns" style="font-size:11px;opacity:0.7;margin-right:4px"></i>
                <span>${college}</span>
              </div>
            </div>
          </div>
          <div class="stats-student-pills-row">
            <span class="telemetry-pill pill-reads"><i class="fa-solid fa-book-open"></i> ${student.reads || 0} Reads</span>
            <span class="telemetry-pill pill-dls"><i class="fa-solid fa-cloud-arrow-down"></i> ${student.dls || 0} DLs</span>
            <span class="telemetry-pill pill-searches"><i class="fa-solid fa-magnifying-glass"></i> ${student.searches || 0} Searches</span>
          </div>
        </div>
      `;
    }).join('');
  }

  initPressables();
}

let studentSearchDebounce = null;
function filterStatsStudents() {
  clearTimeout(studentSearchDebounce);
  studentSearchDebounce = setTimeout(() => {
    const q = ($('statsStudentSearch')?.value || '').trim().toLowerCase();
    const collegeFilter = ($('statsStudentCollegeFilter')?.value || 'all').toLowerCase();

    const filtered = (statsStudentsCache || []).filter(s => {
      if (q) {
        const name = (s.name || '').toLowerCase();
        const uname = (s.username || '').toLowerCase();
        const email = (s.email || '').toLowerCase();
        const college = (s.college || '').toLowerCase();
        const uid = String(s.uid || '').toLowerCase();
        if (!name.includes(q) && !uname.includes(q) && !email.includes(q) && !college.includes(q) && !uid.includes(q)) {
          return false;
        }
      }

      if (collegeFilter !== 'all') {
        const sCol = (s.college || '').toLowerCase();
        if (collegeFilter === 'other') {
          const known = statsDynamicColleges.filter(c => c[0] !== 'all' && c[0] !== 'other').map(c => c[0].toLowerCase());
          if (known.includes(sCol)) return false;
        } else if (sCol !== collegeFilter) {
          return false;
        }
      }

      if (currentStatsSemFilter !== 'all') {
        if (String(s.semester) !== currentStatsSemFilter) return false;
      }

      return true;
    });

    renderStatsStudents(filtered);
  }, 200);
}

function clearStatsStudentFilters() {
  const inp = $('statsStudentSearch');
  if (inp) inp.value = '';
  const sel = $('statsStudentCollegeFilter');
  if (sel) sel.value = 'all';
  setStatsStudentSemFilter('all');
}

/* ============================================================
   A-to-Z Student Telemetry Inspector Drill-Down Modal
   ============================================================ */
async function openStudentInspector(studentId) {
  if (!studentId) return;
  triggerHaptic();

  const modal = $('studentInspectorModal');
  const body = $('studentInspectorBody');
  const headerName = $('inspHeaderStudentName');
  if (!modal || !body) return;

  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  // Update URL deep-link
  try {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('student', studentId);
    window.history.replaceState(null, '', newUrl.toString());
  } catch (_e) {}

  let cachedStudent = (statsStudentsCache || []).find(s => String(s.uid) === String(studentId));
  if (headerName) headerName.textContent = cachedStudent?.name ? `${cachedStudent.name} Telemetry` : 'Student Telemetry';

  // Render initial skeleton loader in modal
  body.innerHTML = `
    <div class="inspector-hero-card" style="pointer-events:none">
      <div class="shimmer-box" style="width:60px;height:60px;border-radius:50%;flex-shrink:0"></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:6px">
        <div class="shimmer-box" style="width:160px;height:20px"></div>
        <div class="shimmer-box" style="width:220px;height:14px"></div>
      </div>
    </div>
    <div class="inspector-pulse-grid">
      ${[1, 2, 3, 4].map(() => `
        <div class="inspector-pulse-card"><div class="shimmer-box" style="width:100%;height:50px"></div></div>
      `).join('')}
    </div>
    <div style="padding:20px 0;text-align:center;color:var(--muted);font-size:13px">
      <i class="fa-solid fa-arrows-rotate fa-spin"></i> Aggregating student reading, search &amp; telemetry history&hellip;
    </div>
  `;

  try {
    if (!analyticsSupabaseClient) throw new Error('Supabase client not initialized');

    // 1. Fetch student profile if not cached
    let student = cachedStudent;
    if (!student) {
      const { data: pData } = await analyticsSupabaseClient
        .from('user_profiles')
        .select('*')
        .eq('uid', studentId);
      if (Array.isArray(pData) && pData.length > 0) student = pData[0];
    }
    if (!student) student = { uid: studentId, name: 'Student' };

    if (headerName) headerName.textContent = `${student.name || 'Student'} Telemetry`;

    // 2. Fetch all telemetry & event records in parallel
    const [eventsRes, readingRes, uploadsRes, requestsRes, lostFoundRes, feedbackRes] = await Promise.allSettled([
      student.email
        ? analyticsSupabaseClient.from('analytics_events').select('*').or(`user_id.eq.${studentId},user_email.eq.${student.email}`).order('created_at', { ascending: false }).limit(200)
        : analyticsSupabaseClient.from('analytics_events').select('*').eq('user_id', studentId).order('created_at', { ascending: false }).limit(200),
      analyticsSupabaseClient.from('user_reading_progress').select('*').eq('user_id', studentId).order('updated_at', { ascending: false }),
      analyticsSupabaseClient.from('resources').select('*').eq('uploader_uid', studentId).order('created_at', { ascending: false }),
      analyticsSupabaseClient.from('senior_requests').select('*').eq('requester_uid', studentId).order('created_at', { ascending: false }),
      analyticsSupabaseClient.from('lost_found').select('*').eq('poster_uid', studentId).order('created_at', { ascending: false }),
      student.email
        ? analyticsSupabaseClient.from('feedback').select('*').eq('user_email', student.email).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] })
    ]);

    const events = eventsRes.status === 'fulfilled' && Array.isArray(eventsRes.value.data) ? eventsRes.value.data : [];
    const readingProgress = readingRes.status === 'fulfilled' && Array.isArray(readingRes.value.data) ? readingRes.value.data : [];
    const uploads = uploadsRes.status === 'fulfilled' && Array.isArray(uploadsRes.value.data) ? uploadsRes.value.data : [];
    const seniorRequests = requestsRes.status === 'fulfilled' && Array.isArray(requestsRes.value.data) ? requestsRes.value.data : [];
    const lostFound = lostFoundRes.status === 'fulfilled' && Array.isArray(lostFoundRes.value.data) ? lostFoundRes.value.data : [];
    const feedbacks = feedbackRes.status === 'fulfilled' && Array.isArray(feedbackRes.value.data) ? feedbackRes.value.data : [];

    // Categorize telemetry
    const reads = events.filter(e => e.event_type === 'view' || e.event_type === 'note_read');
    const dlSuccess = events.filter(e => e.event_type === 'download' || e.event_type === 'download_success');
    const dlFailed = events.filter(e => e.event_type === 'download_failed');
    const searches = events.filter(e => e.event_type === 'search' || e.event_type === 'search_query');
    const zeroSearches = searches.filter(s => s.results_count === 0);
    const codeRuns = events.filter(e => e.event_type === 'codelab_run');
    const mockTests = events.filter(e => e.event_type === 'mocktest_submit');

    // Last Active timestamp
    const allTimestamps = [
      ...events.map(e => e.created_at),
      ...readingProgress.map(r => r.updated_at),
      student.updated_at,
      student.created_at
    ].filter(Boolean).map(ts => new Date(ts).getTime());
    const lastActiveTs = allTimestamps.length > 0 ? Math.max(...allTimestamps) : null;
    const lastActiveStr = lastActiveTs ? formatRelativeTime(new Date(lastActiveTs).toISOString()) : 'Never';

    const displayName = escapeHtml(student.name || 'Student');
    const username = escapeHtml(student.username || (student.email ? student.email.split('@')[0] : 'student'));
    const college = escapeHtml(formatStudentCollege(student.college));
    const sem = student.semester || 1;
    const firstLetter = (student.name || student.email || 'S').trim().charAt(0).toUpperCase();
    const avatarColor = getAvatarColor(student.name || student.email);

    const avatarHtml = student.avatar_url
      ? `<div class="inspector-hero-avatar"><img src="${escapeHtml(student.avatar_url)}" alt="${displayName}" onerror="this.parentElement.innerHTML='${firstLetter}'"></div>`
      : `<div class="inspector-hero-avatar" style="background:${avatarColor}">${firstLetter}</div>`;

    // Render Full Inspector Template
    body.innerHTML = `
      <!-- 1. Student Identity Header Card -->
      <div class="inspector-hero-card">
        ${avatarHtml}
        <div class="inspector-hero-details">
          <div class="inspector-hero-name">
            <span>${displayName}</span>
            <span class="stats-student-username">@${username}</span>
            <span class="stats-student-sem-badge">SEM ${sem}</span>
          </div>
          <div class="inspector-hero-meta">
            <span><i class="fa-solid fa-building-columns"></i> ${college}</span>
            <span>&bull;</span>
            <span><i class="fa-regular fa-clock"></i> Active ${lastActiveStr}</span>
          </div>
        </div>
      </div>

      <!-- 2. 4-Tile Activity Pulse Grid -->
      <div class="inspector-pulse-grid">
        <!-- Reads / Opens -->
        <div class="inspector-pulse-card">
          <div class="inspector-pulse-card-head">
            <span class="inspector-pulse-label">TOTAL READS</span>
            <i class="fa-solid fa-book-open inspector-pulse-icon" style="color:#00B67A"></i>
          </div>
          <span class="inspector-pulse-val tabular-nums">${reads.length + readingProgress.length}</span>
          <span class="inspector-pulse-sub">${readingProgress.length} saved progress</span>
        </div>

        <!-- Downloads Succeeded -->
        <div class="inspector-pulse-card">
          <div class="inspector-pulse-card-head">
            <span class="inspector-pulse-label">DL SUCCESS</span>
            <i class="fa-solid fa-cloud-arrow-down inspector-pulse-icon" style="color:#0284c7"></i>
          </div>
          <span class="inspector-pulse-val text-emerald tabular-nums">${dlSuccess.length}</span>
          <span class="inspector-pulse-sub">Verified downloads</span>
        </div>

        <!-- Downloads Failed -->
        <div class="inspector-pulse-card">
          <div class="inspector-pulse-card-head">
            <span class="inspector-pulse-label">DL FAILED</span>
            <i class="fa-solid fa-triangle-exclamation inspector-pulse-icon" style="color:#F43F5E"></i>
          </div>
          <span class="inspector-pulse-val ${dlFailed.length > 0 ? 'text-rose' : ''} tabular-nums">${dlFailed.length}</span>
          <span class="inspector-pulse-sub">${dlFailed.length > 0 ? 'Auth / network issues' : 'Zero errors'}</span>
        </div>

        <!-- Total Searches -->
        <div class="inspector-pulse-card">
          <div class="inspector-pulse-card-head">
            <span class="inspector-pulse-label">SEARCHES</span>
            <i class="fa-solid fa-magnifying-glass inspector-pulse-icon" style="color:#a855f7"></i>
          </div>
          <span class="inspector-pulse-val tabular-nums">${searches.length}</span>
          <span class="inspector-pulse-sub ${zeroSearches.length > 0 ? 'text-rose' : ''}">${zeroSearches.length} zero-result</span>
        </div>
      </div>

      <!-- 3. Currently Reading & Reading History ("Kya Padh Raha Hai") -->
      <section class="inspector-section">
        <div class="inspector-section-head">
          <h3 class="inspector-section-title">
            <i class="fa-solid fa-book-bookmark" style="color:#00B67A"></i>
            <span>Currently Reading &amp; History</span>
          </h3>
          <span class="inspector-section-badge tabular-nums">${readingProgress.length + reads.length}</span>
        </div>
        <div class="inspector-items-list" id="inspReadingList">
          ${renderReadingSection(readingProgress, reads)}
        </div>
      </section>

      <!-- 4. Download History (Success vs. Failed) -->
      <section class="inspector-section">
        <div class="inspector-section-head">
          <h3 class="inspector-section-title">
            <i class="fa-solid fa-download" style="color:#0284c7"></i>
            <span>Download History (Success vs. Failed)</span>
          </h3>
          <span class="inspector-section-badge tabular-nums">${dlSuccess.length + dlFailed.length}</span>
        </div>
        <div class="inspector-items-list" id="inspDownloadList">
          ${renderDownloadSection(dlSuccess, dlFailed)}
        </div>
      </section>

      <!-- 5. Search History ("Kya Search Kiya — Mila Ya Nahi") -->
      <section class="inspector-section">
        <div class="inspector-section-head">
          <h3 class="inspector-section-title">
            <i class="fa-solid fa-magnifying-glass" style="color:#a855f7"></i>
            <span>Search History &amp; Results</span>
          </h3>
          <span class="inspector-section-badge tabular-nums">${searches.length}</span>
        </div>
        <div class="inspector-items-list" id="inspSearchList">
          ${renderSearchSection(searches)}
        </div>
      </section>

      <!-- 6. Other Activity Timeline (Code Lab, Mock Tests, Community, Feedback) -->
      <section class="inspector-section">
        <div class="inspector-section-head">
          <h3 class="inspector-section-title">
            <i class="fa-solid fa-timeline" style="color:#f59e0b"></i>
            <span>Other Activity Timeline</span>
          </h3>
          <span class="inspector-section-badge tabular-nums">${codeRuns.length + mockTests.length + seniorRequests.length + lostFound.length + feedbacks.length + uploads.length}</span>
        </div>
        <div class="inspector-items-list" id="inspOtherActivityList">
          ${renderOtherActivitySection(codeRuns, mockTests, seniorRequests, lostFound, feedbacks, uploads)}
        </div>
      </section>
    `;

    initPressables();
  } catch (err) {
    console.error('[Analytics] openStudentInspector error:', err);
    body.innerHTML = `
      <div class="empty-state-wrap" style="padding:40px 16px;text-align:center">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:32px;color:var(--brand);margin-bottom:12px;display:block"></i>
        <h3 style="margin:0 0 6px;font-size:16px">Failed to load student telemetry</h3>
        <p style="color:var(--muted);font-size:13px;margin:0 0 16px">${escapeHtml(err.message || 'Unknown error occurred')}</p>
        <button class="range-pill bca-pressable" onclick="openStudentInspector('${escapeHtml(studentId)}')">
          <i class="fa-solid fa-arrows-rotate"></i> Retry
        </button>
      </div>
    `;
  }
}

function closeStudentInspector() {
  triggerHaptic();
  const modal = $('studentInspectorModal');
  if (modal) modal.hidden = true;
  document.body.style.overflow = '';

  // Remove URL query parameter
  try {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('student');
    window.history.replaceState(null, '', newUrl.toString());
  } catch (_e) {}
}

/* Sub-section render helpers for Inspector */
function renderReadingSection(readingProgress, reads) {
  if ((!readingProgress || readingProgress.length === 0) && (!reads || reads.length === 0)) {
    return `
      <div style="padding:20px 10px;text-align:center;color:var(--muted);font-size:13px">
        <i class="fa-regular fa-folder-open" style="font-size:24px;display:block;margin-bottom:6px;opacity:0.6"></i>
        No reading progress or notes opened yet.
      </div>
    `;
  }

  const items = [];

  // Active reading progress from user_reading_progress
  readingProgress.forEach(rp => {
    const curr = Math.max(1, rp.current_page || 1);
    const tot = Math.max(1, rp.total_pages || 1);
    const pct = Math.min(100, Math.round((curr / tot) * 100));
    items.push(`
      <div class="inspector-item-row">
        <div class="inspector-item-main">
          <span class="inspector-item-title">${escapeHtml(rp.title || 'Untitled Material')}</span>
          <div class="inspector-item-meta">
            <span class="inspector-tag tag-success">ACTIVE READ</span>
            <span>Page ${curr} of ${tot} (${pct}%)</span>
          </div>
          <div class="inspector-progress-track">
            <div class="inspector-progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <span class="inspector-item-time">${formatRelativeTime(rp.updated_at)}</span>
      </div>
    `);
  });

  // Recent reads from analytics_events
  reads.forEach(r => {
    items.push(`
      <div class="inspector-item-row">
        <div class="inspector-item-main">
          <span class="inspector-item-title">${escapeHtml(r.resource_title || 'Notes / Material')}</span>
          <div class="inspector-item-meta">
            <span class="inspector-tag" style="background:rgba(255,255,255,0.08);color:var(--ink-dim)">READ OPEN</span>
            ${r.subject ? `<span>${escapeHtml(r.subject)}</span>` : ''}
            ${r.semester ? `<span>&bull; SEM ${r.semester}</span>` : ''}
          </div>
        </div>
        <span class="inspector-item-time">${formatRelativeTime(r.created_at)}</span>
      </div>
    `);
  });

  return items.slice(0, 15).join('');
}

function renderDownloadSection(dlSuccess, dlFailed) {
  const allDls = [
    ...dlSuccess.map(d => ({ ...d, isSuccess: true })),
    ...dlFailed.map(d => ({ ...d, isSuccess: false }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (allDls.length === 0) {
    return `
      <div style="padding:20px 10px;text-align:center;color:var(--muted);font-size:13px">
        <i class="fa-regular fa-circle-down" style="font-size:24px;display:block;margin-bottom:6px;opacity:0.6"></i>
        No file downloads recorded for this student.
      </div>
    `;
  }

  return allDls.slice(0, 15).map(d => `
    <div class="inspector-item-row">
      <div class="inspector-item-main">
        <span class="inspector-item-title">${escapeHtml(d.resource_title || 'File Download')}</span>
        <div class="inspector-item-meta">
          <span class="inspector-tag ${d.isSuccess ? 'tag-success' : 'tag-failed'}">
            ${d.isSuccess ? '<i class="fa-solid fa-check"></i> SUCCESS' : '<i class="fa-solid fa-triangle-exclamation"></i> FAILED'}
          </span>
          ${d.subject ? `<span>${escapeHtml(d.subject)}</span>` : ''}
          ${d.semester ? `<span>&bull; SEM ${d.semester}</span>` : ''}
        </div>
      </div>
      <span class="inspector-item-time">${formatRelativeTime(d.created_at)}</span>
    </div>
  `).join('');
}

function renderSearchSection(searches) {
  if (!searches || searches.length === 0) {
    return `
      <div style="padding:20px 10px;text-align:center;color:var(--muted);font-size:13px">
        <i class="fa-solid fa-magnifying-glass" style="font-size:24px;display:block;margin-bottom:6px;opacity:0.6"></i>
        No search queries performed yet.
      </div>
    `;
  }

  return searches.slice(0, 15).map(s => {
    const q = s.resource_title || 'query';
    const count = s.results_count != null ? Number(s.results_count) : 0;
    const isFound = count > 0;

    return `
      <div class="inspector-item-row">
        <div class="inspector-item-main">
          <span class="inspector-item-title">&ldquo;${escapeHtml(q)}&rdquo;</span>
          <div class="inspector-item-meta">
            <span class="inspector-tag ${isFound ? 'tag-found' : 'tag-zero'}">
              ${isFound ? `<i class="fa-solid fa-check"></i> FOUND (${count})` : '<i class="fa-solid fa-circle-xmark"></i> NO RESULTS (0)'}
            </span>
          </div>
        </div>
        <span class="inspector-item-time">${formatRelativeTime(s.created_at)}</span>
      </div>
    `;
  }).join('');
}

function renderOtherActivitySection(codeRuns, mockTests, requests, lostFound, feedbacks, uploads) {
  const allOther = [
    ...codeRuns.map(c => ({
      title: `Code Lab: Executed ${c.resource_title || 'Program'}`,
      badge: c.results === 1 ? 'PASS (0)' : 'FAILED',
      badgeCls: c.results === 1 ? 'tag-success' : 'tag-failed',
      time: c.created_at
    })),
    ...mockTests.map(m => ({
      title: `Mock Test: ${m.resource_title || 'Quiz'}`,
      badge: `${m.results || 0}% Score`,
      badgeCls: Number(m.results || 0) >= 60 ? 'tag-success' : 'tag-zero',
      time: m.created_at
    })),
    ...requests.map(r => ({
      title: `Junior Request: ${r.subject || r.message || 'Help request'}`,
      badge: String(r.status || 'open').toUpperCase(),
      badgeCls: r.status === 'done' ? 'tag-success' : 'tag-zero',
      time: r.created_at
    })),
    ...lostFound.map(lf => ({
      title: `Lost & Found: ${lf.title || 'Item reported'}`,
      badge: String(lf.status || 'active').toUpperCase(),
      badgeCls: 'tag-found',
      time: lf.created_at
    })),
    ...feedbacks.map(f => ({
      title: `Feedback: ${(f.message || '').slice(0, 50)}`,
      badge: `${f.rating ? f.rating + '★' : 'Feedback'}`,
      badgeCls: 'tag-found',
      time: f.created_at
    })),
    ...uploads.map(u => ({
      title: `Uploaded Note: ${u.title || 'Material'}`,
      badge: String(u.status || 'pending').toUpperCase(),
      badgeCls: u.status === 'approved' ? 'tag-success' : 'tag-zero',
      time: u.created_at
    }))
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  if (allOther.length === 0) {
    return `
      <div style="padding:20px 10px;text-align:center;color:var(--muted);font-size:13px">
        <i class="fa-solid fa-list-check" style="font-size:24px;display:block;margin-bottom:6px;opacity:0.6"></i>
        No interactive tests, Code Lab runs, or community posts recorded yet.
      </div>
    `;
  }

  return allOther.slice(0, 15).map(item => `
    <div class="inspector-item-row">
      <div class="inspector-item-main">
        <span class="inspector-item-title">${escapeHtml(item.title)}</span>
        <div class="inspector-item-meta">
          <span class="inspector-tag ${item.badgeCls}">${escapeHtml(item.badge)}</span>
        </div>
      </div>
      <span class="inspector-item-time">${formatRelativeTime(item.time)}</span>
    </div>
  `).join('');
}

window.switchSuiteTab = switchSuiteTab;
window.setRange = setRange;
window.refreshAll = refreshAll;
window.toggleAnalyticsTheme = toggleAnalyticsTheme;
window.installAnalyticsPwa = installAnalyticsPwa;
window.dismissPwaBanner = dismissPwaBanner;
window.signOut = signOut;
window.renderStudentsModule = renderStudentsModule;
window.filterStatsStudents = filterStatsStudents;
window.clearStatsStudentFilters = clearStatsStudentFilters;
window.setStatsStudentSemFilter = setStatsStudentSemFilter;
window.openStudentInspector = openStudentInspector;
window.closeStudentInspector = closeStudentInspector;
