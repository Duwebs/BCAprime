/* ============================================================
   BCAPrime Admin — admin.js
   Supabase-backed moderation panel
   ============================================================ */

const STORAGE_KEY = 'bca-uploads';

/* ---- Fallback demo data (used only when Supabase is not configured) ---- */
const demoUploads = [
  { id: 'demo-1', title: 'DBMS Unit 2 Revision Notes', type: 'notes', sem: 3, year: 2, subject: 'Database Management Systems', college: 'amity', fileName: 'dbms-unit-2.pdf', status: 'approved' },
  { id: 'demo-2', title: 'Operating Systems PYQ 2024', type: 'pyq', sem: 6, year: 3, subject: 'Operating Systems', college: 'avviare', fileName: 'os-pyq-2024.pdf', status: 'approved' },
  { id: 'demo-3', title: 'C Programming Crash Notes', type: 'notes', sem: 1, year: 1, subject: 'Programming Principles & C', college: 'all', fileName: 'c-programming-notes.pdf', status: 'approved' }
];

// Unified College Single Source of Truth
const BCA_COLLEGES_MOD = (typeof window !== 'undefined' && window.BCA_COLLEGES_MODULE) || {
  BCA_BASE_COLLEGES: [
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
    ['kerala', 'University of Kerala']
  ],
  COLLEGE_NAMES_MAP: {},
  mergeColleges: function(b, c) { return b; },
  formatCollegeName: function(id) { return id || 'All Colleges'; }
};

let dynamicCollegesList = (window.BCA_COLLEGES_MODULE && window.BCA_COLLEGES_MODULE.BCA_BASE_COLLEGES)
  ? window.BCA_COLLEGES_MODULE.BCA_BASE_COLLEGES.slice()
  : BCA_COLLEGES_MOD.BCA_BASE_COLLEGES.slice();
const collegeNames = new Proxy({}, {
  get: function(target, prop) {
    if (typeof prop === 'string') {
      const found = dynamicCollegesList.find(c => c[0].toLowerCase() === prop.toLowerCase());
      if (found) return found[1];
      if (BCA_COLLEGES_MOD.COLLEGE_NAMES_MAP && BCA_COLLEGES_MOD.COLLEGE_NAMES_MAP[prop]) {
        return BCA_COLLEGES_MOD.COLLEGE_NAMES_MAP[prop];
      }
      return prop === 'all' ? 'All Colleges' : prop;
    }
    return target[prop];
  }
});

let customCollegesQueue = [];
let approvedCollegesSearchQuery = '';

async function loadApprovedCustomCollegesAdmin() {
  const queueHost = $('collegeApprovalsQueue');
  const approvedHost = $('approvedCollegesList');

  if (queueHost && !customCollegesQueue.length) {
    queueHost.innerHTML = '<p class="note" style="padding:16px 0;"><i class="fa-solid fa-spinner fa-spin"></i> Loading college approvals&hellip;</p>';
  }
  if (approvedHost && !approvedHost.innerHTML.trim()) {
    approvedHost.innerHTML = '<p class="note" style="padding:16px 0;"><i class="fa-solid fa-spinner fa-spin"></i> Loading active colleges directory&hellip;</p>';
  }

  if (typeof adminSupabaseClient === 'undefined' || !adminSupabaseClient) {
    if (queueHost) {
      queueHost.innerHTML = `
        <div style="padding:16px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:12px;color:var(--danger,#ef4444);font-size:13px;display:flex;align-items:center;gap:12px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:18px;"></i>
          <div>
            <strong style="display:block;font-size:14px;margin-bottom:2px;">Supabase is not configured or session is missing</strong>
            <span style="font-size:12px;opacity:0.85;">Please verify your Supabase configuration or login credentials.</span>
          </div>
        </div>
      `;
    }
    renderApprovedCollegesAdmin();
    return;
  }

  try {
    const { data, error } = await adminSupabaseClient
      .from('custom_colleges')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Admin] custom_colleges query error:', error);
      if (queueHost) {
        queueHost.innerHTML = `
          <div style="padding:16px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:12px;color:var(--danger,#ef4444);font-size:13px;display:flex;align-items:center;gap:12px;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:18px;"></i>
            <div>
              <strong style="display:block;font-size:14px;margin-bottom:2px;">Could not fetch college requests</strong>
              <span style="font-size:12px;opacity:0.85;">${escapeHtml(error.message || 'Database error occurred')}</span>
            </div>
          </div>
        `;
      }
      renderApprovedCollegesAdmin();
      return;
    }

    customCollegesQueue = Array.isArray(data) ? data : [];
    const approved = customCollegesQueue.filter(c => c.status === 'approved' || c.is_approved === true);
    const baseColleges = (window.BCA_COLLEGES_MODULE && window.BCA_COLLEGES_MODULE.BCA_BASE_COLLEGES)
      ? window.BCA_COLLEGES_MODULE.BCA_BASE_COLLEGES
      : BCA_COLLEGES_MOD.BCA_BASE_COLLEGES;

    if (window.BCA_COLLEGES_MODULE && window.BCA_COLLEGES_MODULE.mergeColleges) {
      dynamicCollegesList = window.BCA_COLLEGES_MODULE.mergeColleges(baseColleges, approved);
    }

    populateAdminCollegeDropdowns();
    updateCollegeBadgeCount();
    renderCustomCollegesAdmin();
    renderApprovedCollegesAdmin();
  } catch (err) {
    console.warn('[Admin] loadApprovedCustomCollegesAdmin exception:', err);
    if (queueHost) {
      queueHost.innerHTML = `
        <div style="padding:16px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:12px;color:var(--danger,#ef4444);font-size:13px;display:flex;align-items:center;gap:12px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:18px;"></i>
          <div>
            <strong style="display:block;font-size:14px;margin-bottom:2px;">Network or connection error</strong>
            <span style="font-size:12px;opacity:0.85;">${escapeHtml(err.message || 'Failed to communicate with Supabase')}</span>
          </div>
        </div>
      `;
    }
    renderApprovedCollegesAdmin();
  }
}

function updateCollegeBadgeCount() {
  const pendingCount = customCollegesQueue.filter(c => c.status === 'pending' || (c.status !== 'approved' && c.status !== 'rejected' && !c.is_approved)).length;
  const badge = $('tabCollegeBadge');
  if (badge) {
    badge.textContent = pendingCount;
    badge.hidden = (pendingCount === 0);
  }
  const pendingBadge = $('collegePendingCountBadge');
  if (pendingBadge) {
    pendingBadge.textContent = `${pendingCount} Pending`;
  }
  const approvedCustom = customCollegesQueue.filter(c => c.status === 'approved' || c.is_approved === true).length;
  const baseColleges = (window.BCA_COLLEGES_MODULE && window.BCA_COLLEGES_MODULE.BCA_BASE_COLLEGES)
    ? window.BCA_COLLEGES_MODULE.BCA_BASE_COLLEGES
    : BCA_COLLEGES_MOD.BCA_BASE_COLLEGES;
  const baseCount = baseColleges.filter(c => c[0] !== 'all').length;
  const approvedBadge = $('collegeApprovedCountBadge');
  if (approvedBadge) {
    approvedBadge.textContent = `${approvedCustom + baseCount} Active`;
  }
}

function populateAdminCollegeDropdowns() {
  if (window.BCA_COLLEGES_MODULE && window.BCA_COLLEGES_MODULE.BCA_BASE_COLLEGES) {
    const baseColleges = window.BCA_COLLEGES_MODULE.BCA_BASE_COLLEGES;
    if (customCollegesQueue.length > 0 && window.BCA_COLLEGES_MODULE.mergeColleges) {
      dynamicCollegesList = window.BCA_COLLEGES_MODULE.mergeColleges(
        baseColleges,
        customCollegesQueue.filter(c => c.status === 'approved' || c.is_approved === true)
      );
    } else if (dynamicCollegesList.length <= 10) {
      dynamicCollegesList = baseColleges.slice();
    }
  }

  // 1. Target College in Push Broadcast
  const notifySelect = $('notifyCollege');
  if (notifySelect) {
    const currentVal = notifySelect.value;
    notifySelect.innerHTML = '<option value="">All colleges (Everyone)</option>' +
      dynamicCollegesList.filter(c => c[0] !== 'all').map(c => `<option value="${c[0]}">${escapeHtml(c[1])}</option>`).join('');
    if (currentVal) notifySelect.value = currentVal;
  }

  // 2. Student Directory College Filter
  const userSelect = $('userCollegeFilter');
  if (userSelect) {
    const currentVal = userSelect.value;
    userSelect.innerHTML = dynamicCollegesList.map(c => `<option value="${c[0]}">${escapeHtml(c[1])}</option>`).join('');
    if (currentVal) userSelect.value = currentVal;
  }

  // 3. Subject Management College Filter & Modal Picker
  const subjSelect = $('subjectCollege');
  if (subjSelect) {
    const currentVal = subjSelect.value;
    subjSelect.innerHTML = dynamicCollegesList.map(c => `<option value="${c[0]}">${escapeHtml(c[1])}</option>`).join('');
    if (currentVal) subjSelect.value = currentVal;
  }
  const subjPick = $('subjectCollegePick');
  if (subjPick) {
    const currentVal = subjPick.value;
    subjPick.innerHTML = dynamicCollegesList.filter(c => c[0] !== 'all').map(c => `<option value="${c[0]}">${escapeHtml(c[1])}</option>`).join('');
    if (currentVal) subjPick.value = currentVal;
  }
}

// Initial synchronous population so dropdowns are never stale
try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', populateAdminCollegeDropdowns);
  } else {
    populateAdminCollegeDropdowns();
  }
} catch(_e) {}

function renderCustomCollegesAdmin() {
  const host = $('collegeApprovalsQueue');
  if (!host) return;

  const pending = customCollegesQueue.filter(c => c.status === 'pending' || (c.status !== 'approved' && c.status !== 'rejected' && !c.is_approved));

  if (pending.length === 0) {
    host.innerHTML = `
      <div class="adm-card" style="padding:28px 20px;text-align:center;border:1px solid var(--line);border-radius:14px;background:var(--surface2);">
        <div style="width:48px;height:48px;border-radius:12px;background:rgba(37,99,235,0.12);color:#2563eb;display:inline-flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:10px;">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <h4 style="margin:0 0 4px;font-size:15px;font-weight:600;color:var(--ink);">No pending college approvals right now</h4>
        <p style="margin:0;font-size:13px;color:var(--muted);">All student-submitted custom college requests have been reviewed.</p>
      </div>
    `;
    return;
  }

  host.innerHTML = pending.map(c => {
    const time = c.created_at ? new Date(c.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'Recently';
    const submitter = c.submitted_by_name || 'Student';

    return `
      <div class="adm-card" style="padding:16px;border:1px solid var(--line);border-radius:14px;background:var(--surface2);margin-bottom:12px;display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div>
            <h3 style="margin:0 0 4px;font-size:16px;font-weight:700;color:var(--ink);">${escapeHtml(c.name)}</h3>
            <div style="font-size:12.5px;color:var(--muted);display:flex;gap:14px;flex-wrap:wrap;">
              <span><i class="fa-solid fa-user" style="margin-right:4px;color:#2563eb;"></i> Submitted by: <b>@${escapeHtml(submitter.replace(/^@/, ''))}</b></span>
              <span><i class="fa-solid fa-clock" style="margin-right:4px;"></i> ${time} IST</span>
            </div>
          </div>
          <span class="adm-pill" style="background:rgba(245,158,11,0.15);color:#d97706;border:1px solid rgba(245,158,11,0.3);font-size:11px;font-weight:700;padding:3px 8px;border-radius:9999px;">PENDING APPROVAL</span>
        </div>

        <div style="display:flex;gap:10px;margin-top:4px;">
          <button type="button" class="button bca-pressable" onclick="approveCustomCollege(${c.id}, this.dataset.name)" data-name="${escapeHtml(c.name)}"
            style="background:#2563eb;border-color:#2563eb;color:#ffffff;font-weight:600;padding:8px 16px;border-radius:9px;cursor:pointer;">
            <i class="fa-solid fa-check"></i> Approve
          </button>
          <button type="button" class="button danger bca-pressable" onclick="rejectCustomCollege(${c.id})"
            style="color:#ef4444;border:1px solid rgba(239,68,68,0.3);background:transparent;padding:8px 16px;border-radius:9px;cursor:pointer;">
            <i class="fa-solid fa-xmark"></i> Reject
          </button>
        </div>
      </div>
    `;
  }).join('');

  initAdminPressables();
}

function renderApprovedCollegesAdmin(searchFilter) {
  const host = $('approvedCollegesList');
  if (!host) return;

  if (typeof searchFilter === 'string') {
    approvedCollegesSearchQuery = searchFilter.trim().toLowerCase();
  }
  const q = approvedCollegesSearchQuery;

  // 1. Approved custom colleges from DB
  const approvedCustom = customCollegesQueue.filter(c => c.status === 'approved' || c.is_approved === true).map(c => ({
    id: c.id,
    code: `custom-${c.id}`,
    name: c.name,
    isCustom: true,
    created_at: c.created_at
  }));

  // 2. Base system colleges from lib/colleges.js
  const baseColleges = ((window.BCA_COLLEGES_MODULE && window.BCA_COLLEGES_MODULE.BCA_BASE_COLLEGES)
    ? window.BCA_COLLEGES_MODULE.BCA_BASE_COLLEGES
    : BCA_COLLEGES_MOD.BCA_BASE_COLLEGES)
    .filter(c => c[0] !== 'all')
    .map(c => ({
      code: c[0],
      name: c[1],
      isCustom: false
    }));

  let allColleges = [...approvedCustom, ...baseColleges];

  // Strictly sort alphabetically A -> Z
  allColleges.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  if (q) {
    allColleges = allColleges.filter(c =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }

  if (allColleges.length === 0) {
    host.innerHTML = `
      <div class="adm-card" style="padding:24px;text-align:center;border:1px solid var(--line);border-radius:12px;background:var(--surface2);color:var(--muted);font-size:13px;">
        No colleges match "${escapeHtml(q)}".
      </div>
    `;
    return;
  }

  host.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:10px;">
      ${allColleges.map(c => {
        return `
          <div class="adm-card" style="padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--surface2);display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <div style="min-width:0;flex:1;">
              <div style="font-size:14px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(c.name)}</div>
              <div style="font-size:11.5px;color:var(--muted);display:flex;align-items:center;gap:6px;margin-top:2px;">
                <span class="adm-pill" style="font-size:10px;padding:1px 6px;border-radius:4px;${c.isCustom ? 'background:rgba(5,150,105,0.15);color:#059669;' : 'background:rgba(100,116,139,0.15);color:#64748b;'}">
                  ${c.isCustom ? 'Custom Approved' : 'Built-in'}
                </span>
                <span style="font-family:monospace;font-size:11px;opacity:0.7;">${escapeHtml(c.code)}</span>
              </div>
            </div>
            ${c.isCustom ? `
              <div style="display:flex;gap:6px;align-items:center;">
                <button type="button" class="button danger bca-pressable" onclick="rejectCustomCollege(${c.id})" title="Revoke / Archive approval" style="padding:5px 9px;font-size:11px;border-radius:7px;">
                  <i class="fa-solid fa-ban"></i> Revoke
                </button>
                <button type="button" class="button danger bca-pressable" onclick="deleteCustomCollege(${c.id}, this.dataset.name)" data-name="${escapeHtml(c.name)}" title="Permanently delete from database" style="padding:5px 9px;font-size:11px;border-radius:7px;background:rgba(239,68,68,0.15);color:#ef4444;border-color:rgba(239,68,68,0.4);">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  initAdminPressables();
}

function filterApprovedCollegesAdmin(query) {
  renderApprovedCollegesAdmin(query);
}

async function approveCustomCollege(id, name) {
  if (!adminSupabaseClient) return;
  try {
    let { error } = await adminSupabaseClient
      .from('custom_colleges')
      .update({ status: 'approved', is_approved: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error && (error.code === '42703' || String(error.message || '').includes('is_approved'))) {
      const fallback = await adminSupabaseClient
        .from('custom_colleges')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', id);
      error = fallback.error;
    }

    if (error) throw error;
    showAdminToast(`Approved "${name}"! Synced to all app dropdowns ✓`, 'success');
    await loadApprovedCustomCollegesAdmin();
  } catch (err) {
    showAdminToast('Could not approve college: ' + err.message, 'error');
  }
}

async function rejectCustomCollege(id) {
  if (!adminSupabaseClient) return;
  try {
    let { error } = await adminSupabaseClient
      .from('custom_colleges')
      .update({ status: 'rejected', is_approved: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error && (error.code === '42703' || String(error.message || '').includes('is_approved'))) {
      const fallback = await adminSupabaseClient
        .from('custom_colleges')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', id);
      error = fallback.error;
    }

    if (error) throw error;
    showAdminToast('College request rejected/archived.', 'info');
    await loadApprovedCustomCollegesAdmin();
  } catch (err) {
    showAdminToast('Could not reject college: ' + err.message, 'error');
  }
}

async function deleteCustomCollege(id, name) {
  if (!adminSupabaseClient) return;
  if (!confirm(`Are you sure you want to permanently delete "${name || 'this college'}" from the database?`)) return;
  try {
    const { error } = await adminSupabaseClient
      .from('custom_colleges')
      .delete()
      .eq('id', id);

    if (error) throw error;
    showAdminToast(`Permanently deleted "${name || 'college'}" ✓`, 'info');
    await loadApprovedCustomCollegesAdmin();
  } catch (err) {
    showAdminToast('Could not delete college: ' + err.message, 'error');
  }
}

window.loadApprovedCustomCollegesAdmin = loadApprovedCustomCollegesAdmin;
window.loadCustomCollegesAdmin = loadApprovedCustomCollegesAdmin;
window.approveCustomCollege = approveCustomCollege;
window.rejectCustomCollege = rejectCustomCollege;
window.deleteCustomCollege = deleteCustomCollege;
window.filterApprovedCollegesAdmin = filterApprovedCollegesAdmin;

let uploads = [];
const selectedIds = new Set();

const $ = id => document.getElementById(id);

/* ---- Isolated Supabase client for the Admin panel ----.
   Uses a separate localStorage prefix ('bca-admin-') so admin login
   does not collide with the main BCAPrime user session. */
function createIsolatedStorage(prefix) {
  return {
    getItem: async (key) => localStorage.getItem(prefix + key),
    setItem: async (key, value) => { localStorage.setItem(prefix + key, value); },
    removeItem: async (key) => { localStorage.removeItem(prefix + key); },
  };
}
const adminSupabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: createIsolatedStorage('bca-admin-'),
    persistSession: true,
    autoRefreshToken: true,
  }
}) : null;

/* ---- Admin alert helpers (new-upload / new-signup detection) ---- */
let lastPendingCount = 0;
let adminBellInitialized = false;

// Play a subtle beep when admin is on the panel and something new arrives
function playAdminAlertSound() {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(560, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) { /* audio not available — skip */ }
}

// Show the new-upload banner at the top of the Material tab
function showUploadBanner(count, label) {
  const banner = $('uploadBanner');
  if (!banner) return;
  const text = $('uploadBannerText');
  if (text) text.textContent = `${count} new ${label} pending review`;
  banner.hidden = false;
  banner.classList.add('show');
  // Update title to show unread count
  const pending = uploads.filter(u => u.status === 'pending' && !u._notified);
  const unread = pending.length;
  if (unread > 0) {
    document.title = `(${unread}) BCA Admin`;
  }
}

function dismissUploadBanner() {
  const banner = $('uploadBanner');
  if (banner) {
    banner.classList.remove('show');
    banner.hidden = true;
  }
  // Mark all pending as notified so title resets
  uploads.forEach(u => { if (u.status === 'pending') u._notified = true; });
  document.title = 'BCA Admin';
}

// Focus the Material tab and scroll to pending items
function focusPending() {
  switchTab('material');
  setMaterialStatusFilter('pending');
  const queueSection = $('materialQueue');
  if (queueSection) queueSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  dismissUploadBanner();
}

// Check if a date string is within the last ~10 minutes (recently added)
function isRecentlyAdded(dateStr) {
  try {
    const d = new Date(dateStr);
    const now = Date.now();
    const diffMin = (now - d.getTime()) / 60000;
    return diffMin >= 0 && diffMin <= 10;
  } catch (e) { return false; }
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch (e) { return ''; }
}

function setAuthMessage(message) {
  $('authMessage').textContent = message;
}

/* ---- Auth ---- */
async function submitAuth(event) {
  event.preventDefault();
  setAuthMessage('Authenticating...');
  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;

  // Security: sirf Supabase admin accounts (app_metadata.role='admin') allowed.
  // Direct password bypass removed — dekh: supabase-security-fix.sql
  if (!adminSupabaseClient) { setAuthMessage('Supabase is not configured.'); return; }
  const result = await adminSupabaseClient.auth.signInWithPassword({ email, password });
  if (result.error) { setAuthMessage(result.error.message); return; }
  await showAdmin(result.data.session);
}

/* Security note: showDirectAdmin() removed — ab sirf Supabase admin session se
   dashboard khulta hai. Admin banane ke liye supabase-security-fix.sql dekho. */
async function showAdmin(session) {
  const role = session?.user?.app_metadata?.role;
  if (role !== 'admin') {
    await adminSupabaseClient.auth.signOut();
    setAuthMessage('Access denied: This account does not have admin privileges.');
    return;
  }
  $('authScreen').hidden = true;
  $('adminShell').hidden = false;
  const lBtn = $('logoutButton');
  if (lBtn) lBtn.style.display = 'inline-block';
  const admLBtn = $('admLogoutBtn');
  if (admLBtn) admLBtn.style.display = 'inline-flex';
  updateThemeIcon();
  load();
  loadSubjects();
  loadReports();
  loadUserStats();
  startAdminLiveSync();
  initAdminPressables();
}

async function logout() {
  if (adminSupabaseClient) await adminSupabaseClient.auth.signOut();
  resetToAuthScreen();
}

function resetToAuthScreen() {
  $('adminShell').hidden = true;
  $('authScreen').hidden = false;
  const lBtn = $('logoutButton');
  if (lBtn) lBtn.style.display = 'none';
  const admLBtn = $('admLogoutBtn');
  if (admLBtn) admLBtn.style.display = 'none';
  setAuthMessage('Logged out');
  $('authForm').reset();
}

/* ---- Admin panel: Supabase-backed moderation ---- */
function syncAdminThemeColor(theme) {
  const isDark = theme !== 'light';
  const col = isDark ? '#050505' : '#ffffff';
  let mc = document.querySelector('meta[name="theme-color"]');
  if (!mc) {
    mc = document.createElement('meta');
    mc.name = 'theme-color';
    document.head.appendChild(mc);
  }
  mc.content = col;
  try {
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  } catch(e) {}
}

function updateThemeIcon() {
  const icon = $('admThemeIcon');
  const isLight = document.documentElement.dataset.theme === 'light';
  if (icon) icon.className = isLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  syncAdminThemeColor(isLight ? 'light' : 'dark');
}

function toggleTheme() {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('bca-theme', root.dataset.theme);
  try { localStorage.setItem('bca-theme-manual', '1'); } catch (e) {}
  updateThemeIcon();
}

function escapeHtml(value) {

  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
const escHtml = escapeHtml;
if (typeof window !== "undefined") { window.escHtml = escapeHtml; window.escapeHtml = escapeHtml; }

async function load() {
  if (!adminSupabaseClient) {
    uploads = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!uploads.length) uploads = [...demoUploads];
    render();
    return;
  }
  try {
    /* `resources_feed` view = resources + live contributor name/avatar
       (user_profiles se join). Isse admin table bhi hamesha latest naam/DP
       dikhata hai. View na ho (migration pending) to plain table fallback. */
    let data = null;
    const primary = await adminSupabaseClient.from('resources_feed').select('*').order('created_at', { ascending: false });
    if (!primary.error) {
      data = primary.data;
    } else {
      const fallback = await adminSupabaseClient.from('resources').select('*').order('created_at', { ascending: false });
      if (fallback.error) throw fallback.error;
      data = fallback.data;
    }
    uploads = (data || []).map(item => ({
      id: String(item.id),
      title: item.title,
      type: item.type,
      sem: item.semester,
      year: item.year,
      subject: item.subject,
      college: item.college,
      fileName: item.file_name,
      fileUrl: item.file_url,
      status: item.status,
      uploaderUid: item.uploader_uid || '',
      uploader: item.contributor_name || item.uploader_name || item.uploader_email || '',
      uploaderAvatar: item.contributor_avatar || '',
      uploaderEmail: item.uploader_email || '',
      date: item.created_at
    }));
  } catch (error) {
    console.warn('Could not load resources.', error.message);
    uploads = [];
  }
  render();
  loadFeedback();
}
/* ---- Real-Time Bi-Directional Sync Across Core Supabase Tables ---- */
let adminLiveChannel = null;
let adminReloadTimer = null;
function scheduleAdminReload() {
  clearTimeout(adminReloadTimer);
  adminReloadTimer = setTimeout(() => {
    load().catch(() => {});
    updateAdminKpis();
  }, 400);
}

function startAdminLiveSync() {
  if (!adminSupabaseClient || adminLiveChannel) return;
  try {
    adminLiveChannel = adminSupabaseClient.channel('admin-live-full')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resources' }, () => {
        scheduleAdminReload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => {
        loadUserStats().catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'senior_requests' }, () => {
        loadCommunityRequests().catch(() => {});
        updateAdminKpis();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lost_found' }, () => {
        loadLostFoundAdmin().catch(() => {});
        updateAdminKpis();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, () => {
        loadFeedback().catch(() => {});
        updateAdminKpis();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_colleges' }, () => {
        loadApprovedCustomCollegesAdmin().catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subjects' }, () => {
        loadSubjects().catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, () => {
        loadAdminQuizzes().catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resource_reports' }, (payload) => {
        loadReports().catch(() => {});
        if (payload.eventType === 'INSERT') {
          playAdminAlertSound();
          showReportAlertBanner(payload.new);
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('BCAPrime: Resource Reported', {
                body: `Report: "${payload.new.resource_title || 'Material'}" — ${payload.new.reason}`,
                icon: '../assets/logo.png'
              });
            }
          } catch(e) {}
        }
      })
      .subscribe();
  } catch (error) { console.warn('Admin live sync unavailable.', error); }
}



/* ---- Material status filter pills ---- */
function setMaterialStatusFilter(status) {
  document.querySelectorAll('.adm-filter-pills .adm-pill[data-status]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });
  const sel = $('statusFilter');
  if (sel && sel.value !== status) {
    sel.value = status;
  }
  render();
}

function confirmRejectMaterial(id) {
  openSafeDelete('Reject and remove this material from the active library?', () => {
    updateStatus(id, 'rejected');
  });
}

/* ---- Rendering ---- */
function filteredUploads() {
  const query = ($('search').value || '').toLowerCase();
  const status = $('statusFilter').value;
  return uploads.filter(item => {
    const matchQuery = !query ||
      (item.title || '').toLowerCase().includes(query) ||
      (item.college || '').toLowerCase().includes(query) ||
      (item.subject || '').toLowerCase().includes(query) ||
      (item.uploader || '').toLowerCase().includes(query);
    const matchStatus = status === 'all' || item.status === status;
    return matchQuery && matchStatus;
  });
}

function render() {
  const list = filteredUploads();

  $('totalCount').textContent = uploads.length;
  $('collegeCount').textContent = new Set(uploads.map(item => item.college)).size;
  $('activeCount').textContent = uploads.filter(item => item.status === 'approved').length;

  if ($('adminListCountDisplay')) {
    $('adminListCountDisplay').textContent = `${list.length} item${list.length === 1 ? '' : 's'}`;
  }

  if (typeof updateAdminKpis === 'function') updateAdminKpis();

  [...selectedIds].forEach(id => {
    if (!uploads.some(item => String(item.id) === id)) selectedIds.delete(id);
  });
  const bulkEl = $('bulkActions');
  if (selectedIds.size) {
    bulkEl.classList.add('visible');
  } else {
    bulkEl.classList.remove('visible');
  }
  $('bulkCount').textContent = `${selectedIds.size} selected`;
  if ($('checkAll')) {
    $('checkAll').checked = list.length > 0 && list.every(item => selectedIds.has(String(item.id)));
  }

  const tbody = $('rows');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="adm-empty-td"><div class="empty"><i class="fa-regular fa-folder-open" style="font-size:26px;display:block;margin-bottom:8px;opacity:0.6"></i>No study material found for this filter.</div></td></tr>';
    return;
  }
  tbody.innerHTML = list.map(item => {
    const id = String(item.id);
    const badgeClass = item.status === 'approved' ? 'badge-approved' : (item.status === 'rejected' ? 'badge-rejected' : 'badge-pending');
    const typeLabel = item.type === 'pyq' ? 'PYQ' : 'Notes';
    const typeClass = item.type === 'pyq' ? 'type-pyq' : 'type-notes';
    const isNewPending = item.status === 'pending' && item.date && isRecentlyAdded(item.date);
    const rowClass = isNewPending ? 'new-pending' : '';
    const uploaderHandle = item.uploader ? `@${item.uploader.replace(/\s+/g, '_').toLowerCase()}` : '@student';
    const relTime = formatRelativeTime(item.date);
    const collegeDisplay = collegeNames[item.college] || item.college || 'All colleges';

    return `<tr class="${rowClass} adm-material-row" data-id="${id}" id="row-${id}">
      <td class="adm-mat-td" colspan="7">
        <div class="adm-mat-card ${item.status}">
          <!-- Top Row: Checkbox + Badges + Time -->
          <div class="adm-mat-card-head">
            <label class="adm-mat-check-label bca-pressable" title="Select item">
              <input type="checkbox" ${selectedIds.has(id) ? 'checked' : ''} onchange="toggleSelected('${id}',this.checked)">
              <span class="adm-mat-check-custom"></span>
            </label>
            <div class="adm-mat-badges">
              <span class="adm-pill-type ${typeClass}">
                ${item.type === 'pyq' ? '<i class="fa-solid fa-file-signature"></i> PYQ' : '<i class="fa-solid fa-book-bookmark"></i> Notes'}
              </span>
              <span class="adm-pill-status badge ${badgeClass}">${item.status}</span>
              <span class="adm-pill-sem"><i class="fa-solid fa-graduation-cap"></i> Sem ${item.sem}${item.year ? ` • Yr ${item.year}` : ''}</span>
            </div>
            ${relTime ? `<span class="adm-mat-time">${relTime}</span>` : ''}
          </div>

          <!-- Title & Subject -->
          <div class="adm-mat-body">
            <h3 class="adm-mat-title">${escapeHtml(item.title)}</h3>
            ${item.subject ? `
              <div class="adm-mat-subject">
                <i class="fa-solid fa-book"></i>
                <span>${escapeHtml(item.subject)}</span>
              </div>
            ` : ''}
          </div>

          <!-- Metadata Bar: College & Uploader -->
          <div class="adm-mat-meta-bar">
            <div class="adm-meta-item adm-meta-college" title="College: ${escapeHtml(collegeDisplay)}">
              <i class="fa-solid fa-building-columns"></i>
              <span>${escapeHtml(collegeDisplay)}</span>
            </div>
            <div class="adm-meta-item adm-meta-uploader" title="Uploaded by: ${escapeHtml(uploaderHandle)}">
              ${item.uploaderAvatar ? `<img src="${escapeHtml(item.uploaderAvatar)}" alt="" class="adm-uploader-avatar">` : '<i class="fa-regular fa-user"></i>'}
              <span class="adm-uploader-handle">${escapeHtml(uploaderHandle)}</span>
            </div>
          </div>

          <!-- File Attachment & Compact Preview Button -->
          ${(item.fileName || item.fileUrl) ? `
            <div class="adm-mat-file-bar">
              <div class="adm-file-info" title="${escapeHtml(item.fileName || 'Attachment')}">
                <i class="fa-solid fa-file-pdf adm-pdf-icon"></i>
                <span class="adm-file-name">${escapeHtml(item.fileName || 'PDF Document')}</span>
              </div>
              ${item.fileUrl ? `
                <a href="#" class="adm-compact-preview-btn bca-pressable" onclick="event.preventDefault();openResourceFile('${escapeHtml(item.fileUrl)}')">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i>
                  <span>Preview PDF</span>
                </a>
              ` : ''}
            </div>
          ` : ''}

          <!-- Action Buttons Bar -->
          <div class="adm-mat-actions">
            ${item.status !== 'approved' ? `
              <button type="button" class="button primary adm-action-btn adm-approve-btn bca-pressable" onclick="updateStatus('${id}','approved')">
                <i class="fa-solid fa-check"></i>
                <span>Approve</span>
              </button>
            ` : ''}
            ${item.status !== 'rejected' ? `
              <button type="button" class="button danger adm-action-btn adm-reject-btn bca-pressable" onclick="confirmRejectMaterial('${id}')">
                <i class="fa-solid fa-xmark"></i>
                <span>Reject</span>
              </button>
            ` : ''}
            ${item.status !== 'archived' ? `
              <button type="button" class="button adm-action-btn adm-archive-btn bca-pressable" onclick="updateStatus('${id}','archived')">
                <i class="fa-solid fa-box-archive"></i>
                <span>Archive</span>
              </button>
            ` : ''}
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');

  initAdminPressables();
}

/* ---- Selection ---- */
function toggleSelected(id, checked) {
  if (checked) selectedIds.add(String(id));
  else selectedIds.delete(String(id));
  render();
}

function toggleCheckAll(checked) {
  filteredUploads().forEach(item => {
    if (checked) selectedIds.add(String(item.id));
    else selectedIds.delete(String(item.id));
  });
  render();
}

/* ---- Local mirror for offline/demo mode ---- */
function saveLocalMirror() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(uploads.filter(item => typeof item.id === 'string' && item.id.startsWith('local-'))));
  } catch (error) { /* storage unavailable — ignore */ }
}

/* ---- Moderation actions ---- */
async function updateStatus(id, status) {
  const item = uploads.find(entry => String(entry.id) === String(id));
  if (!item) return;

  // Visual feedback: find approve/action button and show pending spinner
  const row = document.getElementById(`row-${id}`);
  const actionBtn = row ? row.querySelector(`.adm-${status === 'approved' ? 'approve' : (status === 'rejected' ? 'reject' : 'archive')}-btn`) : null;
  const originalHtml = actionBtn ? actionBtn.innerHTML : null;
  if (actionBtn) {
    actionBtn.disabled = true;
    actionBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  }

  try {
    if (adminSupabaseClient && !id.startsWith('demo-') && !id.startsWith('local-')) {
      const { error } = await adminSupabaseClient.from('resources').update({ status }).eq('id', id);
      if (error) {
        showAdminToast('Update failed: ' + error.message, 'error');
        if (actionBtn && originalHtml) {
          actionBtn.disabled = false;
          actionBtn.innerHTML = originalHtml;
        }
        return; // NEVER modify local status or remove from UI if mutation fails!
      }
    }

    // Database update succeeded: update local state & re-render
    item.status = status;
    saveLocalMirror();
    render();

    // Show crisp toast notification
    if (status === 'approved') {
      showAdminToast('Approved & published!', 'success');
      if ($('notifyOnApprove') && $('notifyOnApprove').checked) {
        notifyResourceApproved(item);
      }
    } else if (status === 'rejected') {
      showAdminToast('Material rejected', 'info');
    } else if (status === 'archived') {
      showAdminToast('Material archived', 'info');
    }
  } catch (err) {
    console.error('updateStatus error:', err);
    showAdminToast('Update failed: ' + (err.message || 'Unknown error'), 'error');
    if (actionBtn && originalHtml) {
      actionBtn.disabled = false;
      actionBtn.innerHTML = originalHtml;
    }
  }
}

async function bulkUpdateStatus(status) {
  if (!selectedIds.size) return;
  const cloudIds = [...selectedIds].filter(id => !id.startsWith('demo-') && !id.startsWith('local-'));
  try {
    if (adminSupabaseClient && cloudIds.length) {
      const { error } = await adminSupabaseClient.from('resources').update({ status }).in('id', cloudIds);
      if (error) {
        showAdminToast('Bulk update failed: ' + error.message, 'error');
        return; // DO NOT mutate or remove from UI on failure!
      }
    }
    const newlyApproved = status === 'approved'
      ? uploads.filter(item => selectedIds.has(String(item.id)))
      : [];
    uploads.forEach(item => { if (selectedIds.has(String(item.id))) item.status = status; });
    saveLocalMirror();
    selectedIds.clear();
    render();

    if (status === 'approved') {
      showAdminToast(`${newlyApproved.length} materials approved & published!`, 'success');
    } else {
      showAdminToast(`Selected materials marked as ${status}`, 'info');
    }

    const autoNotify = $('notifyOnApprove') && $('notifyOnApprove').checked;
    if (status === 'approved' && newlyApproved.length && autoNotify) {
      for (const item of newlyApproved) {
        notifyResourceApproved(item).catch(err => console.warn('Bulk notify error:', err));
      }
    }
  } catch (err) {
    console.error('bulkUpdateStatus error:', err);
    showAdminToast('Bulk update failed: ' + (err.message || 'Unknown error'), 'error');
  }
}

function extractStoragePathFromUrl(urlOrPath, bucketName = 'resources') {
  if (!urlOrPath || typeof urlOrPath !== 'string') return null;
  let clean = urlOrPath.trim();
  const pattern = new RegExp(`/${bucketName}/(.+)$`);
  const match = clean.match(pattern);
  if (match) {
    return match[1].split('?')[0].split('#')[0];
  }
  if (clean.startsWith('http')) {
    const idx = clean.indexOf(`/${bucketName}/`);
    if (idx !== -1) return clean.slice(idx + `/${bucketName}/`.length).split('?')[0].split('#')[0];
  }
  if (!clean.startsWith('http') && !clean.includes('://')) {
    return clean.split('?')[0].split('#')[0];
  }
  return null;
}

async function bulkDelete() {
  if (!selectedIds.size) return;
  openSafeDelete(`Delete ${selectedIds.size} selected item(s)? This will also permanently wipe their files from cloud storage.`, async () => {
    const cloudItems = uploads.filter(item => selectedIds.has(String(item.id)) && !String(item.id).startsWith('demo-') && !String(item.id).startsWith('local-'));
    const cloudIds = cloudItems.map(item => item.id);
    if (adminSupabaseClient && cloudIds.length) {
      // Purge files from Supabase Storage
      const filePaths = cloudItems.map(item => extractStoragePathFromUrl(item.fileUrl || item.fileName, 'resources')).filter(Boolean);
      if (filePaths.length) {
        try {
          await adminSupabaseClient.storage.from('resources').remove(filePaths);
        } catch (stErr) {
          console.warn('[Admin] Storage file wipe error:', stErr);
        }
      }
      const { error } = await adminSupabaseClient.from('resources').delete().in('id', cloudIds);
      if (error) { alert('Delete failed: ' + error.message); return; }
    }
    uploads = uploads.filter(item => !selectedIds.has(String(item.id)));
    saveLocalMirror();
    selectedIds.clear();
    render();
    updateAdminKpis();
    showAdminToast('Selected resources deleted and files purged from storage ✓', 'success');
  });
}

/* ---- Auto refresh while the dashboard is visible ---- */
setInterval(() => {
  if (adminSupabaseClient && document.visibilityState === 'visible' && $('adminShell') && $('adminShell').hidden === false) load();
}, 20000);

/* ---- Broadcast push notifications (Web Push via Edge Function) ---- */
// Never hardcode secrets in client bundles. Read from window or prompt & store in sessionStorage.
function getAdminSecret() {
  if (typeof window === 'undefined') return '';
  if (window.__ADMIN_NOTIFY_SECRET) return window.__ADMIN_NOTIFY_SECRET;
  let s = '';
  try { s = sessionStorage.getItem('bcaprime_admin_notify_secret') || ''; } catch (e) {}
  return s;
}

/* ---- Private bucket: admin "Open file" ab signed URL se khulta hai ----
   resources bucket private hai, isliye seedha public URL 403 deta hai.
   sign-resource Edge Function admin session JWT ya secret verify karti hai -> full access. */
async function openResourceFile(fileUrl) {
  if (!fileUrl) return;
  if (typeof SUPABASE_URL === 'undefined') { window.open(fileUrl, '_blank', 'noopener'); return; }
  try {
    let authHeader = 'Bearer ' + (typeof SUPABASE_PUBLISHABLE_KEY !== 'undefined' ? SUPABASE_PUBLISHABLE_KEY : '');
    if (adminSupabaseClient) {
      const { data } = await adminSupabaseClient.auth.getSession();
      if (data && data.session && data.session.access_token) {
        authHeader = 'Bearer ' + data.session.access_token;
      }
    }
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    };
    let secret = '';
    try { secret = (window.__ADMIN_NOTIFY_SECRET || sessionStorage.getItem('bcaprime_admin_notify_secret')) || ''; } catch (e) {}
    if (secret) headers['x-admin-secret'] = secret;
    const res = await fetch(SUPABASE_URL + '/functions/v1/sign-resource', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ fileUrl: fileUrl, mode: 'download' }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data && data.ok && data.url) window.open(data.url, '_blank', 'noopener');
    else { console.warn('Could not open file:', data && data.error); alert('Could not open the file. Please try again.'); }
  } catch (e) {
    console.warn('openResourceFile failed', e);
    window.open(fileUrl, '_blank', 'noopener');
  }
}

async function sendPushBroadcast(title, body, tag, target) {
  if (typeof SEND_PUSH_FUNCTION_URL === 'undefined') {
    console.warn('send-push function URL missing.');
    return false;
  }
  const sec = getAdminSecret();
  let authHeader = 'Bearer ' + (typeof SUPABASE_PUBLISHABLE_KEY !== 'undefined' ? SUPABASE_PUBLISHABLE_KEY : '');
  if (adminSupabaseClient) {
    try {
      const { data } = await adminSupabaseClient.auth.getSession();
      if (data && data.session && data.session.access_token) {
        authHeader = 'Bearer ' + data.session.access_token;
      }
    } catch (e) {}
  }

  try {
    const payload = {
      title,
      body,
      url: (target && target.url) || '/index.html',
      tag: tag || 'bcaprime-broadcast'
    };
    if (sec) payload.secret = sec;
    // Optional targeting (college + semester + uid)
    if (target && target.college) payload.college = target.college;
    if (target && target.semester != null) payload.semester = Number(target.semester);
    if (target && target.uid) payload.uid = target.uid;
    if (target && target.excludeUid) payload.excludeUid = target.excludeUid;
    if (target && target.strict) payload.strict = true;
    if (target && target.skipInApp) payload.skipInApp = true;

    const headers = {
      'Content-Type': 'application/json',
      'apikey': typeof SUPABASE_PUBLISHABLE_KEY !== 'undefined' ? SUPABASE_PUBLISHABLE_KEY : '',
      'Authorization': authHeader
    };
    if (sec) headers['x-admin-secret'] = sec;

    const response = await fetch(SEND_PUSH_FUNCTION_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = [result.error, result.hint].filter(Boolean).join(' | ');
      console.warn('Push notification warning: ' + (detail || response.status));
      return false;
    }
    return { ok: true, sent: result.sent ?? 0, failed: result.failed ?? 0, removed: result.removed ?? 0 };
  } catch (error) {
    console.warn('Push notification failed: ' + error.message);
    return false;
  }
}

async function notifyResourceApproved(item) {
  if (!item) return;

  // 1. Strict metadata inspection
  const collegeKey = item.college ? String(item.college).trim().toLowerCase() : '';
  const semNumber = item.sem != null && item.sem !== '' ? Number(item.sem) : null;

  // Strict targeting rule: Both college and semester MUST be valid. Never broadcast globally.
  if (!collegeKey || collegeKey === 'all' || !semNumber || Number.isNaN(semNumber) || semNumber < 1 || semNumber > 8) {
    console.warn('[notifyResourceApproved] Notification skipped: missing strict college or semester metadata.', {
      id: item.id,
      title: item.title,
      college: item.college,
      sem: item.sem
    });
    return;
  }

  // Deduplication check: prevent duplicating notifications if clicked twice
  window.__notifiedResourceIds = window.__notifiedResourceIds || new Set();
  const resKey = String(item.id);
  if (window.__notifiedResourceIds.has(resKey)) {
    console.info('[notifyResourceApproved] Notification already processed in this session for resource:', resKey);
    return;
  }
  window.__notifiedResourceIds.add(resKey);

  if (adminSupabaseClient) {
    try {
      const { data: existing } = await adminSupabaseClient
        .from('notifications')
        .select('id')
        .eq('target_resource', resKey)
        .limit(1);
      if (existing && existing.length > 0) {
        console.info('[notifyResourceApproved] Notification row already exists in database for resource:', resKey);
        return;
      }
    } catch (e) {
      console.warn('[notifyResourceApproved] Error checking existing notification:', e);
    }
  }

  const isPyq = String(item.type || '').toLowerCase() === 'pyq';
  const kindLabel = isPyq ? 'PYQ' : 'Notes';
  const subjectPart = item.subject && String(item.subject).trim() ? ` (${String(item.subject).trim()})` : '';

  // Classmate payload (exact specified format)
  const classmateTitle = isPyq ? 'New PYQ Added' : 'New Notes Added';
  const classmateBody = `"${item.title}"${subjectPart} is now available for Semester ${semNumber}.`;
  const targetUrl = `#resource-${resKey}`;

  // Uploader payload (personal confirmation)
  const uploaderUid = item.uploaderUid ? String(item.uploaderUid).trim() : '';
  const uploaderTitle = 'Material Approved! 🎉';
  const uploaderBody = `Your ${kindLabel} "${item.title}" has been approved and published!`;

  // 2. Database Insert: Insert clean targeted rows
  if (adminSupabaseClient) {
    const rowsToInsert = [
      {
        title: classmateTitle,
        message: classmateBody,
        type: isPyq ? 'pyq' : 'note',
        college: collegeKey,
        semester: semNumber,
        user_id: null, // Classmates in matching college & semester
        target_resource: resKey,
        target_url: targetUrl,
        is_read: false
      }
    ];

    if (uploaderUid) {
      rowsToInsert.push({
        title: uploaderTitle,
        message: uploaderBody,
        type: isPyq ? 'pyq' : 'note',
        college: collegeKey,
        semester: semNumber,
        user_id: uploaderUid, // Targeted specifically to uploader
        target_resource: resKey,
        target_url: targetUrl,
        is_read: false
      });
    }

    try {
      const { error: insertErr } = await adminSupabaseClient.from('notifications').insert(rowsToInsert);
      if (insertErr) {
        console.warn('[notifyResourceApproved] Could not insert notification rows:', insertErr.message);
      } else {
        // Fast-path Realtime broadcast across open client channels
        try {
          const chan = adminSupabaseClient.channel('bca-notifications-live');
          rowsToInsert.forEach(row => {
            chan.send({ type: 'broadcast', event: 'admin-notification', payload: row });
          });
        } catch (_c) {}
      }
    } catch (dbErr) {
      console.warn('[notifyResourceApproved] Database error:', dbErr);
    }
  }

  // 3. Web Push: Classmates (strictly matching college + semester, excluding uploader)
  await sendPushBroadcast(
    classmateTitle,
    classmateBody,
    `resource-approved-${resKey}`,
    {
      college: collegeKey,
      semester: semNumber,
      excludeUid: uploaderUid || undefined,
      strict: true,
      skipInApp: true,
      url: `/index.html#resource-${resKey}`
    }
  );

  // 4. Web Push: Uploader personal confirmation
  if (uploaderUid) {
    await sendPushBroadcast(
      uploaderTitle,
      uploaderBody,
      `resource-approved-uploader-${resKey}`,
      {
        uid: uploaderUid,
        strict: true,
        skipInApp: true,
        url: `/index.html#resource-${resKey}`
      }
    );
  }
}

async function handleNotifyFormSubmit(event) {
  event.preventDefault();
  const button = $('notifySend');
  const title = $('notifyTitle').value.trim();
  const body = $('notifyBody').value.trim();
  if (!title) return;
  button.disabled = true;
  button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Sending broadcast…</span>';
  // Optional targeting from the form — empty = broadcast to all.
  const target = {
    college: $('notifyCollege').value || null,
    semester: $('notifySemester').value ? Number($('notifySemester').value) : null
  };

  // 1. Insert into public.notifications so Supabase Realtime triggers instantly for all connected students
  if (adminSupabaseClient) {
    try {
      const inAppRow = {
        title: title,
        message: body,
        type: 'announcement',
        college: target.college || 'all',
        semester: target.semester || null,
        target_resource: '',
        target_url: '#top',
        is_read: false
      };
      await adminSupabaseClient.from('notifications').insert(inAppRow);

      // Fast-path Realtime broadcast across open client channels
      try {
        const chan = adminSupabaseClient.channel('bca-notifications-live');
        chan.send({ type: 'broadcast', event: 'admin-notification', payload: inAppRow });
      } catch (e) {}
    } catch (e) {
      console.warn('Could not insert in-app notification row:', e);
    }
  }

  const res = await sendPushBroadcast(title, body, undefined, target);
  button.disabled = false;
  if (res && res.ok) {
    $('notifyForm').reset();
    updatePushPreview();
    button.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>Sent! (Delivered: ${res.sent || 0})</span>`;
    setTimeout(() => {
      button.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Send Push Broadcast</span>';
      updatePushPreview();
    }, 4000);
  } else {
    button.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Send Push Broadcast</span>';
  }
}
$('notifyForm').addEventListener('submit', handleNotifyFormSubmit);

function updatePushPreview() {
  const title = ($('notifyTitle')?.value || '').trim();
  const body = ($('notifyBody')?.value || '').trim();
  const college = $('notifyCollege')?.value;
  const sem = $('notifySemester')?.value;

  const titleEl = $('previewTitle');
  const msgEl = $('previewMsg');
  const badgeEl = $('previewAudienceBadge');

  if (titleEl) {
    titleEl.textContent = title || 'Notification Title Preview';
  }
  if (msgEl) {
    msgEl.textContent = body || "Your message will appear here on students' mobile lock screens...";
  }
  if (badgeEl) {
    let audience = 'All Students';
    if (college && college !== 'all' && sem) {
      const cName = collegeNames[college] || college.toUpperCase();
      audience = `${cName} • Sem ${sem}`;
    } else if (college && college !== 'all') {
      audience = collegeNames[college] || college.toUpperCase();
    } else if (sem) {
      audience = `Semester ${sem} Only`;
    }
    badgeEl.textContent = audience;
  }
}

function toggleBroadcastPanel() {
  const body = $('admBroadcastBody');
  const icon = $('iconBroadcastChevron');
  if (!body) return;
  const isHidden = body.classList.toggle('adm-panel-collapsed');
  if (icon) {
    icon.className = isHidden ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
  }
}

/* ============================================================
   KPI Metrics & Dashboard Synchronizer
   ============================================================ */
async function updateAdminKpis() {
  // 1. Pending Uploads
  const pendingCount = (uploads || []).filter(item => item.status === 'pending').length;
  if ($('kpiPendingUploads')) $('kpiPendingUploads').textContent = pendingCount;
  if ($('pillPendingCount')) $('pillPendingCount').textContent = pendingCount;
  if ($('pendingBadge')) {
    $('pendingBadge').textContent = pendingCount;
    $('pendingBadge').hidden = pendingCount === 0;
  }

  // 2. Total Students
  if (window.userStatsCache && window.userStatsCache.total_users) {
    if ($('kpiTotalStudents')) $('kpiTotalStudents').textContent = Number(window.userStatsCache.total_users).toLocaleString();
    if ($('usersBadge')) {
      $('usersBadge').textContent = window.userStatsCache.total_users;
      $('usersBadge').hidden = false;
    }
  }

  // 3. Feedback count & star ratings (1–3★)
  if (window.allFeedbackCache && window.allFeedbackCache.length) {
    const lowStarOrOpen = window.allFeedbackCache.filter(item => {
      const msg = item.message || '';
      const isLowStar = /\[Rating:\s*([1-3])\/5/i.test(msg) || (item.rating && item.rating <= 3);
      return isLowStar || item.status === 'open';
    }).length;
    if ($('kpiStarFeedback')) $('kpiStarFeedback').textContent = lowStarOrOpen;
    if ($('feedbackBadge')) {
      const openCount = window.allFeedbackCache.filter(item => item.status === 'open').length;
      $('feedbackBadge').textContent = openCount;
      $('feedbackBadge').hidden = openCount === 0;
    }
  }

  // 4. Community Posts (Lost & Found + Reports + Junior/Senior Requests)
  if (adminSupabaseClient) {
    try {
      const [lfRes, repRes, reqRes] = await Promise.allSettled([
        adminSupabaseClient.from('lost_found').select('id, status', { count: 'exact', head: true }),
        adminSupabaseClient.from('resource_reports').select('id, status', { count: 'exact', head: true }).eq('status', 'open'),
        adminSupabaseClient.from('senior_requests').select('id, status', { count: 'exact', head: true })
      ]);
      const lfCount = lfRes.status === 'fulfilled' ? (lfRes.value.count || 0) : 0;
      const repCount = repRes.status === 'fulfilled' ? (repRes.value.count || 0) : 0;
      const reqCount = reqRes.status === 'fulfilled' ? (reqRes.value.count || 0) : 0;

      const totalComm = lfCount + repCount + reqCount;
      if ($('kpiCommunityPosts')) $('kpiCommunityPosts').textContent = totalComm;

      const actionable = repCount + (reqRes.status === 'fulfilled' ? reqCount : 0);
      if ($('communityBadge')) {
        $('communityBadge').textContent = actionable;
        $('communityBadge').hidden = actionable === 0;
      }
      if ($('reportsBadgeSub')) {
        $('reportsBadgeSub').textContent = repCount;
        $('reportsBadgeSub').hidden = repCount === 0;
      }
    } catch (e) {
      console.warn('Could not update community KPIs:', e.message);
    }
  }
}

async function refreshAdminData() {
  const btn = $('admRefreshBtn');
  if (btn) btn.classList.add('rotating');
  if (window.BCA_UI && window.BCA_UI.triggerLightHaptic) {
    window.BCA_UI.triggerLightHaptic(12);
  }
  showAdminToast('Refreshing admin consoles & queues...', 'info');
  try {
    await Promise.allSettled([
      load(),
      loadSubjects(),
      loadReports(),
      loadFeedback(),
      loadCommunityRequests(),
      loadLostFoundAdmin(),
      loadApprovedCustomCollegesAdmin(),
      loadUserStats()
    ]);
    await updateAdminKpis();
    showAdminToast('Dashboard synchronized with latest data', 'success');
  } catch (err) {
    showAdminToast('Refresh completed', 'info');
  } finally {
    if (btn) {
      setTimeout(() => btn.classList.remove('rotating'), 600);
    }
  }
}

/* ============================================================
   Feedback & Smart Star-Filter Inbox
   ============================================================ */
window.allFeedbackCache = [];
window.feedbackFilter = 'all';

async function loadFeedback() {
  const list = $('feedbackList');
  if (!list) return;
  list.innerHTML = '<p class="note">Loading feedback &amp; ratings&hellip;</p>';
  if (typeof adminSupabaseClient === 'undefined' || !adminSupabaseClient) {
    list.innerHTML = '<p class="note">Supabase is not configured.</p>';
    return;
  }
  try {
    const { data, error } = await adminSupabaseClient
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    window.allFeedbackCache = data || [];
    updateAdminKpis();
    renderFeedbackList();
  } catch (err) {
    list.innerHTML = '<p class="note">Load failed: ' + escapeHtml(err.message) + '</p>';
  }
}

function setFeedbackFilter(filter) {
  window.feedbackFilter = filter;
  document.querySelectorAll('[data-fb-filter]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.fbFilter === filter);
  });
  renderFeedbackList();
}

/* ---- Feedback multi-select state & actions ---- */
const selectedFeedbackIds = new Set();
function toggleFeedbackSelect(id, checked) {
  const numId = isNaN(id) ? id : Number(id);
  if (checked) selectedFeedbackIds.add(numId);
  else selectedFeedbackIds.delete(numId);
  updateBulkFeedbackUI();
}
window.toggleFeedbackSelect = toggleFeedbackSelect;

function toggleCheckAllFeedback(checked) {
  const list = $('feedbackList');
  if (!list) return;
  const items = list.querySelectorAll('.feedback-item');
  items.forEach(el => {
    const id = el.dataset.id;
    if (!id) return;
    const numId = isNaN(id) ? id : Number(id);
    const cb = el.querySelector('.adm-item-checkbox');
    if (cb) cb.checked = checked;
    if (checked) selectedFeedbackIds.add(numId);
    else selectedFeedbackIds.delete(numId);
  });
  updateBulkFeedbackUI();
}
window.toggleCheckAllFeedback = toggleCheckAllFeedback;

function updateBulkFeedbackUI() {
  const bar = $('bulkFeedbackActions');
  const cnt = $('bulkFeedbackCount');
  const allCb = $('checkAllFeedback');
  const disp = $('feedbackCountDisplay');
  const totalVis = $('feedbackList') ? $('feedbackList').querySelectorAll('.feedback-item').length : 0;
  if (bar) bar.classList.toggle('visible', selectedFeedbackIds.size > 0);
  if (cnt) cnt.textContent = `${selectedFeedbackIds.size} selected`;
  if (disp) disp.textContent = `${totalVis} feedback`;
  if (allCb) allCb.checked = totalVis > 0 && selectedFeedbackIds.size >= totalVis;
}
window.updateBulkFeedbackUI = updateBulkFeedbackUI;

async function bulkDeleteFeedback() {
  if (!selectedFeedbackIds.size) return;
  openSafeDelete(`Permanently delete ${selectedFeedbackIds.size} selected feedback item(s)? This cannot be undone.`, async () => {
    if (!adminSupabaseClient) return;
    const ids = [...selectedFeedbackIds];
    const { error } = await adminSupabaseClient.from('feedback').delete().in('id', ids);
    if (error) { alert('Delete failed: ' + error.message); return; }
    selectedFeedbackIds.clear();
    showAdminToast('Selected feedback items deleted ✓', 'success');
    loadFeedback();
    updateAdminKpis();
  });
}
window.bulkDeleteFeedback = bulkDeleteFeedback;

function renderFeedbackList() {
  const list = $('feedbackList');
  if (!list) return;
  const items = window.allFeedbackCache || [];
  const filter = window.feedbackFilter || 'all';

  const filtered = items.filter(item => {
    const msg = item.message || '';
    const ratingMatch = msg.match(/\[Rating:\s*([1-5])\/5\s*stars?\]/i);
    const starVal = ratingMatch ? parseInt(ratingMatch[1], 10) : (item.rating || 0);

    if (filter === 'stars') return starVal >= 1 && starVal <= 3;
    if (filter === 'bug') return item.kind === 'bug';
    if (filter === 'idea') return item.kind === 'idea' || item.kind === 'question';
    if (filter === 'open') return item.status === 'open' || !item.status;
    if (filter === 'resolved') return item.status === 'resolved';
    return true;
  });

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty-state-wrap">
        <i class="fa-regular fa-comment-dots" style="font-size:32px;color:var(--muted);margin-bottom:12px;display:block"></i>
        <h3 style="margin:0 0 6px;font-size:16px">No feedback in this view</h3>
        <p style="color:var(--muted);font-size:13px;margin:0">No user feedback matching "${filter}" criteria.</p>
      </div>`;
    updateBulkFeedbackUI();
    return;
  }

  list.innerHTML = filtered.map(item => {
    const msg = item.message || '';
    const ratingMatch = msg.match(/\[Rating:\s*([1-5])\/5\s*stars?\]/i);
    const starVal = ratingMatch ? parseInt(ratingMatch[1], 10) : (item.rating || 0);
    const cleanMsg = msg.replace(/\[Rating:\s*([1-5])\/5\s*stars?\]\s*/i, '');

    const kindClass = { bug: 'k-bug', idea: 'k-idea', question: 'k-question' }[item.kind] || 'k-idea';
    const whoLine = [item.user_name, item.user_email].filter(Boolean).join(' · ');
    const isResolved = item.status === 'resolved';
    const isChecked = selectedFeedbackIds.has(item.id) || selectedFeedbackIds.has(Number(item.id));

    let starBadgeHtml = '';
    if (starVal > 0) {
      const starClass = starVal <= 2 ? 'fi-star-bad' : (starVal === 3 ? 'fi-star-mid' : 'fi-star-good');
      const starIcons = '★'.repeat(starVal) + '☆'.repeat(Math.max(0, 5 - starVal));
      starBadgeHtml = `<span class="fi-star-badge ${starClass}">
        <span class="fi-stars-symbols">${starIcons}</span>
        <span>${starVal}/5 Stars</span>
      </span>`;
    }

    return `<div class="feedback-item ${isResolved ? 'resolved' : 'open'}" data-id="${item.id}">
      <div class="fi-head">
        <input type="checkbox" class="adm-item-checkbox" ${isChecked ? 'checked' : ''} onchange="event.stopPropagation(); toggleFeedbackSelect(${item.id}, this.checked)" title="Select feedback">
        ${starBadgeHtml}
        <span class="fi-kind ${kindClass}">${escapeHtml(item.kind || 'feedback')}</span>
        <span class="badge ${isResolved ? 'badge-resolved' : 'badge-open'}">${isResolved ? 'Resolved' : 'Open'}</span>
        <small class="fi-time">${formatISTDate(item.created_at)}</small>
      </div>
      <p class="fi-msg">${escapeHtml(cleanMsg || msg)}</p>
      ${item.screenshot_url ? `<a href="${escapeHtml(item.screenshot_url)}" target="_blank" rel="noopener"><img src="${escapeHtml(item.screenshot_url)}" class="fi-shot" alt="User screenshot"></a>` : ''}
      ${whoLine ? `<div class="fi-who"><i class="fa-solid fa-user"></i><span>${escapeHtml(whoLine)}</span>${item.page_url ? `<small>&middot; ${escapeHtml((item.page_url || '').slice(0, 45))}</small>` : ''}</div>` : ''}
      ${item.user_agent ? `<div class="fi-meta"><i class="fa-solid fa-mobile-screen"></i> ${escapeHtml((item.user_agent || '').slice(0, 85))}</div>` : ''}
      <div class="row-actions">
        ${!isResolved 
          ? `<button class="button primary bca-pressable" onclick="resolveFeedback(${item.id})"><i class="fa-solid fa-check"></i> Mark Resolved</button>`
          : `<button class="button bca-pressable" onclick="reopenFeedback(${item.id})"><i class="fa-solid fa-arrow-rotate-left"></i> Reopen</button>`}
        <button class="button danger bca-pressable" onclick="deleteFeedback(${item.id})"><i class="fa-solid fa-trash"></i> Delete</button>
      </div>
    </div>`;
  }).join('');

  initAdminPressables();
  updateBulkFeedbackUI();
}

async function resolveFeedback(id) {
  if (typeof adminSupabaseClient === 'undefined' || !adminSupabaseClient) return;
  await adminSupabaseClient.from('feedback').update({ status: 'resolved' }).eq('id', id);
  showAdminToast('Feedback marked as resolved', 'success');
  loadFeedback();
}

async function reopenFeedback(id) {
  if (typeof adminSupabaseClient === 'undefined' || !adminSupabaseClient) return;
  await adminSupabaseClient.from('feedback').update({ status: 'open' }).eq('id', id);
  showAdminToast('Feedback reopened', 'info');
  loadFeedback();
}

async function deleteFeedback(id) {
  openSafeDelete('This feedback entry will be permanently removed. This cannot be undone.', async () => doDeleteFeedback(id));
}

async function doDeleteFeedback(id) {
  if (typeof adminSupabaseClient === 'undefined' || !adminSupabaseClient) return;
  await adminSupabaseClient.from('feedback').delete().eq('id', id);
  showAdminToast('Feedback deleted', 'success');
  loadFeedback();
}

/* ============================================================
   Community & Content Moderation Handlers
   ============================================================ */
function switchCommunitySub(sub) {
  document.querySelectorAll('.adm-sub-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.sub === sub));
  ['lostfound', 'reports', 'requests', 'pending-subjects'].forEach(id => {
    const el = $('commSub-' + id);
    if (el) el.hidden = (id !== sub);
  });
  if (sub === 'lostfound') loadLostFoundAdmin();
  if (sub === 'reports') loadReports();
  if (sub === 'requests') loadCommunityRequests();
  if (sub === 'pending-subjects') loadPendingSubjects();
}

/* ---- Community requests multi-select state & actions ---- */
const selectedRequestIds = new Set();
function toggleRequestSelect(id, checked) {
  const numId = isNaN(id) ? id : Number(id);
  if (checked) selectedRequestIds.add(numId);
  else selectedRequestIds.delete(numId);
  updateBulkRequestsUI();
}
window.toggleRequestSelect = toggleRequestSelect;

function toggleCheckAllRequests(checked) {
  const list = $('communityRequestsQueue');
  if (!list) return;
  const items = list.querySelectorAll('.comm-card');
  items.forEach(el => {
    const id = el.dataset.id;
    if (!id) return;
    const numId = isNaN(id) ? id : Number(id);
    const cb = el.querySelector('.adm-item-checkbox');
    if (cb) cb.checked = checked;
    if (checked) selectedRequestIds.add(numId);
    else selectedRequestIds.delete(numId);
  });
  updateBulkRequestsUI();
}
window.toggleCheckAllRequests = toggleCheckAllRequests;

function updateBulkRequestsUI() {
  const bar = $('bulkRequestsActions');
  const cnt = $('bulkRequestsCount');
  const allCb = $('checkAllRequests');
  const disp = $('requestsCountDisplay');
  const totalVis = $('communityRequestsQueue') ? $('communityRequestsQueue').querySelectorAll('.comm-card').length : 0;
  if (bar) bar.classList.toggle('visible', selectedRequestIds.size > 0);
  if (cnt) cnt.textContent = `${selectedRequestIds.size} selected`;
  if (disp) disp.textContent = `${totalVis} requests`;
  if (allCb) allCb.checked = totalVis > 0 && selectedRequestIds.size >= totalVis;
}
window.updateBulkRequestsUI = updateBulkRequestsUI;

async function bulkDeleteCommunityRequests() {
  if (!selectedRequestIds.size) return;
  openSafeDelete(`Permanently delete ${selectedRequestIds.size} selected community request(s)? This cannot be undone.`, async () => {
    if (!adminSupabaseClient) return;
    const ids = [...selectedRequestIds];
    const { error } = await adminSupabaseClient.from('senior_requests').delete().in('id', ids);
    if (error) { alert('Delete failed: ' + error.message); return; }
    selectedRequestIds.clear();
    showAdminToast('Selected community requests deleted ✓', 'success');
    loadCommunityRequests();
    updateAdminKpis();
  });
}
window.bulkDeleteCommunityRequests = bulkDeleteCommunityRequests;

async function loadCommunityRequests() {
  const host = $('communityRequestsQueue');
  if (!host) return;
  if (!adminSupabaseClient) { host.innerHTML = '<p class="note">Supabase is not configured.</p>'; updateBulkRequestsUI(); return; }
  host.innerHTML = '<p class="note">Loading junior/senior requests&hellip;</p>';
  try {
    const { data, error } = await adminSupabaseClient
      .from('senior_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) throw error;
    if (!data || !data.length) {
      host.innerHTML = '<p class="note">No junior or senior requests found in database.</p>';
      updateBulkRequestsUI();
      return;
    }
    host.innerHTML = data.map(item => {
      const typeLabel = item.type === 'pyq' ? '📝 PYQ' : '📚 Notes';
      const semLabel = `Semester ${item.semester || '?'}`;
      const statusClass = item.status === 'done' ? 'badge-approved' : 'badge-pending';
      const isChecked = selectedRequestIds.has(item.id) || selectedRequestIds.has(Number(item.id));
      return `<div class="comm-card ${item.status || ''}" data-id="${item.id}">
        <div class="comm-card-head">
          <input type="checkbox" class="adm-item-checkbox" ${isChecked ? 'checked' : ''} onchange="event.stopPropagation(); toggleRequestSelect(${item.id}, this.checked)" title="Select request">
          <span class="comm-badge ${item.type === 'pyq' ? 'type-pyq' : 'type-notes'}">${typeLabel}</span>
          <span class="badge ${statusClass}">${escapeHtml(item.status || 'open')}</span>
          <span class="comm-time">${formatISTDate(item.created_at)}</span>
        </div>
        <div class="comm-card-body">
          <div class="comm-card-title">${escapeHtml(item.subject || 'Material Request')}</div>
          ${item.message ? `<p class="comm-card-msg">${escapeHtml(item.message)}</p>` : ''}
          <div class="comm-card-meta">
            <span><i class="fa-solid fa-graduation-cap"></i> ${semLabel}</span>
            <span><i class="fa-solid fa-building-columns"></i> ${escapeHtml(collegeNames[item.college] || item.college || 'All Colleges')}</span>
            <span><i class="fa-solid fa-user"></i> ${escapeHtml(item.requester_name || 'Student')}</span>
          </div>
        </div>
        <div class="row-actions">
          ${item.status !== 'done' ? `<button class="button primary bca-pressable" onclick="resolveCommunityRequest(${item.id})"><i class="fa-solid fa-check"></i> Mark Done</button>` : ''}
          <button class="button danger bca-pressable" onclick="deleteCommunityRequest(${item.id})"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </div>`;
    }).join('');

    initAdminPressables();
    updateBulkRequestsUI();
  } catch (e) {
    host.innerHTML = '<p class="note">Error loading requests: ' + escapeHtml(e.message) + '</p>';
    updateBulkRequestsUI();
  }
}

async function resolveCommunityRequest(id) {
  if (!adminSupabaseClient) return;
  const { error } = await adminSupabaseClient.from('senior_requests').update({ status: 'done' }).eq('id', id);
  if (error) { alert('Update failed: ' + error.message); return; }
  showAdminToast('Request marked as done', 'success');
  loadCommunityRequests();
}

async function deleteCommunityRequest(id) {
  openSafeDelete('Permanently delete this junior request?', async () => {
    if (!adminSupabaseClient) return;
    const { error } = await adminSupabaseClient.from('senior_requests').delete().eq('id', id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    showAdminToast('Request deleted', 'success');
    loadCommunityRequests();
  });
}

/* ============================================================
   Admin Tabs
   ============================================================ */
function switchTab(tab) {
  // Legacy alias redirects
  if (tab === 'pending') {
    switchTab('community');
    switchCommunitySub('pending-subjects');
    return;
  }
  if (tab === 'lostfound') {
    switchTab('community');
    switchCommunitySub('lostfound');
    return;
  }
  if (tab === 'reports') {
    switchTab('community');
    switchCommunitySub('reports');
    return;
  }

  document.querySelectorAll('.admin-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  ['material', 'feedback', 'community', 'colleges', 'subjects', 'quizzes', 'users'].forEach(id => {
    const el = $('tab-' + id);
    if (el) el.hidden = (id !== tab);
  });

  if (tab === 'material') render();
  if (tab === 'feedback') loadFeedback();
  if (tab === 'community') {
    const activeSub = document.querySelector('.adm-sub-tab.active')?.dataset.sub || 'lostfound';
    switchCommunitySub(activeSub);
  }
  if (tab === 'colleges') loadApprovedCustomCollegesAdmin();
  if (tab === 'subjects') { if (!$('subjectCollege').options.length) populateSubjectFilters(); renderSubjects(); }
  if (tab === 'quizzes') loadAdminQuizzes();
  if (tab === 'users') loadUserStats();

  initAdminPressables();
}

/* ============================================================
   Subject Manager (college + semester filters, card grid)
   ============================================================ */
const subjectCollegesMap = new Proxy({}, {
  get: function(target, prop) {
    if (typeof prop === 'string') return collegeNames[prop] || prop;
    return target[prop];
  }
});
let subjects = [];

function populateSubjectFilters(){
  populateAdminCollegeDropdowns();
  const semSel = $('subjectSemester');
  if (semSel) semSel.innerHTML = '<option value="all">All Semesters</option>' + [1,2,3,4,5,6,7,8].map(s => `<option value="${s}">Semester ${s}</option>`).join('');
  const semPick = $('subjectSem');
  if (semPick) semPick.innerHTML = [1,2,3,4,5,6,7,8].map(s => `<option value="${s}">Semester ${s}</option>`).join('');
}

function findSubject(id){ return subjects.find(s => String(s.id) === String(id)) || null; }

async function loadSubjects(){
  const grid = $('subjectGrid'); if (grid) grid.innerHTML = '<p class="note">Loading&hellip;</p>';
  subjects = [];
  if (!adminSupabaseClient) { $('subjectGrid').innerHTML = '<p class="note">Supabase is not configured.</p>'; return; }
  if (!$('subjectCollege').options.length) populateSubjectFilters();
  try {
    const { data, error } = await adminSupabaseClient.from('subjects').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    subjects = data || [];
  } catch (error) {
    console.warn('Could not load subjects.', error.message);
    $('subjectGrid').innerHTML = '<p class="note">Load failed: ' + escapeHtml(error.message) + '</p>';
  }
  renderSubjects();
  loadPendingSubjects();
}

function renderSubjects(){
  const college = $('subjectCollege').value;
  const sem = $('subjectSemester').value;
  let list = subjects;
  if (college !== 'all') list = list.filter(s => s.college === college);
  if (sem !== 'all') list = list.filter(s => String(s.semester) === String(sem));
  $('subjectCountBadge').textContent = `Found ${list.length} Subject${list.length === 1 ? '' : 's'}`;
  const grid = $('subjectGrid');
  if (!list.length) { grid.innerHTML = '<p class="note">No subjects found for this filter.</p>'; return; }
  grid.innerHTML = list.map(s => {
    const isPublic = s.is_public === true || s.status === 'approved';
    const badge = isPublic ? 'pub' : 'pend';
    const label = isPublic ? 'Public' : 'Pending';
    return `<div class="subject-card">
      <div class="sc-badge-row"><span class="sc-badge ${badge}">${label}</span></div>
      <strong class="sc-name">${escapeHtml(s.name)}</strong>
      <span class="sc-code">${s.code ? escapeHtml(s.code) : '<i>No code</i>'}</span>
      <span class="sc-meta">Semester ${s.semester} &middot; ${escapeHtml(subjectCollegesMap[s.college] || s.college || 'All colleges')}</span>
      <div class="row-actions sc-actions">
        <button class="button" onclick="openSubjectModal(findSubject(${s.id}))"><i class="fa-solid fa-pen"></i> Edit</button>
        <button class="button danger" onclick="deleteSubject(${s.id})"><i class="fa-solid fa-trash"></i> Delete</button>
      </div>
    </div>`;
  }).join('');
}
/* ---- Add / Edit modal ---- */
let populatedSubjectsOnce = false;

function openSubjectModal(subject){
  $('subjectModalTitle').textContent = 'Edit Subject';
  $('subjectId').value = subject ? String(subject.id) : '';
  $('subjectName').value = subject ? subject.name : '';
  $('subjectCode').value = subject ? (subject.code || '') : '';
  if (!populatedSubjectsOnce) populateSubjectFilters();
  populatedSubjectsOnce = true;
  $('subjectSem').value = subject ? String(subject.semester) : '1';
  $('subjectCollegePick').value = subject ? (subject.college || 'all') : 'all';
  $('subjectModal').hidden = false;
  $('subjectName').focus();
}

function closeSubjectModal(){
  $('subjectModal').hidden = true;
  $('subjectForm').reset();
  $('subjectId').value = '';
}

async function saveSubject(event){
  event.preventDefault();
  const id = $('subjectId').value;
  const name = $('subjectName').value.trim();
  const code = $('subjectCode').value.trim();
  const semester = Number($('subjectSem').value);
  const college = $('subjectCollegePick').value;
  if (!name) { alert('Subject name is required.'); return; }
  if (!id) { alert('Subjects are only created by students. You can only edit existing ones.'); return; }
  // Edit only: name/code/semester/college update hoti hai,
  // status & is_public PRESERVE hota hai (pending wala pending hi rehta hai
  // — public sirf "Approve & Make Public" se hota hai).
  const payload = { name, code, semester, college };
  const btn = $('subjectSaveBtn'); btn.disabled = true;
  try {
    if (!adminSupabaseClient) throw new Error('Supabase is not configured.');
    await adminSupabaseClient.from('subjects').update(payload).eq('id', id);
    closeSubjectModal();
    await loadSubjects();
  } catch (error) {
    alert('Save failed: ' + error.message);
  }
  btn.disabled = false;
}
if ($('subjectForm')) $('subjectForm').addEventListener('submit', saveSubject);

/* ---- Subject delete via safe-delete guard ---- */
function deleteSubject(id){
  const s = findSubject(id);
  openSafeDelete(`Subject "${s ? s.name : '#' + id}" will be permanently deleted from all students. This cannot be undone.`, async () => {
    if (adminSupabaseClient) await adminSupabaseClient.from('subjects').delete().eq('id', id);
    await loadSubjects();
  });
}
/* ============================================================
   Pending Subject Moderation Queue
   ============================================================ */
function updatePendingBadge(){
  const badge = $('pendingBadge'); if (badge) badge.textContent = subjects.filter(s => s.status === 'pending').length;
}

async function loadPendingSubjects(){
  const queue = $('pendingQueue'); if (queue) queue.innerHTML = '<p class="note">Loading&hellip;</p>';
  updatePendingBadge();
  if (!adminSupabaseClient) { if (queue) queue.innerHTML = '<p class="note">Supabase is not configured.</p>'; return; }
  let pending = subjects.filter(s => s.status === 'pending');
  if (!subjects.length) {
    const { data, error } = await adminSupabaseClient.from('subjects').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (error) { if (queue) queue.innerHTML = '<p class="note">Load failed: ' + escapeHtml(error.message) + '</p>'; return; }
    pending = data || [];
  }
  if (!pending.length) { if (queue) queue.innerHTML = '<p class="note">No pending subject requests. 🎉</p>'; return; }
  queue.innerHTML = pending.map(s => `
    <div class="pending-row">
      <div class="pr-main">
        <strong>${escapeHtml(s.name)}</strong>
        ${s.code ? `<span class="pr-code">${escapeHtml(s.code)}</span>` : ''}
        <span class="pr-meta">Semester ${s.semester} &middot; ${escapeHtml(subjectCollegesMap[s.college] || s.college || 'All colleges')}</span>
        ${s.created_by ? `<span class="pr-by"><i class="fa-solid fa-user"></i> ${escapeHtml(s.created_by)}</span>` : ''}
      </div>
      <div class="row-actions pr-actions">
        <button class="button primary" onclick="approvePendingSubject(${s.id})"><i class="fa-solid fa-check"></i> Approve &amp; Make Public</button>
        <button class="button danger" onclick="rejectPendingSubject(${s.id})"><i class="fa-solid fa-trash"></i> Reject</button>
      </div>
    </div>`).join('');
}

async function approvePendingSubject(id){
  if (!adminSupabaseClient) return;
  await adminSupabaseClient.from('subjects').update({ status: 'approved', is_public: true }).eq('id', id);
  await loadSubjects();
}

function rejectPendingSubject(id){
  const s = subjects.find(sub => String(sub.id) === String(id));
  openSafeDelete(`Pending subject request "${s ? s.name : '#' + id}" will be fully deleted (rejected). This cannot be undone.`, async () => {
    if (adminSupabaseClient) await adminSupabaseClient.from('subjects').delete().eq('id', id);
    await loadSubjects();
  });
}

/* ============================================================
   Reusable Safe Delete Guard (Random 4-digit PIN confirmation)
   ============================================================ */
let safeDeleteFn = null;
let safeDeletePin = '';

function openSafeDelete(desc, actionFn){
  safeDeleteFn = actionFn;
  safeDeletePin = String(Math.floor(1000 + Math.random() * 9000)); // 1000–9999
  $('safeDeleteDesc').textContent = desc;
  $('safeDeletePin').textContent = safeDeletePin;
  $('safeDeleteInput').value = '';
  $('safeDeleteError').textContent = '';
  $('safeDeleteInput').disabled = false;
  $('safeDeleteConfirm').disabled = true;
  $('safeDeleteModal').hidden = false;
  $('safeDeleteInput').focus();
}

function closeSafeDelete(){
  $('safeDeleteModal').hidden = true;
  safeDeleteFn = null;
}

function onSafeDeleteInput(){
  const input = $('safeDeleteInput');
  const val = input.value.replace(/\D/g, '').slice(0, 4);
  input.value = val;
  const match = val === safeDeletePin;
  $('safeDeleteConfirm').disabled = !match;
  $('safeDeleteError').textContent = (val && !match) ? 'PIN does not match. Try again.' : '';
}

async function confirmSafeDelete(){
  if ($('safeDeleteConfirm').disabled || !safeDeleteFn) return;
  const fn = safeDeleteFn;
  closeSafeDelete();
  await fn();
}
/* ---- Lost & Found moderation ---- */
const LOST_FOUND_ADMIN_CATS={phone:'Phone',wallet:'Wallet',bottle:'Water Bottle',bag:'Bag / Backpack',keys:'Keys',laptop:'Laptop',books:'Books / Notes',idcard:'ID / Library Card',earphones:'Earphones / Headphones',spectacles:'Spectacles',watch:'Watch',stationery:'Stationery',other:'Other'};
function lfAdmCatName(v){return LOST_FOUND_ADMIN_CATS[v]||v||'Other'}
function lfAdmStatusBadge(st){return '<span class="lf-adm-status" data-st="'+st+'">'+String(st||'active').replace(/^./,c=>c.toUpperCase())+'</span>'}
/**
 * Storage Purge Helper: Extracts bucket path(s) and removes from Supabase Storage
 */
async function wipeLostFoundImageFromStorageAdmin(imageUrls) {
  if (!adminSupabaseClient || !imageUrls) return;
  const list = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
  const paths = [];

  for (const item of list) {
    if (!item || typeof item !== 'string') continue;
    let path = item.trim();
    const match = path.match(/\/lossfound\/(.+)$/);
    if (match) {
      path = match[1].split('?')[0].split('#')[0];
    } else if (path.startsWith('http')) {
      const idx = path.indexOf('/lossfound/');
      if (idx !== -1) path = path.slice(idx + '/lossfound/'.length).split('?')[0].split('#')[0];
    }
    if (path && !path.startsWith('http')) {
      paths.push(decodeURIComponent(path));
    }
  }

  if (!paths.length) return;
  try {
    const { data, error } = await adminSupabaseClient.storage.from('lossfound').remove(paths);
    if (error) console.warn('[Admin] storage image purge note:', error.message);
    else showAdminToast(`Purged ${paths.length} storage image(s) ✓`, 'info');
  } catch (err) {
    console.warn('[Admin] wipe storage error:', err);
  }
}

/**
 * Purge Old Removed Images: Scans lost_found table for resolved/removed posts
 * that still have image_url references, deletes images from bucket and clears image_url.
 */
async function purgeOldRemovedImages() {
  if (!adminSupabaseClient) return;
  if (!confirm('Scan and permanently wipe storage images for all removed and resolved Lost & Found posts?')) return;
  showAdminToast('Scanning storage images to purge...', 'info');

  try {
    const { data, error } = await adminSupabaseClient
      .from('lost_found')
      .select('id, image_url')
      .in('status', ['removed', 'resolved'])
      .neq('image_url', '');

    if (error) throw error;
    if (!data || !data.length) {
      showAdminToast('Zero old images found to purge. Storage is clean! ✅', 'success');
      return;
    }

    const imagesToWipe = data.map(d => d.image_url).filter(Boolean);
    await wipeLostFoundImageFromStorageAdmin(imagesToWipe);

    const ids = data.map(d => d.id);
    await adminSupabaseClient.from('lost_found').update({ image_url: '' }).in('id', ids);

    showAdminToast(`Successfully purged images for ${data.length} post(s)! Storage freed ✅`, 'success');
    loadLostFoundAdmin();
  } catch (err) {
    showAdminToast('Purge failed: ' + err.message, 'error');
  }
}
window.purgeOldRemovedImages = purgeOldRemovedImages;

/* ---- Lost & Found multi-select state & actions ---- */
const selectedLostFoundIds = new Set();
function toggleLostFoundSelect(id, checked) {
  const numId = isNaN(id) ? id : Number(id);
  if (checked) selectedLostFoundIds.add(numId);
  else selectedLostFoundIds.delete(numId);
  updateBulkLostFoundUI();
}
window.toggleLostFoundSelect = toggleLostFoundSelect;

function toggleCheckAllLostFound(checked) {
  const list = $('lostfoundQueue');
  if (!list) return;
  const items = list.querySelectorAll('.lf-admin-item');
  items.forEach(el => {
    const id = el.dataset.id;
    if (!id) return;
    const numId = isNaN(id) ? id : Number(id);
    const cb = el.querySelector('.adm-item-checkbox');
    if (cb) cb.checked = checked;
    if (checked) selectedLostFoundIds.add(numId);
    else selectedLostFoundIds.delete(numId);
  });
  updateBulkLostFoundUI();
}
window.toggleCheckAllLostFound = toggleCheckAllLostFound;

function updateBulkLostFoundUI() {
  const bar = $('bulkLostFoundActions');
  const cnt = $('bulkLostFoundCount');
  const allCb = $('checkAllLostFound');
  const disp = $('lostfoundCountDisplay');
  const totalVis = $('lostfoundQueue') ? $('lostfoundQueue').querySelectorAll('.lf-admin-item').length : 0;
  if (bar) bar.classList.toggle('visible', selectedLostFoundIds.size > 0);
  if (cnt) cnt.textContent = `${selectedLostFoundIds.size} selected`;
  if (disp) disp.textContent = `${totalVis} items`;
  if (allCb) allCb.checked = totalVis > 0 && selectedLostFoundIds.size >= totalVis;
}
window.updateBulkLostFoundUI = updateBulkLostFoundUI;

async function bulkDeleteLostFound() {
  if (!selectedLostFoundIds.size) return;
  openSafeDelete(`Permanently delete ${selectedLostFoundIds.size} selected Lost & Found post(s) and wipe images from cloud storage?`, async () => {
    if (!adminSupabaseClient) return;
    const ids = [...selectedLostFoundIds];
    try {
      const { data: lfItems } = await adminSupabaseClient.from('lost_found').select('id, image_url').in('id', ids);
      if (lfItems && lfItems.length) {
        const fileUrls = lfItems.map(item => item.image_url).filter(Boolean);
        if (fileUrls.length) {
          await wipeLostFoundImageFromStorageAdmin(fileUrls);
        }
      }
    } catch (_imgErr) {
      console.warn('[Admin] bulkDeleteLostFound image wipe note:', _imgErr);
    }

    const { error } = await adminSupabaseClient.from('lost_found').delete().in('id', ids);
    if (error) { alert('Delete failed: ' + error.message); return; }
    selectedLostFoundIds.clear();
    showAdminToast('Selected Lost & Found posts deleted and storage wiped ✓', 'success');
    loadLostFoundAdmin();
    updateAdminKpis();
  });
}
window.bulkDeleteLostFound = bulkDeleteLostFound;

async function loadLostFoundAdmin(){
  const host=$('lostfoundQueue');if(!host)return;
  if(!adminSupabaseClient){host.innerHTML='<p class="note">Supabase is not configured.</p>';updateBulkLostFoundUI();return}
  const {data,error}=await adminSupabaseClient.from('lost_found').select('*').order('created_at',{ascending:false}).limit(100);
  if(error){host.innerHTML='<p class="note">Could not load posts. ('+escapeHtml(error.message)+')</p>';updateBulkLostFoundUI();return}
  const rows=data||[];
  if(!rows.length){host.innerHTML='<p class="note">No Lost &amp; Found posts yet.</p>';updateBulkLostFoundUI();return}

  const nowMs = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  let unnotified30dCount = 0;
  let sample30dTitle = '';
  let sample30dCollege = '';

  host.innerHTML=rows.map(r=>{
    const label=r.type==='lost'?'LOST':'FOUND';
    const cls=r.type==='lost'?'lf-adm-lost':'lf-adm-found';
    const item=(r.category==='other'&&(r.custom_category||'').trim())?r.custom_category:lfAdmCatName(r.category);
    const college=(collegeNames&&collegeNames[r.college])||r.college||'all';
    const who=(r.poster_name||'').replace(/[<>&"']/g,'');
    const time=r.created_at?new Date(r.created_at).toLocaleString():'';
    const isChecked = selectedLostFoundIds.has(r.id) || selectedLostFoundIds.has(Number(r.id));
    const img=r.image_url
      ?'<a href="'+escapeHtml(r.image_url)+'" target="_blank" rel="noopener" title="Open full image"><img class="lf-adm-thumb" src="'+escapeHtml(r.image_url)+'" alt="Item photo"></a>'
      :'<span class="lf-adm-noimg"><i class="fa-solid fa-image"></i> No photo</span>';

    // 30-Day Unresolved Escalation Detection
    const createdMs = r.created_at ? new Date(r.created_at).getTime() : nowMs;
    const is30DaysOld = (nowMs - createdMs >= THIRTY_DAYS_MS) && (r.status !== 'resolved' && r.status !== 'removed');

    if (is30DaysOld && !r.admin_30d_notified) {
      unnotified30dCount++;
      if (!sample30dTitle) sample30dTitle = item;
      if (!sample30dCollege) sample30dCollege = college;
    }

    const badge30d = is30DaysOld
      ? '<span class="adm-pill" style="background:#f59e0b;color:#000;font-weight:700;font-size:11px;padding:3px 8px;margin-left:6px;"><i class="fa-solid fa-triangle-exclamation"></i> 30+ DAYS OLD</span>'
      : '';

    let actions='';
    if (is30DaysOld) {
      // 30-day escalation one-tap admin controls
      actions = `
        <div class="row-actions" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="button danger bca-pressable" onclick="removeAndWipeLostFoundPost(${r.id}, '${escapeHtml(r.image_url || '')}')">
            <i class="fa-solid fa-trash-can"></i> Remove &amp; Wipe Image
          </button>
          <button class="button primary bca-pressable" onclick="extendLostFoundPost(${r.id})">
            <i class="fa-solid fa-clock-rotate-left"></i> Keep Active (+30 Days)
          </button>
        </div>`;
    } else if(r.status==='pending'){
      actions='<div class="row-actions">'
        +'<button class="button primary bca-pressable" onclick="approveLostFoundPost('+r.id+')"><i class="fa-solid fa-check"></i> Approve</button>'
        +'<button class="button danger bca-pressable" onclick="removeAndWipeLostFoundPost('+r.id+', \''+escapeHtml(r.image_url||'')+'\')"><i class="fa-solid fa-xmark"></i> Reject &amp; Wipe</button>'
        +'</div>';
    } else if(r.status==='removed'){
      actions=`<div class="note" style="display:flex;align-items:center;justify-content:space-between;">
        <span>Rejected / archived (removed from public feed).</span>
        ${r.image_url ? `<button class="button danger bca-pressable" style="padding:4px 8px;font-size:11px;" onclick="wipeLostFoundImageFromStorageAdmin('${escapeHtml(r.image_url)}')"><i class="fa-solid fa-broom"></i> Wipe Image</button>` : ''}
      </div>`;
    } else {
      actions='<div class="row-actions"><button class="button danger bca-pressable" onclick="removeAndWipeLostFoundPost('+r.id+', \''+escapeHtml(r.image_url||'')+'\')"><i class="fa-solid fa-trash"></i> Remove &amp; Wipe Image</button></div>';
    }
    return '<div class="lf-admin-item '+r.status+' '+(is30DaysOld?'escalated-30d':'')+'" data-id="'+r.id+'" style="'+(is30DaysOld?'border-left:4px solid #f59e0b;':'')+'">'
      +'<div class="lf-adm-head">'
      +'<input type="checkbox" class="adm-item-checkbox" '+(isChecked?'checked':'')+' onchange="event.stopPropagation(); toggleLostFoundSelect('+r.id+', this.checked)" title="Select item">'
      +'<span class="lf-adm-badge '+cls+'">'+label+'</span>'+lfAdmStatusBadge(r.status)+badge30d+'<small>'+time+'</small></div>'
      +'<div class="lf-adm-withimg">'+img
      +'<div class="lf-adm-info"><div class="lf-adm-body"><b>'+escapeHtml(item)+'</b> &mdash; '+escapeHtml(r.description||'')+'</div>'
      +'<div class="lf-adm-meta"><span>&#128205; '+escapeHtml(r.location||'')+'</span><span>&#127979; '+escapeHtml(college)+'</span>'
      +(r.poster_avatar?'<img src="'+escapeHtml(r.poster_avatar)+'" alt="" width="18" height="18" style="border-radius:50%;object-fit:cover">':'')
      +'<span>'+(who||'Student')+'</span></div></div></div>'
      +actions
      +'</div>';
  }).join('');

  initAdminPressables();
  updateBulkLostFoundUI();

  // Deduplicated single Telegram summary alert for 30+ day old items
  if (unnotified30dCount > 0) {
    trigger30dEscalationTelegramAlert(unnotified30dCount, sample30dTitle, sample30dCollege);
  }
}

async function trigger30dEscalationTelegramAlert(count, sampleTitle, college) {
  try {
    fetch('/api/telegram-admin-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'lost_found_escalation_30d',
        payload: {
          count: count,
          sample_title: sampleTitle,
          college: college
        }
      })
    }).catch(() => {});

    // Mark as notified in database so it does not spam
    if (adminSupabaseClient) {
      const nowMs = Date.now();
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const cutoff = new Date(nowMs - THIRTY_DAYS_MS).toISOString();
      await adminSupabaseClient
        .from('lost_found')
        .update({ admin_30d_notified: true })
        .lte('created_at', cutoff)
        .eq('admin_30d_notified', false);
    }
  } catch (_e) {}
}

async function removeAndWipeLostFoundPost(id, imageUrl) {
  if (!adminSupabaseClient) return;
  if (!confirm(`Permanently remove Lost & Found post #${id} and wipe its storage image?`)) return;

  try {
    if (imageUrl) {
      await wipeLostFoundImageFromStorageAdmin(imageUrl);
    }
    // Delete database post record immediately
    const { error } = await adminSupabaseClient.from('lost_found').delete().eq('id', id);
    if (error) {
      // Fallback: update status to removed if delete RLS prevents hard delete
      await adminSupabaseClient.from('lost_found').update({ status: 'removed', image_url: '' }).eq('id', id);
    }
    showAdminToast(`Removed post #${id} and wiped image from storage ✓`, 'success');
    loadLostFoundAdmin();
  } catch (err) {
    showAdminToast('Could not remove post: ' + err.message, 'error');
  }
}
window.removeAndWipeLostFoundPost = removeAndWipeLostFoundPost;

async function extendLostFoundPost(id) {
  if (!adminSupabaseClient) return;
  try {
    const { error } = await adminSupabaseClient
      .from('lost_found')
      .update({
        created_at: new Date().toISOString(),
        admin_30d_notified: false,
        status: 'active'
      })
      .eq('id', id);

    if (error) throw error;
    showAdminToast(`Timer reset for post #${id} (+30 days active) ✓`, 'success');
    loadLostFoundAdmin();
  } catch (err) {
    showAdminToast('Could not extend timer: ' + err.message, 'error');
  }
}
window.extendLostFoundPost = extendLostFoundPost;
async function approveLostFoundPost(id){
  if(!adminSupabaseClient) return;
  const { error } = await adminSupabaseClient.from('lost_found').update({ status: 'active' }).eq('id', id);
  if (error) {
    showAdminToast('Approve failed: ' + error.message, 'error');
    return;
  }
  showAdminToast('Post approved!', 'success');
  /* Approve hote hi college ko push (notify-lostfound Edge Function) */
  try {
    const sec = getAdminSecret();
    let authHeader = 'Bearer ' + (typeof SUPABASE_PUBLISHABLE_KEY !== 'undefined' ? SUPABASE_PUBLISHABLE_KEY : '');
    if (adminSupabaseClient) {
      try {
        const { data } = await adminSupabaseClient.auth.getSession();
        if (data && data.session && data.session.access_token) {
          authHeader = 'Bearer ' + data.session.access_token;
        }
      } catch (e) {}
    }
    const headers = {
      'Content-Type': 'application/json',
      'apikey': typeof SUPABASE_PUBLISHABLE_KEY !== 'undefined' ? SUPABASE_PUBLISHABLE_KEY : '',
      'Authorization': authHeader
    };
    if (sec) headers['x-admin-secret'] = sec;
    const res = await fetch(SUPABASE_URL + '/functions/v1/notify-lostfound', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ post_id: id, secret: sec })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok && result.blocked === 'daily-limit') {
      showAdminToast('Notification blocked: daily post limit reached for this user.', 'info');
    } else if (!res.ok) {
      const detail = [result.error, result.hint].filter(Boolean).join(' | ');
      console.warn('LostFound notification failed: ' + (detail || res.status));
    } else {
      console.info('[LostFound] push sent:', result.sent, 'failed:', result.failed);
    }
  } catch(e) { console.warn('LostFound notify failed:', e.message); }
  loadLostFoundAdmin();
}
async function removeLostFoundPost(id){
  if(!adminSupabaseClient)return;
  try {
    const { data } = await adminSupabaseClient.from('lost_found').select('image_url').eq('id', id).maybeSingle();
    if (data && data.image_url) {
      await wipeLostFoundImageFromStorageAdmin(data.image_url);
    }
  } catch (_e) {}
  await adminSupabaseClient.from('lost_found').update({status:'removed', image_url:''}).eq('id',id);
  loadLostFoundAdmin();
}
/* ---- Boot ---- */
document.documentElement.dataset.theme = localStorage.getItem('bca-theme') || 'dark';
updateThemeIcon();
$('authForm').addEventListener('submit', submitAuth);

function initAdminPressables() {
  if (window.BCA_UI && window.BCA_UI.PressableScale) {
    document.querySelectorAll('.bca-pressable, .adm-kpi-card, .adm-tab, .adm-pill, .adm-sub-tab, .button').forEach(el => {
      if (!el.dataset.pressableInit) {
        el.dataset.pressableInit = 'true';
        window.BCA_UI.PressableScale(el, { scale: 0.97, haptic: true });
      }
    });
  }
}

// Global pressable listener on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  updateThemeIcon();
  initAdminPressables();
});

async function initAuth() {
  updateThemeIcon();
  initAdminPressables();
  if (!adminSupabaseClient) { setAuthMessage('Supabase is not configured.'); return; }
  const { data } = await adminSupabaseClient.auth.getSession();
  if (data.session) await showAdmin(data.session);
}

initAuth();

/* ---- PWA: installable admin panel ---- */
let deferredAdminInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredAdminInstallPrompt = e;
  const btn = $('adminInstallBtn');
  if (btn) btn.hidden = false;
});
window.addEventListener('appinstalled', () => {
  deferredAdminInstallPrompt = null;
  const btn = $('adminInstallBtn');
  if (btn) btn.hidden = true;
});
async function installAdminPwa() {
  if (deferredAdminInstallPrompt) {
    deferredAdminInstallPrompt.prompt();
    await deferredAdminInstallPrompt.userChoice;
    deferredAdminInstallPrompt = null;
    const btn = $('adminInstallBtn');
    if (btn) btn.hidden = true;
  }
}
window.installAdminPwa = installAdminPwa;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(error => console.info('Admin PWA service worker unavailable.', error.message))
  );
}

/* ---- Admin Alerts: web-push subscription (role='admin') ---- */
const ADMIN_ALERT_PREF_KEY = 'bca-admin-alerts'; // 'on' | null

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function setAdminNotifyButton() {
  const btn = $('adminNotifyBtn');
  if (!btn) return;
  const enabled = localStorage.getItem(ADMIN_ALERT_PREF_KEY) === 'on';
  btn.classList.toggle('active', enabled);
  btn.title = enabled ? 'Admin Alerts Enabled (tap to disable)' : 'Enable Admin Push Alerts';
  btn.innerHTML = enabled
    ? '<i class="fa-solid fa-bell-slash"></i>'
    : '<i class="fa-solid fa-bell"></i>';
}

async function saveAdminSubscription(subscription, uid) {
  if (!adminSupabaseClient) return;
  const json = subscription.toJSON();
  const row = {
    endpoint: json.endpoint,
    p256dh: json.keys && json.keys.p256dh,
    auth: json.keys && json.keys.auth,
    college: 'all',
    semester: null,
    uid: uid || null,
    role: 'admin'
  };
  const { error } = await adminSupabaseClient
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' });
  if (error) console.info('Admin subscription save failed:', error.message);
}

async function adminSubscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('Push notifications are not supported in this browser.');
    return;
  }
  if (!adminSupabaseClient) {
    alert('Supabase is not configured — cannot save admin alerts.');
    return;
  }

  // Toggle off: unsubscribe + remove stored row
  if (localStorage.getItem(ADMIN_ALERT_PREF_KEY) === 'on') {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await adminSupabaseClient.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }
    } catch (e) { /* best effort */ }
    localStorage.removeItem(ADMIN_ALERT_PREF_KEY);
    setAdminNotifyButton();
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    alert('Notification permission was denied. Enable it in browser settings to get admin alerts.');
    return;
  }

  try {
    const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
    await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    let uid = null;
    try {
      const { data } = await adminSupabaseClient.auth.getSession();
      uid = data && data.session ? data.session.user.id : null;
    } catch (e) { /* uid optional */ }
    await saveAdminSubscription(subscription, uid);
    localStorage.setItem(ADMIN_ALERT_PREF_KEY, 'on');
    setAdminNotifyButton();
    try {
      await reg.showNotification('BCAPrime Admin', {
        body: 'Admin alerts are now ON. You will be notified of new uploads.',
        icon: '/assets/logo.png',
        badge: '/assets/logo.png',
        tag: 'admin-alert'
      });
    } catch (e) { /* notification test optional */ }
  } catch (error) {
    console.info('Admin push subscribe failed.', error.message);
    alert('Could not enable admin alerts: ' + error.message);
  }
}

setAdminNotifyButton();

/* ============================================================
   Resource Reports moderation & alert system
   ============================================================ */
let reports = [];

function showReportAlertBanner(rep) {
  const banner = $('reportAlertBanner');
  if (!banner) return;
  const text = $('reportAlertBannerText');
  if (text) {
    const title = rep && rep.resource_title ? `"${rep.resource_title}"` : 'A resource';
    const reason = rep && rep.reason ? ` (${rep.reason})` : '';
    text.textContent = `New Report: ${title}${reason}`;
  }
  banner.hidden = false;
  banner.classList.add('show');
}

function dismissReportBanner() {
  const banner = $('reportAlertBanner');
  if (banner) {
    banner.classList.remove('show');
    banner.hidden = true;
  }
}

async function loadReports() {
  const queue = $('reportsQueue');
  if (!adminSupabaseClient) {
    if (queue) queue.innerHTML = '<p class="note">Supabase is not configured.</p>';
    return;
  }
  try {
    const { data, error } = await adminSupabaseClient
      .from('resource_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    reports = data || [];
  } catch (err) {
    console.warn('Could not load resource reports:', err.message);
    if (queue) queue.innerHTML = '<p class="note">Failed to load reports: ' + escapeHtml(err.message) + '</p>';
    return;
  }

  // Update report statistics
  const total = reports.length;
  const openCount = reports.filter(r => r.status === 'open').length;
  const resolvedCount = reports.filter(r => r.status === 'resolved').length;

  const repTot = $('repStatTotal'); if (repTot) repTot.textContent = total;
  const repOp = $('repStatOpen'); if (repOp) repOp.textContent = openCount;
  const repRes = $('repStatResolved'); if (repRes) repRes.textContent = resolvedCount;

  // Update tab badge
  const badge = $('reportsBadge');
  if (badge) {
    badge.textContent = openCount;
    badge.hidden = (openCount === 0);
  }

  renderReports();
}

function renderReports() {
  const queue = $('reportsQueue');
  if (!queue) return;
  const filter = ($('reportStatusFilter') && $('reportStatusFilter').value) || 'open';
  const list = reports.filter(r => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  if (!list.length) {
    queue.innerHTML = `<div class="rep-empty-card">
      <i class="fa-solid fa-circle-check" style="color:var(--good);font-size:32px;margin-bottom:10px;"></i>
      <h3>No ${filter === 'all' ? '' : filter} reports found</h3>
      <p class="note">Everything looks good! When students report an issue with notes or PYQs, it will appear here.</p>
    </div>`;
    return;
  }

  queue.innerHTML = list.map(item => {
    const st = item.status || 'open';
    const statusClass = {
      open: 'rep-st-open',
      reviewed: 'rep-st-reviewed',
      resolved: 'rep-st-resolved',
      dismissed: 'rep-st-dismissed'
    }[st] || 'rep-st-open';

    const whoLine = [item.reporter_name, item.reporter_email].filter(Boolean).join(' · ');
    const timeFormatted = item.created_at ? new Date(item.created_at).toLocaleString() : '';

    const matchedUpload = uploads.find(u => String(u.id) === String(item.resource_id) || u.title === item.resource_title);
    const viewMaterialBtn = matchedUpload && matchedUpload.fileUrl ?
      `<a href="${escapeHtml(matchedUpload.fileUrl)}" target="_blank" rel="noopener" class="button" title="Open source file"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open file</a>` : '';

    return `<div class="report-card ${statusClass}" data-id="${item.id}">
      <div class="rep-card-head">
        <span class="rep-badge ${statusClass}">${escapeHtml(st.toUpperCase())}</span>
        <span class="rep-reason-badge"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(item.reason)}</span>
        <small class="rep-time">${timeFormatted}</small>
      </div>

      <div class="rep-res-title">
        <i class="fa-solid fa-file-lines" style="color:var(--brand);margin-right:6px;"></i>
        <strong>${escapeHtml(item.resource_title || 'Untitled resource')}</strong>
        ${item.resource_id ? `<span class="rep-res-id">ID: #${item.resource_id}</span>` : ''}
      </div>

      ${item.details ? `<p class="rep-details">"${escapeHtml(item.details)}"</p>` : ''}

      <div class="rep-meta-footer">
        <div class="rep-who">
          <i class="fa-regular fa-user"></i>
          <span>Reported by: <b>${escapeHtml(whoLine || 'Student')}</b></span>
          ${item.reporter_uid ? `<small>(${escapeHtml(item.reporter_uid.slice(0, 8))}&hellip;)</small>` : ''}
        </div>

        <div class="rep-actions">
          ${viewMaterialBtn}
          ${st === 'open' ? `<button class="button" onclick="updateReportStatus(${item.id}, 'reviewed')"><i class="fa-solid fa-eye"></i> Mark Reviewed</button>` : ''}
          ${st !== 'resolved' ? `<button class="button primary" onclick="updateReportStatus(${item.id}, 'resolved')"><i class="fa-solid fa-check"></i> Mark Resolved</button>` : ''}
          ${st !== 'dismissed' && st !== 'resolved' ? `<button class="button" onclick="updateReportStatus(${item.id}, 'dismissed')"><i class="fa-solid fa-ban"></i> Dismiss</button>` : ''}
          ${st === 'resolved' || st === 'dismissed' ? `<button class="button" onclick="updateReportStatus(${item.id}, 'open')"><i class="fa-solid fa-rotate-left"></i> Reopen</button>` : ''}
          <button class="button danger" onclick="deleteReport(${item.id})" title="Delete report record"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function updateReportStatus(id, newStatus) {
  if (!adminSupabaseClient) return;
  try {
    const updatePayload = {
      status: newStatus,
      resolved_at: (newStatus === 'resolved' ? new Date().toISOString() : null)
    };
    const { error } = await adminSupabaseClient
      .from('resource_reports')
      .update(updatePayload)
      .eq('id', id);
    if (error) throw error;
    const rep = reports.find(r => r.id === id);
    if (rep) {
      rep.status = newStatus;
      rep.resolved_at = updatePayload.resolved_at;
    }
    loadReports();
  } catch (err) {
    console.error('Failed to update report status:', err);
    alert('Could not update status: ' + err.message);
  }
}

async function deleteReport(id) {
  openSafeDelete('This resource report record will be permanently deleted.', async () => doDeleteReport(id));
}

async function doDeleteReport(id) {
  if (!adminSupabaseClient) return;
  try {
    const { error } = await adminSupabaseClient
      .from('resource_reports')
      .delete()
      .eq('id', id);
    if (error) throw error;
    reports = reports.filter(r => r.id !== id);
    loadReports();
  } catch (err) {
    console.error('Failed to delete report:', err);
    alert('Could not delete report: ' + err.message);
  }
}

/* ============================================================
   Mock Tests & MCQ Admin Logic
   ============================================================ */
let adminQuizzes = [];
let parsedImportQuestions = [];
let currentViewingQuiz = null;
let currentViewingQuestions = [];

async function loadAdminQuizzes() {
  const grid = $('adminQuizGrid');
  if (grid) grid.innerHTML = '<p class="note">Loading mock tests&hellip;</p>';
  if (!adminSupabaseClient) {
    if (grid) grid.innerHTML = '<p class="note">Supabase is not configured.</p>';
    return;
  }

  try {
    const { data, error } = await adminSupabaseClient
      .from('quizzes')
      .select('*, questions(count)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    adminQuizzes = data || [];
    renderAdminQuizzes();
    updateQuizStats();
  } catch (err) {
    console.error('Failed to load admin quizzes:', err);
    if (grid) grid.innerHTML = `<p class="note">Load failed: ${escapeHtml(err.message)}</p>`;
  }
}

function updateQuizStats() {
  const total = adminQuizzes.length;
  let totalQuestions = 0;
  let aiCount = 0;

  adminQuizzes.forEach(q => {
    const count = (q.questions && q.questions[0] && q.questions[0].count) || q.total_questions || 0;
    totalQuestions += count;
    if (q.is_ai_generated) aiCount++;
  });

  if ($('quizStatTotal')) $('quizStatTotal').textContent = total;
  if ($('quizStatQuestions')) $('quizStatQuestions').textContent = totalQuestions;
  if ($('quizStatAi')) $('quizStatAi').textContent = aiCount;
}

function renderAdminQuizzes() {
  const grid = $('adminQuizGrid');
  if (!grid) return;

  const semFilter = $('quizFilterSem') ? $('quizFilterSem').value : 'all';
  const query = ($('quizSearch') ? $('quizSearch').value : '').toLowerCase().trim();

  let filtered = adminQuizzes.filter(q => {
    if (semFilter !== 'all' && String(q.semester) !== String(semFilter)) return false;
    if (query) {
      const matchTitle = (q.title || '').toLowerCase().includes(query);
      const matchSub = (q.subject || '').toLowerCase().includes(query);
      if (!matchTitle && !matchSub) return false;
    }
    return true;
  });

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="rep-empty-card" style="grid-column: 1 / -1;">
        <i class="fa-solid fa-list-check" style="font-size:32px;color:var(--muted);margin-bottom:10px"></i>
        <h3>No mock tests found</h3>
        <p style="color:var(--muted);font-size:13px;margin:0 0 14px">Create a quiz manually or bulk import questions using CSV/JSON.</p>
        <button class="button primary" onclick="openBulkImportModal()"><i class="fa-solid fa-file-import"></i> Bulk Import MCQs</button>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(q => {
    const qCount = (q.questions && q.questions[0] && q.questions[0].count) || q.total_questions || 0;
    const timeLimit = q.time_limit_minutes || 15;
    const isAi = q.is_ai_generated;
    const createdDate = q.created_at ? new Date(q.created_at).toLocaleDateString() : 'Recent';

    return `
      <div class="quiz-card" id="quiz-card-${q.id}">
        <div>
          <div class="quiz-card-head">
            <div class="quiz-badges">
              <span class="quiz-badge sem"><i class="fa-solid fa-graduation-cap"></i> Sem ${q.semester}</span>
              ${isAi ? '<span class="quiz-badge ai"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Generated</span>' : '<span class="quiz-badge"><i class="fa-solid fa-user-tie"></i> Verified</span>'}
            </div>
            <span style="font-size:11.5px;color:var(--muted)">${createdDate}</span>
          </div>

          <h3 class="quiz-title" style="margin-top:8px">${escapeHtml(q.title)}</h3>
          <div class="quiz-subject">
            <i class="fa-solid fa-book-bookmark" style="color:var(--brand)"></i>
            <span>${escapeHtml(q.subject)}</span>
          </div>
        </div>

        <div>
          <div class="quiz-meta-row">
            <span>Questions: <strong>${qCount}</strong></span>
            <span>Duration: <strong>${timeLimit} mins</strong></span>
          </div>

          <div class="quiz-actions" style="margin-top:12px">
            <button class="button" onclick="viewQuizQuestions(${q.id})"><i class="fa-solid fa-eye"></i> Questions</button>
            <button class="button" onclick="appendQuestionsToQuiz(${q.id})"><i class="fa-solid fa-plus"></i> Import More</button>
            <button class="button danger" onclick="deleteQuiz(${q.id})" title="Delete Quiz"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/* ---- Bulk Import Modal Logic ---- */
function openBulkImportModal() {
  parsedImportQuestions = [];
  const modal = $('bulkImportModal');
  if (!modal) return;

  // Populate Target Quiz Select
  const sel = $('importQuizTarget');
  if (sel) {
    sel.innerHTML = '<option value="new">+ Create New Quiz for these MCQs</option>' +
      adminQuizzes.map(q => `<option value="${q.id}">Append to: [Sem ${q.semester}] ${escapeHtml(q.title)}</option>`).join('');
  }

  if ($('importQuizTitle')) $('importQuizTitle').value = '';
  if ($('importQuizSubject')) $('importQuizSubject').value = '';
  if ($('importQuizSem')) $('importQuizSem').value = '3';
  if ($('importQuizTime')) $('importQuizTime').value = '15';
  if ($('importFileInput')) $('importFileInput').value = '';
  if ($('importError')) $('importError').textContent = '';
  if ($('importDropzoneTitle')) $('importDropzoneTitle').textContent = 'Choose a JSON or CSV file to parse';
  if ($('importPreviewContainer')) $('importPreviewContainer').hidden = true;
  if ($('btnConfirmImport')) $('btnConfirmImport').disabled = true;

  toggleImportTargetFields();
  setupImportDropzone();
  modal.hidden = false;
}

function appendQuestionsToQuiz(quizId) {
  openBulkImportModal();
  const sel = $('importQuizTarget');
  if (sel) {
    sel.value = String(quizId);
    toggleImportTargetFields();
  }
}

function closeBulkImportModal() {
  const modal = $('bulkImportModal');
  if (modal) modal.hidden = true;
  parsedImportQuestions = [];
}

function toggleImportTargetFields() {
  const target = $('importQuizTarget') ? $('importQuizTarget').value : 'new';
  const newFields = $('importNewQuizFields');
  if (newFields) newFields.hidden = (target !== 'new');
}

function setupImportDropzone() {
  const dz = $('importDropzone');
  if (!dz || dz.__hasDropEvents) return;
  dz.__hasDropEvents = true;

  ['dragenter', 'dragover'].forEach(eventName => {
    dz.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dz.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.remove('dragover');
    }, false);
  });

  dz.addEventListener('drop', e => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length) {
      handleImportFile(files[0]);
    }
  }, false);
}

function handleImportFileSelect(input) {
  if (input.files && input.files.length) {
    handleImportFile(input.files[0]);
  }
}

function handleImportFile(file) {
  if (!file) return;
  const dzTitle = $('importDropzoneTitle');
  if (dzTitle) dzTitle.textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;

  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    parseBulkQuestions(content, file.name);
  };
  reader.onerror = function() {
    if ($('importError')) $('importError').textContent = 'Could not read the uploaded file.';
  };
  reader.readAsText(file, 'utf-8');
}

/* CSV & JSON Parser */
function parseBulkQuestions(rawText, fileName) {
  const isCsv = fileName.toLowerCase().endsWith('.csv');
  const errEl = $('importError');
  if (errEl) errEl.textContent = '';

  parsedImportQuestions = [];

  try {
    if (isCsv) {
      parsedImportQuestions = parseCsvQuestions(rawText);
    } else {
      parsedImportQuestions = parseJsonQuestions(rawText);
    }

    if (!parsedImportQuestions.length) {
      throw new Error('No valid questions found in file. Please ensure columns or keys match the required format.');
    }

    // Render preview
    renderImportPreview(parsedImportQuestions);
    if ($('btnConfirmImport')) $('btnConfirmImport').disabled = false;
  } catch (err) {
    console.warn('Import parse error:', err);
    if (errEl) errEl.textContent = 'Parse error: ' + err.message;
    if ($('importPreviewContainer')) $('importPreviewContainer').hidden = true;
    if ($('btnConfirmImport')) $('btnConfirmImport').disabled = true;
  }
}

function parseJsonQuestions(text) {
  let data = JSON.parse(text);
  if (!Array.isArray(data) && data.questions && Array.isArray(data.questions)) {
    data = data.questions;
  }
  if (!Array.isArray(data)) throw new Error('JSON root must be an array of question objects.');

  return data.map((item, idx) => {
    const qText = String(item.question || item.question_text || '').trim();
    if (!qText) return null;

    let optA = '', optB = '', optC = '', optD = '';
    if (item.options && typeof item.options === 'object') {
      if (Array.isArray(item.options)) {
        optA = item.options[0] || '';
        optB = item.options[1] || '';
        optC = item.options[2] || '';
        optD = item.options[3] || '';
      } else {
        optA = item.options.A || item.options.a || '';
        optB = item.options.B || item.options.b || '';
        optC = item.options.C || item.options.c || '';
        optD = item.options.D || item.options.d || '';
      }
    } else {
      optA = item.option_a || item.optionA || '';
      optB = item.option_b || item.optionB || '';
      optC = item.option_c || item.optionC || '';
      optD = item.option_d || item.optionD || '';
    }

    let correct = String(item.correct_answer || item.answer || item.correct || 'A').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(correct)) correct = 'A';

    const exp = String(item.explanation || item.reason || '').trim();

    return {
      question_text: qText,
      option_a: String(optA).trim(),
      option_b: String(optB).trim(),
      option_c: String(optC).trim(),
      option_d: String(optD).trim(),
      options: { A: String(optA).trim(), B: String(optB).trim(), C: String(optC).trim(), D: String(optD).trim() },
      correct_answer: correct,
      explanation: exp
    };
  }).filter(Boolean);
}

function parseCsvQuestions(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuote = false;

  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      currentRow.push(currentField);
      currentField = '';
    } else if (char === '\n' && !insideQuote) {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (rows.length < 2) throw new Error('CSV file contains no question data rows.');

  // Header mapping
  const headers = rows[0].map(h => String(h || '').trim().toLowerCase().replace(/[\s_-]+/g, ''));
  const getIdx = (keys) => headers.findIndex(h => keys.includes(h));

  const qIdx = getIdx(['question', 'questiontext', 'prompt', 'q']);
  const aIdx = getIdx(['optiona', 'a', 'choicea', 'opt1', 'option1']);
  const bIdx = getIdx(['optionb', 'b', 'choiceb', 'opt2', 'option2']);
  const cIdx = getIdx(['optionc', 'c', 'choicec', 'opt3', 'option3']);
  const dIdx = getIdx(['optiond', 'd', 'choiced', 'opt4', 'option4']);
  const ansIdx = getIdx(['correctanswer', 'answer', 'correct', 'ans']);
  const expIdx = getIdx(['explanation', 'explain', 'reason']);

  if (qIdx === -1 || aIdx === -1 || bIdx === -1) {
    throw new Error('CSV must have at least "question", "option_a", and "option_b" headers.');
  }

  const results = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row[qIdx] || !row[qIdx].trim()) continue;

    const qText = row[qIdx].trim();
    const optA = (row[aIdx] || '').trim();
    const optB = (row[bIdx] || '').trim();
    const optC = (cIdx !== -1 && row[cIdx] ? row[cIdx] : '').trim();
    const optD = (dIdx !== -1 && row[dIdx] ? row[dIdx] : '').trim();

    let ans = (ansIdx !== -1 && row[ansIdx] ? row[ansIdx] : 'A').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(ans)) {
      if (ans.startsWith('A')) ans = 'A';
      else if (ans.startsWith('B')) ans = 'B';
      else if (ans.startsWith('C')) ans = 'C';
      else if (ans.startsWith('D')) ans = 'D';
      else ans = 'A';
    }

    const exp = expIdx !== -1 && row[expIdx] ? row[expIdx].trim() : '';

    results.push({
      question_text: qText,
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      options: { A: optA, B: optB, C: optC, D: optD },
      correct_answer: ans,
      explanation: exp
    });
  }

  return results;
}

function renderImportPreview(questions) {
  const container = $('importPreviewContainer');
  const tbody = $('importPreviewTableBody');
  const badge = $('importCountBadge');
  if (!container || !tbody) return;

  badge.textContent = `${questions.length} valid question${questions.length === 1 ? '' : 's'}`;

  tbody.innerHTML = questions.slice(0, 50).map((q, i) => `
    <tr>
      <td style="color:var(--muted)">${i + 1}</td>
      <td style="font-weight:500">${escapeHtml(q.question_text)}</td>
      <td style="font-size:11.5px;color:var(--muted)">
        A: ${escapeHtml(q.option_a)}<br>
        B: ${escapeHtml(q.option_b)}<br>
        C: ${escapeHtml(q.option_c)}<br>
        D: ${escapeHtml(q.option_d)}
      </td>
      <td><span class="correct-pill">${q.correct_answer}</span></td>
      <td style="font-size:11.5px;color:var(--muted)">${escapeHtml(q.explanation || '—')}</td>
    </tr>
  `).join('');

  if (questions.length > 50) {
    tbody.innerHTML += `<tr><td colspan="5" style="text-align:center;color:var(--muted);font-style:italic">...and ${questions.length - 50} more questions</td></tr>`;
  }

  container.hidden = false;
}

async function executeBulkImport() {
  if (!parsedImportQuestions.length) return;
  const btn = $('btnConfirmImport');
  const errEl = $('importError');
  if (errEl) errEl.textContent = '';

  const target = $('importQuizTarget') ? $('importQuizTarget').value : 'new';
  let quizId = null;

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing&hellip;';

  try {
    if (target === 'new') {
      const title = ($('importQuizTitle') ? $('importQuizTitle').value : '').trim();
      const subject = ($('importQuizSubject') ? $('importQuizSubject').value : '').trim();
      const semester = parseInt($('importQuizSem') ? $('importQuizSem').value : '1', 10);
      const timeLimit = parseInt($('importQuizTime') ? $('importQuizTime').value : '15', 10) || 15;

      if (!title || !subject) {
        throw new Error('Please specify both a Quiz Title and Subject.');
      }

      // Insert quiz row
      const { data: newQuiz, error: qErr } = await adminSupabaseClient
        .from('quizzes')
        .insert({
          title,
          subject,
          semester,
          description: `BCA Semester ${semester} MCQ practice set for ${subject}.`,
          total_questions: parsedImportQuestions.length,
          time_limit_minutes: timeLimit,
          is_ai_generated: false,
          created_by: 'admin'
        })
        .select()
        .single();

      if (qErr) throw qErr;
      quizId = newQuiz.id;
    } else {
      quizId = target;
    }

    // Insert questions in chunks of 50
    const questionRows = parsedImportQuestions.map(q => ({
      quiz_id: quizId,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation || ''
    }));

    const chunkSize = 50;
    for (let i = 0; i < questionRows.length; i += chunkSize) {
      const chunk = questionRows.slice(i, i + chunkSize);
      const { error: insErr } = await adminSupabaseClient.from('questions').insert(chunk);
      if (insErr) throw insErr;
    }

    // Update total questions count on quiz
    const { count: freshCount } = await adminSupabaseClient
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_id', quizId);

    if (typeof freshCount === 'number') {
      await adminSupabaseClient.from('quizzes').update({ total_questions: freshCount }).eq('id', quizId);
    }

    alert(`Success! Imported ${parsedImportQuestions.length} questions into the mock test.`);
    closeBulkImportModal();
    loadAdminQuizzes();
  } catch (err) {
    console.error('Import execution error:', err);
    if (errEl) errEl.textContent = 'Failed to import: ' + err.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Import to Supabase';
  }
}

/* Sample File Generators */
function downloadSampleJson() {
  const sample = [
    {
      "question": "Which data structure follows the LIFO (Last In First Out) principle?",
      "option_a": "Queue",
      "option_b": "Stack",
      "option_c": "Binary Search Tree",
      "option_d": "Linked List",
      "correct_answer": "B",
      "explanation": "Stack elements are inserted and removed strictly from the top (Last-In First-Out)."
    },
    {
      "question": "What is the worst-case time complexity of QuickSort?",
      "option_a": "O(n log n)",
      "option_b": "O(n)",
      "option_c": "O(n^2)",
      "option_d": "O(1)",
      "correct_answer": "C",
      "explanation": "When an unbalanced pivot is picked repeatedly, QuickSort degrades to O(n^2)."
    }
  ];

  const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bcaprime-mcqs-sample.json';
  a.click();
  URL.revokeObjectURL(url);
}

function downloadSampleCsv() {
  const csvContent =
`question,option_a,option_b,option_c,option_d,correct_answer,explanation
"Which memory area in the JVM stores static variables and method bytecode?","Method Area / Metaspace","Heap","JVM Stack","Program Counter","A","Metaspace/Method Area stores per-class structures and static variables."
"Which SQL command is used to remove all records from a table without logging individual deletes?","DROP","DELETE","TRUNCATE","ALTER","C","TRUNCATE is a DDL command that deallocates all data pages instantly."`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bcaprime-mcqs-sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* Question Viewer Modal */
async function viewQuizQuestions(quizId) {
  const modal = $('quizQuestionsModal');
  const listEl = $('quizQuestionsList');
  if (!modal || !listEl) return;

  const quiz = adminQuizzes.find(q => q.id === quizId);
  currentViewingQuiz = quiz;
  if ($('viewQuizTitle')) $('viewQuizTitle').textContent = quiz ? quiz.title : 'Quiz Questions';
  if ($('viewQuizSubtitle')) $('viewQuizSubtitle').textContent = quiz ? `Semester ${quiz.semester} · ${quiz.subject}` : '';

  modal.hidden = false;
  listEl.innerHTML = '<p class="note">Loading questions&hellip;</p>';

  try {
    const { data, error } = await adminSupabaseClient
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('id', { ascending: true });

    if (error) throw error;
    currentViewingQuestions = data || [];

    if (!currentViewingQuestions.length) {
      listEl.innerHTML = '<p class="note">No questions found in this quiz. Use "Bulk Import" to add questions.</p>';
      return;
    }

    listEl.innerHTML = currentViewingQuestions.map((q, idx) => `
      <div style="background:var(--surface2);border:1px solid var(--line);border-radius:var(--radius-sm);padding:14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <strong style="color:var(--ink);font-size:13.5px">Q${idx + 1}. ${escapeHtml(q.question_text)}</strong>
          <button class="button danger" style="padding:4px 8px;font-size:11px" onclick="deleteSingleQuestion(${q.id}, ${quizId})"><i class="fa-solid fa-trash"></i></button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0;font-size:12.5px">
          <div style="${q.correct_answer === 'A' ? 'color:var(--good);font-weight:600' : 'color:var(--muted)'}">A) ${escapeHtml(q.option_a)}</div>
          <div style="${q.correct_answer === 'B' ? 'color:var(--good);font-weight:600' : 'color:var(--muted)'}">B) ${escapeHtml(q.option_b)}</div>
          <div style="${q.correct_answer === 'C' ? 'color:var(--good);font-weight:600' : 'color:var(--muted)'}">C) ${escapeHtml(q.option_c)}</div>
          <div style="${q.correct_answer === 'D' ? 'color:var(--good);font-weight:600' : 'color:var(--muted)'}">D) ${escapeHtml(q.option_d)}</div>
        </div>

        ${q.explanation ? `<div style="font-size:12px;color:var(--muted);border-top:1px dashed var(--line);padding-top:6px"><i class="fa-solid fa-circle-info" style="color:var(--brand)"></i> ${escapeHtml(q.explanation)}</div>` : ''}
      </div>
    `).join('');
  } catch (err) {
    listEl.innerHTML = `<p class="note">Failed to load questions: ${escapeHtml(err.message)}</p>`;
  }
}

function closeQuizQuestionsModal() {
  const modal = $('quizQuestionsModal');
  if (modal) modal.hidden = true;
  currentViewingQuiz = null;
  currentViewingQuestions = [];
}

async function deleteSingleQuestion(qId, quizId) {
  if (!confirm('Are you sure you want to delete this question?')) return;
  try {
    const { error } = await adminSupabaseClient.from('questions').delete().eq('id', qId);
    if (error) throw error;
    // Decrement total_questions on quiz
    const { count: freshCount } = await adminSupabaseClient.from('questions').select('id', { count: 'exact', head: true }).eq('quiz_id', quizId);
    if (typeof freshCount === 'number') {
      await adminSupabaseClient.from('quizzes').update({ total_questions: freshCount }).eq('id', quizId);
    }
    viewQuizQuestions(quizId);
    loadAdminQuizzes();
  } catch (err) {
    alert('Could not delete question: ' + err.message);
  }
}

function deleteQuiz(quizId) {
  openSafeDelete('This mock test and all its questions will be permanently deleted.', async () => {
    try {
      const { error } = await adminSupabaseClient.from('quizzes').delete().eq('id', quizId);
      if (error) throw error;
      adminQuizzes = adminQuizzes.filter(q => q.id !== quizId);
      renderAdminQuizzes();
      updateQuizStats();
    } catch (err) {
      alert('Could not delete quiz: ' + err.message);
    }
  });
}

function exportCurrentQuizJson() {
  if (!currentViewingQuiz || !currentViewingQuestions.length) return;
  const exportData = {
    quiz: {
      title: currentViewingQuiz.title,
      subject: currentViewingQuiz.subject,
      semester: currentViewingQuiz.semester,
      time_limit_minutes: currentViewingQuiz.time_limit_minutes
    },
    questions: currentViewingQuestions.map(q => ({
      question: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      explanation: q.explanation
    }))
  };

  const filename = `${(currentViewingQuiz.title || 'quiz').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-export.json`;
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* Manual Quiz Creation Modal */
function openManualQuizModal() {
  const modal = $('manualQuizModal');
  if (modal) {
    if ($('manualQuizTitle')) $('manualQuizTitle').value = '';
    if ($('manualQuizSubject')) $('manualQuizSubject').value = '';
    modal.hidden = false;
  }
}

function closeManualQuizModal() {
  const modal = $('manualQuizModal');
  if (modal) modal.hidden = true;
}

async function handleManualQuizSubmit(event) {
  event.preventDefault();
  const title = ($('manualQuizTitle') ? $('manualQuizTitle').value : '').trim();
  const subject = ($('manualQuizSubject') ? $('manualQuizSubject').value : '').trim();
  const semester = parseInt($('manualQuizSem') ? $('manualQuizSem').value : '1', 10);
  const timeLimit = parseInt($('manualQuizTime') ? $('manualQuizTime').value : '15', 10) || 15;

  if (!title || !subject) return;

  const btn = $('btnSaveManualQuiz');
  btn.disabled = true;

  try {
    const { error } = await adminSupabaseClient.from('quizzes').insert({
      title,
      subject,
      semester,
      description: `BCA Semester ${semester} MCQ practice set for ${subject}.`,
      total_questions: 0,
      time_limit_minutes: timeLimit,
      is_ai_generated: false,
      created_by: 'admin'
    });

    if (error) throw error;
    closeManualQuizModal();
    loadAdminQuizzes();
  } catch (err) {
    alert('Could not create quiz: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}








/* ============================================================
   User Growth Analytics & Recent Signups (IST-based)
   ============================================================ */

let recentUsersList = [];
let userSearchDebounceTimer = null;

// Dynamic avatar hue derived from name or email
function getUserAvatarColor(name) {
  const hues = [199, 142, 280, 340, 24, 160, 220, 260];
  let hash = 0;
  const str = String(name || 'S');
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % hues.length;
  }
  return `hsl(${hues[Math.abs(hash)]}, 65%, 44%)`;
}

// Format UTC date to Indian Standard Time (IST, UTC+5:30)
function formatISTDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch (e) {
    return isoStr;
  }
}

// Relative human time string
function getRelativeTime(isoStr) {
  if (!isoStr) return '';
  try {
    const ms = Date.now() - new Date(isoStr).getTime();
    if (ms < 0) return 'Just now';
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    return '';
  } catch (e) {
    return '';
  }
}

// Toast notification helper adhering to BCAPrime design system
function showAdminToast(message, type = 'info') {
  if (window.BCA_UI && window.BCA_UI.Toast) {
    new window.BCA_UI.Toast({ message, type, duration: 3200 }).show();
    return;
  }

  let container = document.getElementById('adminToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'adminToastContainer';
    container.className = 'admin-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `admin-toast-item toast-${type}`;
  const icon = type === 'success' ? 'fa-check' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-bell');
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

// Fetch user metrics and recent signups
let currentStudentSemFilter = 'all';

function formatCollegeLabel(code) {
  if (!code) return 'Avviare Educational Hub';
  const c = String(code).toLowerCase();
  return collegeNames[c] || (c.startsWith('custom-') ? 'Custom College' : c.toUpperCase());
}

function setStudentSemFilter(sem) {
  currentStudentSemFilter = String(sem);
  document.querySelectorAll('#studentSemFilterPills .adm-pill').forEach(b => {
    b.classList.toggle('active', b.dataset.sem === currentStudentSemFilter);
  });
  filterRecentUsers();
}

// Deduplicate raw student profiles by uid, email, and username
function deduplicateStudentProfiles(rawProfiles) {
  if (!Array.isArray(rawProfiles)) return [];
  const seenUids = new Set();
  const seenEmails = new Set();
  const seenUsernames = new Set();
  const deduplicated = [];

  for (const p of rawProfiles) {
    if (!p) continue;
    const uid = String(p.uid || p.id || '').trim();
    const rawEmail = String(p.email || '').trim().toLowerCase();
    const rawUsername = String(p.username || '').trim().toLowerCase().replace(/^@+/, '');

    // Skip empty/corrupted records
    if (!uid && !rawEmail && !rawUsername) continue;

    // Check duplicates
    if (uid && seenUids.has(uid)) continue;
    if (rawEmail && seenEmails.has(rawEmail)) continue;
    if (rawUsername && rawUsername !== 'student' && seenUsernames.has(rawUsername)) continue;

    if (uid) seenUids.add(uid);
    if (rawEmail) seenEmails.add(rawEmail);
    if (rawUsername && rawUsername !== 'student') seenUsernames.add(rawUsername);

    deduplicated.push({
      ...p,
      id: uid || p.id,
      uid: uid || p.id,
      name: (p.name || 'Student').trim(),
      username: rawUsername || (rawEmail ? rawEmail.split('@')[0] : 'student'),
      email: rawEmail || '',
      college: p.college || 'avviare',
      semester: Number(p.semester) || 1,
      avatar_url: p.avatar_url || '',
      is_admin: Boolean(p.is_admin || (rawEmail && rawEmail.includes('admin@bcaprime'))),
      can_download: p.can_download !== false,
      is_email_verified: Boolean(p.is_email_verified),
      created_at: p.created_at || p.updated_at || new Date().toISOString(),
      updated_at: p.updated_at || p.created_at || new Date().toISOString()
    });
  }
  return deduplicated;
}
window.deduplicateStudentProfiles = deduplicateStudentProfiles;

/* ---- Student multi-select & bulk delete actions ---- */
const selectedUserUids = new Set();

function isUserProtectedAdmin(user) {
  if (!user) return false;
  if (user.is_admin) return true;
  const email = (user.email || '').toLowerCase().trim();
  if (email === 'admin@bcaprime.com' || email.includes('admin@bcaprime')) return true;
  if (window.currentAdminEmail && email === window.currentAdminEmail.toLowerCase()) return true;
  const curUid = window.currentAdminUid || '';
  if (curUid && (user.uid === curUid || user.id === curUid)) return true;
  return false;
}

function toggleUserSelect(uid, checked) {
  if (!uid) return;
  if (checked) selectedUserUids.add(uid);
  else selectedUserUids.delete(uid);
  updateBulkUsersUI();
}
window.toggleUserSelect = toggleUserSelect;

function toggleCheckAllUsers(checked) {
  const list = $('studentCardsList');
  if (!list) return;
  const items = list.querySelectorAll('.student-admin-card');
  items.forEach(el => {
    const uid = el.dataset.uid;
    if (!uid) return;
    const isProtected = el.dataset.protected === 'true';
    if (isProtected) return; // Never select protected admin accounts
    const cb = el.querySelector('.adm-item-checkbox');
    if (cb) cb.checked = checked;
    if (checked) selectedUserUids.add(uid);
    else selectedUserUids.delete(uid);
  });
  updateBulkUsersUI();
}
window.toggleCheckAllUsers = toggleCheckAllUsers;

function updateBulkUsersUI() {
  const bar = $('bulkUsersActions');
  const cnt = $('bulkUsersCount');
  const allCb = $('checkAllUsers');
  const disp = $('userSelectCountDisplay');
  const cards = $('studentCardsList') ? $('studentCardsList').querySelectorAll('.student-admin-card:not([data-protected="true"])') : [];
  const eligibleCount = cards.length;
  if (bar) bar.classList.toggle('visible', selectedUserUids.size > 0);
  if (cnt) cnt.textContent = `${selectedUserUids.size} selected`;
  if (disp) disp.textContent = `${eligibleCount} eligible`;
  if (allCb) allCb.checked = eligibleCount > 0 && selectedUserUids.size >= eligibleCount;
}
window.updateBulkUsersUI = updateBulkUsersUI;

async function bulkDeleteUsers() {
  if (!selectedUserUids.size) return;
  const uids = [...selectedUserUids];
  openSafeDelete(`Permanently delete ${uids.length} selected student(s)? This will cascade delete their community requests, lost & found posts, feedback, and reading progress.`, async () => {
    if (!adminSupabaseClient) return;
    try {
      // 1. Fetch any lost & found images created by these users to wipe from storage
      try {
        const { data: lfRows } = await adminSupabaseClient.from('lost_found').select('id, image_url').in('user_id', uids);
        if (lfRows && lfRows.length) {
          const imgUrls = lfRows.map(item => item.image_url).filter(Boolean);
          if (imgUrls.length) await wipeLostFoundImageFromStorageAdmin(imgUrls);
          await adminSupabaseClient.from('lost_found').delete().in('user_id', uids);
        }
      } catch (_lfE) {
        console.warn('[Admin] cascade LF purge note:', _lfE);
      }

      // 2. Cascade delete senior_requests
      try {
        await adminSupabaseClient.from('senior_requests').delete().in('user_id', uids);
      } catch (_srE) {}

      // 3. Cascade delete feedback
      try {
        await adminSupabaseClient.from('feedback').delete().in('user_id', uids);
      } catch (_fbE) {}

      // 4. Cascade delete reading progress
      try {
        await adminSupabaseClient.from('user_reading_progress').delete().in('user_id', uids);
      } catch (_urpE) {}

      // 5. Cascade delete analytics events
      try {
        await adminSupabaseClient.from('analytics_events').delete().in('user_id', uids);
      } catch (_aeE) {}

      // 6. Delete from user_profiles
      const { error: profErr } = await adminSupabaseClient.from('user_profiles').delete().in('uid', uids);
      if (profErr) throw profErr;

      // 7. Delete from public.profiles if exists
      try {
        await adminSupabaseClient.from('profiles').delete().in('id', uids);
      } catch (_prE) {}

      selectedUserUids.clear();
      showAdminToast(`Successfully deleted ${uids.length} student(s) and cascaded all data ✓`, 'success');
      await loadUserStats(true);
      updateAdminKpis();
    } catch (err) {
      console.error('[Admin] Bulk delete students error:', err);
      alert('Bulk delete failed: ' + err.message);
    }
  });
}
window.bulkDeleteUsers = bulkDeleteUsers;

// Fetch user metrics and all registered student profiles
async function loadUserStats(showToastFeedback = false) {
  const cardsContainer = $('studentCardsList');
  const tbody = $('userRows');
  const countBadge = $('userListCountBadge');
  const emptyWrap = $('usersEmptyState');

  if (emptyWrap) emptyWrap.hidden = true;

  // Render content-shaped skeleton loading cards (Rule 4: Skeleton Shimmer Placeholders on Loading)
  if (cardsContainer) {
    cardsContainer.innerHTML = [1, 2, 3, 4].map(i => `
      <div class="student-admin-card skeleton-card" style="pointer-events:none">
        <div class="shimmer-box" style="width:44px;height:44px;border-radius:50%;flex-shrink:0"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">
          <div class="shimmer-box" style="width:${100 + i * 20}px;height:16px"></div>
          <div class="shimmer-box" style="width:${140 + i * 15}px;height:12px"></div>
          <div class="shimmer-box" style="width:80px;height:11px"></div>
        </div>
      </div>
    `).join('');
  }

  try {
    let stats = null;
    let profiles = [];

    if (adminSupabaseClient) {
      // Fetch full student profiles
      const { data: profData, error: profErr } = await adminSupabaseClient
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!profErr && Array.isArray(profData) && profData.length > 0) {
        profiles = deduplicateStudentProfiles(profData);
      }
    }

    // Compute stats from deduplicated profiles
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayStart = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const monthStart = new Date(nowIST.getFullYear(), nowIST.getMonth(), 1);
    const lastMonthStart = new Date(nowIST.getFullYear(), nowIST.getMonth() - 1, 1);
    const lastMonthEnd = new Date(nowIST.getFullYear(), nowIST.getMonth(), 0, 23, 59, 59, 999);

    let tCount = 0, wCount = 0, mCount = 0, lmCount = 0;
    profiles.forEach(r => {
      const rDate = new Date(new Date(r.created_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      if (rDate >= todayStart) tCount++;
      if (rDate >= weekStart) wCount++;
      if (rDate >= monthStart) mCount++;
      if (rDate >= lastMonthStart && rDate <= lastMonthEnd) lmCount++;
    });

    stats = {
      total_users: profiles.length,
      users_today: tCount,
      users_this_week: wCount,
      users_this_month: mCount,
      users_last_month: lmCount
    };

    // Populate stat counters
    if ($('statTotalUsers')) $('statTotalUsers').textContent = Number(stats.total_users || 0).toLocaleString();
    if ($('statUsersToday')) $('statUsersToday').textContent = Number(stats.users_today || 0).toLocaleString();
    if ($('statUsersWeek')) $('statUsersWeek').textContent = Number(stats.users_this_week || 0).toLocaleString();
    if ($('statUsersMonth')) $('statUsersMonth').textContent = Number(stats.users_this_month || 0).toLocaleString();
    if ($('statUsersLastMonth')) $('statUsersLastMonth').textContent = Number(stats.users_last_month || 0).toLocaleString();

    window.userStatsCache = stats;
    window.allStudentsList = profiles;
    recentUsersList = profiles;
    updateAdminKpis();

    filterRecentUsers();

    if (showToastFeedback) {
      showAdminToast('Student directory & signups synchronized.', 'success');
    }
  } catch (err) {
    console.error('[Admin] loadUserStats failed:', err);
    if (cardsContainer) {
      cardsContainer.innerHTML = `
        <div class="empty-state-wrap" style="grid-column:1/-1;padding:36px 16px;text-align:center">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:28px;color:var(--brand);margin-bottom:10px;display:block"></i>
          <h3 style="margin:0 0 6px;font-size:16px">Could not load students directory</h3>
          <p style="color:var(--muted);font-size:13px;max-width:400px;margin:0 auto 16px;line-height:1.5">
            ${escapeHtml(err.message || 'Please check network connection.')}
          </p>
          <button class="button primary bca-pressable" onclick="loadUserStats(true)" style="min-height:44px;padding:0 20px">
            <i class="fa-solid fa-arrows-rotate"></i> Retry
          </button>
        </div>
      `;
    }
    if (showToastFeedback) {
      showAdminToast('Error loading students: ' + (err.message || 'Unknown error'), 'error');
    }
  }
}

// Render recent user rows and mobile cards
function renderRecentUsers(usersToRender) {
  const cardsContainer = $('studentCardsList');
  const tbody = $('userRows');
  const countBadge = $('userListCountBadge');
  const emptyWrap = $('usersEmptyState');

  if (countBadge) {
    countBadge.textContent = `${usersToRender.length} ${usersToRender.length === 1 ? 'student' : 'students'}`;
  }

  // Dedicated EmptyState fallback (Rule 5: Dedicated EmptyState for Every List & Feed)
  if (!usersToRender || usersToRender.length === 0) {
    if (cardsContainer) cardsContainer.innerHTML = '';
    if (tbody) tbody.innerHTML = '';
    if (emptyWrap) {
      emptyWrap.hidden = false;
      emptyWrap.innerHTML = `
        <div style="padding:28px 16px;text-align:center">
          <i class="fa-solid fa-users-slash" style="font-size:32px;color:var(--muted);margin-bottom:12px;display:block"></i>
          <h3 style="margin:0 0 6px;font-size:16px;font-family:var(--font-condensed-heading);font-weight:600">No students found</h3>
          <p style="color:var(--muted);font-size:13px;margin:0 0 16px;font-family:var(--font-condensed-body)">No registered student accounts match your filter criteria.</p>
          <button class="button bca-pressable" onclick="clearUserFilter()" style="min-height:44px;padding:0 18px">
            <i class="fa-solid fa-xmark"></i> Clear Filter
          </button>
        </div>
      `;
      initAdminPressables();
    }
    updateBulkUsersUI();
    return;
  }

  if (emptyWrap) emptyWrap.hidden = true;

  if (cardsContainer) {
    cardsContainer.innerHTML = usersToRender.map(u => {
      const displayName = escapeHtml(u.name || 'Student');
      const username = escapeHtml(u.username || (u.email ? u.email.split('@')[0] : 'student'));
      const collegeLabel = escapeHtml(formatCollegeLabel(u.college));
      const semBadge = `SEM ${u.semester || 1}`;
      const firstLetter = (u.name || u.email || 'S').trim().charAt(0).toUpperCase();
      const avatarColor = getUserAvatarColor(u.name || u.email);
      const dateIST = formatISTDate(u.created_at);
      const relTime = getRelativeTime(u.created_at);
      const isProtected = isUserProtectedAdmin(u);
      const isChecked = selectedUserUids.has(u.uid);

      const avatarHtml = u.avatar_url
        ? `<div class="student-card-avatar"><img src="${escapeHtml(u.avatar_url)}" alt="${displayName}" onerror="this.parentElement.innerHTML='${firstLetter}'"></div>`
        : `<div class="student-card-avatar" style="background:${avatarColor}">${firstLetter}</div>`;

      return `
        <div class="student-admin-card bca-pressable" data-uid="${escapeHtml(u.uid || u.id)}" data-protected="${isProtected}" role="button" tabindex="0" onclick="openStudentAdminProfile('${escapeHtml(u.uid || u.id)}')">
          <div style="display:flex;align-items:center;gap:10px;" onclick="event.stopPropagation()">
            ${isProtected 
              ? `<span class="adm-item-protected-icon" title="Protected Admin Account"><i class="fa-solid fa-shield-halved"></i></span>`
              : `<input type="checkbox" class="adm-item-checkbox" ${isChecked ? 'checked' : ''} onchange="toggleUserSelect('${escapeHtml(u.uid || u.id)}', this.checked)" title="Select student">`
            }
            ${avatarHtml}
          </div>
          <div class="student-card-main">
            <div class="student-card-top">
              <span class="student-name-text">${displayName}</span>
              <span class="student-username-tag">@${username}</span>
              <span class="adm-sem-tag">${semBadge}</span>
              ${isProtected ? `<span class="badge" style="background:rgba(37,99,235,0.15);color:var(--brand);font-size:10px;padding:2px 6px;">ADMIN</span>` : ''}
            </div>
            <div class="student-card-college">
              <i class="fa-solid fa-building-columns"></i>
              <span>${collegeLabel}</span>
            </div>
            <div class="student-card-bottom">
              <span><i class="fa-regular fa-envelope"></i> ${escapeHtml(u.email || 'No email')}</span>
              <span>&bull;</span>
              <span><i class="fa-regular fa-clock"></i> ${relTime || dateIST}</span>
            </div>
          </div>
          <div class="student-chevron">
            <i class="fa-solid fa-chevron-right"></i>
          </div>
        </div>
      `;
    }).join('');
  }

  if (tbody) {
    tbody.innerHTML = usersToRender.map((u, idx) => {
      const displayName = escapeHtml(u.name || 'Student');
      const displayEmail = escapeHtml(u.email || 'No email');
      const firstLetter = (u.name || u.email || 'S').trim().charAt(0).toUpperCase();
      const avatarColor = getUserAvatarColor(u.name || u.email);
      const dateIST = formatISTDate(u.created_at);
      const relTime = getRelativeTime(u.created_at);
      const isProtected = isUserProtectedAdmin(u);
      const isChecked = selectedUserUids.has(u.uid);

      return `
        <tr onclick="openStudentAdminProfile('${escapeHtml(u.uid || u.id)}')" style="cursor:pointer">
          <td style="width:36px;text-align:center;" onclick="event.stopPropagation()">
            ${isProtected
              ? `<span class="adm-item-protected-icon" title="Protected Admin Account"><i class="fa-solid fa-shield-halved"></i></span>`
              : `<input type="checkbox" class="adm-item-checkbox" ${isChecked ? 'checked' : ''} onchange="toggleUserSelect('${escapeHtml(u.uid || u.id)}', this.checked)" title="Select student">`
            }
          </td>
          <td style="color:var(--muted);font-weight:600;font-size:12px;width:36px">${idx + 1}</td>
          <td>
            <div class="user-cell">
              <div class="user-avatar-circle" style="background:${avatarColor}">${firstLetter}</div>
              <div class="user-info">
                <span class="user-name-text">${displayName}</span>
                ${u.id || u.uid ? `<small style="display:block;color:var(--muted-dim);font-size:11px;font-family:monospace">UID: ${escapeHtml(String(u.uid || u.id).slice(0, 8))}&hellip;</small>` : ''}
              </div>
            </div>
          </td>
          <td>
            <span class="user-email-text">${displayEmail}</span>
          </td>
          <td>
            <div class="user-time-cell">
              <span class="user-time-main">
                <i class="fa-regular fa-clock"></i> ${dateIST}
              </span>
              ${relTime ? `<span class="user-time-rel">${relTime}</span>` : ''}
            </div>
              </span>
              ${relTime ? `<span class="user-time-rel">${relTime}</span>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  initAdminPressables();
}

// Live real-time search without find/submit buttons (Rule 7: Live Real-Time Filtering & Search)
function filterRecentUsers() {
  clearTimeout(userSearchDebounceTimer);
  userSearchDebounceTimer = setTimeout(() => {
    const q = ($('userSearchInput')?.value || '').trim().toLowerCase();
    const colFilter = ($('userCollegeFilter')?.value || 'all').toLowerCase();
    const list = window.allStudentsList || recentUsersList || [];

    const filtered = list.filter(u => {
      // Text search
      if (q) {
        const name = (u.name || '').toLowerCase();
        const uname = (u.username || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const college = (u.college || '').toLowerCase();
        const uid = String(u.uid || u.id || '').toLowerCase();
        const matchesQ = name.includes(q) || uname.includes(q) || email.includes(q) || college.includes(q) || uid.includes(q);
        if (!matchesQ) return false;
      }

      // College filter
      if (colFilter !== 'all') {
        const uCol = (u.college || '').toLowerCase();
        if (uCol !== colFilter) {
          return false;
        }
      }

      // Semester filter
      if (currentStudentSemFilter !== 'all') {
        if (String(u.semester) !== currentStudentSemFilter) return false;
      }

      return true;
    });

    renderRecentUsers(filtered);
  }, 200);
}

// Clear search input filter
function clearUserFilter() {
  const input = $('userSearchInput');
  if (input) input.value = '';
  const colSelect = $('userCollegeFilter');
  if (colSelect) colSelect.value = 'all';
  setStudentSemFilter('all');
}

// Student Admin Profile Modal Functions
async function openStudentAdminProfile(uid) {
  if (!uid) return;
  const modal = $('studentAdminModal');
  const body = $('studentAdminModalBody');
  if (!modal || !body) return;

  const student = (window.allStudentsList || []).find(s => String(s.uid || s.id) === String(uid)) || { uid };

  const displayName = escapeHtml(student.name || 'Student');
  const username = escapeHtml(student.username || (student.email ? student.email.split('@')[0] : 'student'));
  const firstLetter = (student.name || student.email || 'S').trim().charAt(0).toUpperCase();
  const avatarColor = getUserAvatarColor(student.name || student.email);
  const collegeLabel = escapeHtml(formatCollegeLabel(student.college));
  const sem = student.semester || 1;
  const email = escapeHtml(student.email || 'No email on record');
  const dateIST = formatISTDate(student.created_at);
  const relTime = getRelativeTime(student.created_at);

  const avatarHtml = student.avatar_url
    ? `<div class="student-modal-avatar"><img src="${escapeHtml(student.avatar_url)}" alt="${displayName}" onerror="this.parentElement.innerHTML='${firstLetter}'"></div>`
    : `<div class="student-modal-avatar" style="background:${avatarColor}">${firstLetter}</div>`;

  modal.hidden = false;
  body.innerHTML = `
    <div class="student-modal-header-hero">
      ${avatarHtml}
      <h3 class="student-modal-name">${displayName}</h3>
      <span class="student-modal-username">@${username}</span>
      <div class="student-uid-chip bca-pressable" onclick="copyStudentUid('${student.uid}')" title="Click to copy UID">
        <i class="fa-regular fa-copy"></i>
        <span>UID: ${escapeHtml(String(student.uid).slice(0, 16))}&hellip;</span>
        <span style="font-size:10px;opacity:0.75">(Copy)</span>
      </div>
    </div>

    <!-- Live Uploads & Community Highlights -->
    <div class="student-stats-row">
      <div class="student-stat-pill">
        <span class="student-stat-pill-num" id="admModalUploadsCount">
          <i class="fa-solid fa-spinner fa-spin" style="font-size:12px"></i>
        </span>
        <span class="student-stat-pill-label">Uploads</span>
      </div>
      <div class="student-stat-pill">
        <span class="student-stat-pill-num" id="admModalCommunityCount">
          <i class="fa-solid fa-spinner fa-spin" style="font-size:12px"></i>
        </span>
        <span class="student-stat-pill-label">Community</span>
      </div>
      <div class="student-stat-pill">
        <span class="student-stat-pill-num">${student.is_email_verified ? '<i class="fa-solid fa-check" style="color:var(--good)"></i>' : '<i class="fa-solid fa-xmark" style="color:var(--muted)"></i>'}</span>
        <span class="student-stat-pill-label">${student.is_email_verified ? 'Verified' : 'Unverified'}</span>
      </div>
    </div>

    <!-- Account Details 2x2 Grid -->
    <div class="student-profile-grid">
      <div class="profile-field-block">
        <span class="profile-field-label">Selected College</span>
        <span class="profile-field-val">${collegeLabel}</span>
      </div>
      <div class="profile-field-block">
        <span class="profile-field-label">Current Semester</span>
        <span class="profile-field-val" style="font-family:var(--font-mono);font-weight:600">SEM ${sem}</span>
      </div>
      <div class="profile-field-block" style="grid-column:1/-1">
        <span class="profile-field-label">Registered Email</span>
        <span class="profile-field-val">${email}</span>
      </div>
      <div class="profile-field-block" style="grid-column:1/-1">
        <span class="profile-field-label">Joined On (IST)</span>
        <span class="profile-field-val">${dateIST} (${relTime || 'recently'})</span>
      </div>
    </div>

    <!-- Moderation & Role Toggles -->
    <div class="student-actions-block">
      <div class="student-toggle-row">
        <span><i class="fa-solid fa-shield-halved" style="color:${student.is_admin ? 'var(--good)' : 'var(--muted)'};margin-right:8px"></i> Admin Console Privileges</span>
        <button class="button bca-pressable" onclick="toggleStudentAdminRole('${student.uid}', ${student.is_admin})" style="min-height:36px;font-size:12px;padding:0 12px">
          ${student.is_admin ? '<i class="fa-solid fa-ban"></i> Revoke' : '<i class="fa-solid fa-shield"></i> Make Admin'}
        </button>
      </div>

      <div class="student-toggle-row">
        <span><i class="fa-solid fa-download" style="color:${student.can_download ? 'var(--good)' : 'var(--danger)'};margin-right:8px"></i> Download Access</span>
        <button class="button bca-pressable" onclick="toggleStudentDownloadAccess('${student.uid}', ${student.can_download})" style="min-height:36px;font-size:12px;padding:0 12px">
          ${student.can_download ? '<i class="fa-solid fa-lock"></i> Suspend' : '<i class="fa-solid fa-unlock"></i> Allow'}
        </button>
      </div>

      <!-- Shortcut to Full Telemetry in BCAPrime Stats -->
      <a href="../analytics/index.html?student=${encodeURIComponent(student.uid)}" target="_blank" class="adm-telemetry-btn bca-pressable" style="margin-top:6px">
        <i class="fa-solid fa-chart-line"></i>
        <span>Open Full Telemetry in BCAPrime Stats &rarr;</span>
      </a>
    </div>
  `;

  initAdminPressables();

  // Fetch counts asynchronously
  try {
    if (adminSupabaseClient) {
      const [upRes, reqRes, lfRes] = await Promise.allSettled([
        adminSupabaseClient.from('resources').select('id', { count: 'exact', head: true }).eq('uploader_uid', student.uid),
        adminSupabaseClient.from('senior_requests').select('id', { count: 'exact', head: true }).eq('requester_uid', student.uid),
        adminSupabaseClient.from('lost_found').select('id', { count: 'exact', head: true }).eq('poster_uid', student.uid)
      ]);

      const upCount = upRes.status === 'fulfilled' && upRes.value ? (upRes.value.count || 0) : 0;
      const commCount = (reqRes.status === 'fulfilled' && reqRes.value ? (reqRes.value.count || 0) : 0) +
                        (lfRes.status === 'fulfilled' && lfRes.value ? (lfRes.value.count || 0) : 0);

      const elUp = $('admModalUploadsCount');
      if (elUp) elUp.textContent = upCount;
      const elComm = $('admModalCommunityCount');
      if (elComm) elComm.textContent = commCount;
    }
  } catch (_e) {
    const elUp = $('admModalUploadsCount');
    if (elUp) elUp.textContent = '0';
    const elComm = $('admModalCommunityCount');
    if (elComm) elComm.textContent = '0';
  }
}

function closeStudentAdminModal() {
  const modal = $('studentAdminModal');
  if (modal) modal.hidden = true;
}

function copyStudentUid(uid) {
  if (!uid) return;
  try {
    navigator.clipboard.writeText(uid);
    showAdminToast('User ID copied to clipboard!', 'success');
  } catch (_e) {
    showAdminToast('UID: ' + uid, 'info');
  }
}

async function toggleStudentAdminRole(uid, currentIsAdmin) {
  if (!adminSupabaseClient || !uid) return;
  try {
    const newStatus = !currentIsAdmin;
    const { error } = await adminSupabaseClient.from('user_profiles').update({ is_admin: newStatus }).eq('uid', uid);
    if (error) throw error;
    showAdminToast(`Student admin status updated to ${newStatus ? 'Admin' : 'Student'}`, 'success');
    const s = (window.allStudentsList || []).find(x => x.uid === uid);
    if (s) s.is_admin = newStatus;
    openStudentAdminProfile(uid);
  } catch (err) {
    showAdminToast('Failed to update role: ' + (err.message || 'Error'), 'error');
  }
}

async function toggleStudentDownloadAccess(uid, currentCanDownload) {
  if (!adminSupabaseClient || !uid) return;
  try {
    const newStatus = !currentCanDownload;
    const { error } = await adminSupabaseClient.from('user_profiles').update({ can_download: newStatus }).eq('uid', uid);
    if (error) throw error;
    showAdminToast(`Download access ${newStatus ? 'allowed' : 'suspended'}`, 'success');
    const s = (window.allStudentsList || []).find(x => x.uid === uid);
    if (s) s.can_download = newStatus;
    openStudentAdminProfile(uid);
  } catch (err) {
    showAdminToast('Failed to update download access: ' + (err.message || 'Error'), 'error');
  }
}

window.openStudentAdminProfile = openStudentAdminProfile;
window.closeStudentAdminModal = closeStudentAdminModal;
window.copyStudentUid = copyStudentUid;
window.toggleStudentAdminRole = toggleStudentAdminRole;
window.toggleStudentDownloadAccess = toggleStudentDownloadAccess;
window.setStudentSemFilter = setStudentSemFilter;

// Send test Telegram notification ping
async function triggerTestTelegramAlert() {
  const btn = $('btnTestTelegramAlert');
  if (btn) btn.disabled = true;

  showAdminToast('Dispatching test Telegram notification...', 'info');

  try {
    const edgeFunctionUrl = (SUPABASE_URL || '').replace(/\/$/, '') + '/functions/v1/telegram-new-user';

    const res = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (typeof SUPABASE_PUBLISHABLE_KEY !== 'undefined' ? SUPABASE_PUBLISHABLE_KEY : ''),
      },
      body: JSON.stringify({
        is_test: true,
        type: 'INSERT',
        record: {
          id: 'test-admin-' + Date.now().toString(36),
          full_name: 'Test Student (Admin Verification)',
          email: 'student.test@bcaprime.com',
          created_at: new Date().toISOString(),
        }
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      showAdminToast('Test notification sent to Telegram!', 'success');
    } else {
      const err = data.hint || data.error || data.message || `Status ${res.status}`;
      showAdminToast('Telegram alert failed: ' + err, 'error');
    }
  } catch (err) {
    showAdminToast('Failed to reach Edge Function: ' + (err.message || 'Network error'), 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Send test ping to dedicated BCAPrime Admin Telegram Bot (/api/telegram-admin-alert)
async function triggerTestAdminBotAlert() {
  const topBtn = $('admTelegramTestBtn');
  const statsBtn = $('btnTestAdminBotAlert');
  if (topBtn) topBtn.disabled = true;
  if (statsBtn) statsBtn.disabled = true;

  showAdminToast('Sending test alert to BCAPrime Admin Bot...', 'info');

  try {
    const res = await fetch('/api/telegram-admin-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'test',
        payload: {
          admin_name: (currentAdminUser && (currentAdminUser.email || currentAdminUser.displayName)) || 'Administrator',
          timestamp: new Date().toISOString()
        }
      })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      showAdminToast('Test alert delivered to BCAPrime Admin Telegram Bot! 🔔', 'success');
    } else {
      const err = data.hint || data.error || `Status ${res.status}`;
      showAdminToast('Admin Bot Alert failed: ' + err, 'error');
    }
  } catch (err) {
    showAdminToast('Network error reaching alert API: ' + (err.message || 'Check connection'), 'error');
  } finally {
    if (topBtn) topBtn.disabled = false;
    if (statsBtn) statsBtn.disabled = false;
  }
}
window.triggerTestAdminBotAlert = triggerTestAdminBotAlert;
