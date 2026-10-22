/* ============================================================
   BCAPrime Admin — admin.js
   Supabase-backed moderation panel
   ============================================================ */

const STORAGE_KEY = 'bca-uploads';

/* ---- Fallback demo data (used only when Supabase is not configured) ---- */
const demoUploads = [
  { id: 'demo-1', title: 'DBMS Unit 2 Revision Notes', type: 'notes', sem: 3, year: 2, subject: 'Database Management Systems', college: 'du', fileName: 'dbms-unit-2.pdf', status: 'approved' },
  { id: 'demo-2', title: 'Operating Systems PYQ 2024', type: 'pyq', sem: 6, year: 3, subject: 'Operating Systems', college: 'ccsu', fileName: 'os-pyq-2024.pdf', status: 'approved' },
  { id: 'demo-3', title: 'C Programming Crash Notes', type: 'notes', sem: 1, year: 1, subject: 'Programming Principles & C', college: 'all', fileName: 'c-programming-notes.pdf', status: 'approved' }
];

const collegeNames = {
  all: 'All colleges',
  ccsu: 'CCSU Meerut',
  ipu: 'GGSIPU Delhi',
  du: 'Delhi University',
  aktu: 'AKTU / UPTU',
  ignou: 'IGNOU',
  pune: 'Pune University',
  bangalore: 'Bangalore University',
  other: 'Other University'
};

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
  const matTab = document.querySelector('.tab[data-tab="material"]');
  if (matTab) matTab.click();
  const firstPending = document.querySelector('.new-pending');
  if (firstPending) {
    firstPending.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstPending.classList.add('scanned');
  }
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
  $('logoutButton').style.display = 'inline-block';
  load();
  loadSubjects();
  loadReports();
  startAdminLiveSync();
}

async function logout() {
  if (adminSupabaseClient) await adminSupabaseClient.auth.signOut();
  resetToAuthScreen();
}

function resetToAuthScreen() {
  $('adminShell').hidden = true;
  $('authScreen').hidden = false;
  $('logoutButton').style.display = 'none';
  setAuthMessage('Logged out');
  $('authForm').reset();
}

/* ---- Admin panel: Supabase-backed moderation ---- */
function toggleTheme() {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('bca-theme', root.dataset.theme);
  try { localStorage.setItem('bca-theme-manual', '1'); } catch (e) {}
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

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
/* ---- Live sync (contributor profiles + resources) ----
   User apna naam/DP badale ya naya resource aaye -> admin table turant
   refresh (F5 ki zaroorat nahi). 600ms debounce se burst events ek hi
   reload me collapse ho jaate hain. */
let adminLiveChannel = null;
let adminReloadTimer = null;
function scheduleAdminReload() {
  clearTimeout(adminReloadTimer);
  adminReloadTimer = setTimeout(() => { load().catch(() => {}); }, 600);
}
function startAdminLiveSync() {
  if (!adminSupabaseClient || adminLiveChannel) return;
  try {
    adminLiveChannel = adminSupabaseClient.channel('admin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resources' }, scheduleAdminReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, scheduleAdminReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resource_reports' }, (payload) => {
        loadReports();
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



/* ---- Rendering ---- */
function filteredUploads() {
  const query = ($('search').value || '').toLowerCase();
  const status = $('statusFilter').value;
  return uploads.filter(item => {
    const matchQuery = !query ||
      (item.title || '').toLowerCase().includes(query) ||
      (item.college || '').toLowerCase().includes(query);
    const matchStatus = status === 'all' || item.status === status;
    return matchQuery && matchStatus;
  });
}

function render() {
  const list = filteredUploads();

  $('totalCount').textContent = uploads.length;
  $('collegeCount').textContent = new Set(uploads.map(item => item.college)).size;
  $('activeCount').textContent = uploads.filter(item => item.status === 'approved').length;

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
  $('checkAll').checked = list.length > 0 && list.every(item => selectedIds.has(String(item.id)));

  const tbody = $('rows');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty">No material found for this filter.</div></td></tr>';
    return;
  }
  tbody.innerHTML = list.map(item => {
    const id = String(item.id);
    const badgeClass = item.status === 'approved' ? '' : 'archived';
    const typeLabel = item.type === 'pyq' ? 'PYQ' : 'Notes';
    const typeClass = item.type === 'pyq' ? 'type-pyq' : 'type-notes';
    const isNewPending = item.status === 'pending' && item.date && isRecentlyAdded(item.date);
    const rowClass = isNewPending ? 'new-pending' : '';
    return `<tr class="${rowClass}">
          <td><input type="checkbox" ${selectedIds.has(id) ? 'checked' : ''} onchange="toggleSelected('${id}',this.checked)"></td>
          <td><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.subject || '')}${item.fileName ? ` &middot; ${escapeHtml(item.fileName)}` : ''}</small>${item.fileUrl ? `<small><a href="#" onclick="event.preventDefault();openResourceFile('${escapeHtml(item.fileUrl)}')" >Open file</a></small>` : ''}</td>
          <td><span class="type-badge ${typeClass}">${typeLabel === 'PYQ' ? '📝 PYQ' : '📚 Notes'}</span></td>
          <td>${collegeNames[item.college] || escapeHtml(item.college || 'All colleges')}${item.uploader ? `<small>${item.uploaderAvatar ? `<img src="${escapeHtml(item.uploaderAvatar)}" alt="" width="16" height="16" style="border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:5px">` : ''}by ${escapeHtml(item.uploader)}</small>` : ''}</td>
          <td>Semester ${item.sem}${item.year ? `<small>Year ${item.year}</small>` : ''}</td>
          <td><span class="badge ${badgeClass}">${item.status}</span></td>
          <td><div class="row-actions">
            ${item.status !== 'approved' ? `<button class="button primary" onclick="updateStatus('${id}','approved')">Approve</button>` : ''}
            ${item.status !== 'rejected' ? `<button class="button danger" onclick="updateStatus('${id}','rejected')">Reject</button>` : ''}
            ${item.status !== 'archived' ? `<button class="button" onclick="updateStatus('${id}','archived')">Archive</button>` : ''}
          </div></td>
        </tr>`;
  }).join('');
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
  if (adminSupabaseClient && !id.startsWith('demo-') && !id.startsWith('local-')) {
    const { error } = await adminSupabaseClient.from('resources').update({ status }).eq('id', id);
    if (error) { alert('Update failed: ' + error.message); load(); return; }
  }
  item.status = status;
  saveLocalMirror();
  render();
  if (status === 'approved' && $('notifyOnApprove') && $('notifyOnApprove').checked) {
    notifyResourceApproved(item);
  }
}

async function bulkUpdateStatus(status) {
  if (!selectedIds.size) return;
  const cloudIds = [...selectedIds].filter(id => !id.startsWith('demo-') && !id.startsWith('local-'));
  if (adminSupabaseClient && cloudIds.length) {
    const { error } = await adminSupabaseClient.from('resources').update({ status }).in('id', cloudIds);
    if (error) { alert('Bulk update failed: ' + error.message); return; }
  }
  const newlyApproved = status === 'approved'
    ? uploads.filter(item => selectedIds.has(String(item.id)))
    : [];
  uploads.forEach(item => { if (selectedIds.has(String(item.id))) item.status = status; });
  saveLocalMirror();
  selectedIds.clear();
  render();
  const autoNotify = $('notifyOnApprove') && $('notifyOnApprove').checked;
  if (status === 'approved' && newlyApproved.length && autoNotify) {
    if (newlyApproved.length === 1) {
      notifyResourceApproved(newlyApproved[0]);
    } else {
      // STRICT semester scoping: har approved resource ki apni semester (+college)
      // group banao aur har group KOI ek targeted push bhejo. Semester-less
      // broadcast BILKUL nahi — Sem 1 ke materials sirf Sem 1 subscribers tak.
      const groups = new Map();
      newlyApproved.forEach(item => {
        const sem = item.sem != null && item.sem !== '' ? Number(item.sem) : null;
        if (sem == null || Number.isNaN(sem)) return; // bina semester -> auto-push nahi
        const col = item.college ? String(item.college) : 'all';
        const key = sem + '|' + col;
        if (!groups.has(key)) groups.set(key, { sem, col, count: 0 });
        groups.get(key).count += 1;
      });
      for (const g of groups.values()) {
        sendPushBroadcast(
          g.count > 1
            ? `${g.count} new Semester ${g.sem} materials available! 📚`
            : `New Semester ${g.sem} material available! 📚`,
          'Fresh notes & PYQs were just approved on BCAPrime — open the library to grab them.',
          'resource-approved',
          { college: g.col, semester: g.sem }
        );
      }
    }
  }
}

async function bulkDelete() {
  if (!selectedIds.size) return;
  openSafeDelete(`Delete ${selectedIds.size} selected item(s)? This cannot be undone.`, async () => {
    const cloudIds = [...selectedIds].filter(id => !id.startsWith('demo-') && !id.startsWith('local-'));
    if (adminSupabaseClient && cloudIds.length) {
      const { error } = await adminSupabaseClient.from('resources').delete().in('id', cloudIds);
      if (error) { alert('Delete failed: ' + error.message); return; }
    }
    uploads = uploads.filter(item => !selectedIds.has(String(item.id)));
    saveLocalMirror();
    selectedIds.clear();
    render();
  });
}

/* ---- Auto refresh while the dashboard is visible ---- */
setInterval(() => {
  if (adminSupabaseClient && document.visibilityState === 'visible' && $('adminShell') && $('adminShell').hidden === false) load();
}, 20000);

/* ---- Broadcast push notifications (Web Push via Edge Function) ---- */
// Must match the NOTIFY_SECRET configured on the send-push Edge Function.
const ADMIN_NOTIFY_SECRET = 'F3g2qnkM18UWbVJUNHRD0-wCbr5IgHUz';

/* ---- Private bucket: admin "Open file" ab signed URL se khulta hai ----
   resources bucket private hai, isliye seedha public URL 403 deta hai.
   sign-resource Edge Function admin secret bhejti hai -> full access. */
async function openResourceFile(fileUrl) {
  if (!fileUrl) return;
  if (typeof SUPABASE_URL === 'undefined') { window.open(fileUrl, '_blank', 'noopener'); return; }
  try {
    const res = await fetch(SUPABASE_URL + '/functions/v1/sign-resource', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (typeof SUPABASE_PUBLISHABLE_KEY !== 'undefined' ? SUPABASE_PUBLISHABLE_KEY : ''),
        'x-admin-secret': ADMIN_NOTIFY_SECRET,
      },
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
  try {
    const payload = { title, body, url: '/index.html', tag: tag || 'bcaprime-broadcast', secret: ADMIN_NOTIFY_SECRET };
        // Optional targeting (college + semester) — when provided, only matching users get the push.
    if (target && target.college) payload.college = target.college;
    if (target && target.semester != null) payload.semester = Number(target.semester);
    const response = await fetch(SEND_PUSH_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = [result.error, result.hint].filter(Boolean).join(' | ');
      alert('Notification failed: ' + (detail || response.status));
      return false;
    }
    return { ok: true, sent: result.sent ?? 0, failed: result.failed ?? 0, removed: result.removed ?? 0 };
  } catch (error) {
    alert('Notification failed: ' + error.message);
    return false;
  }
}

function notifyResourceApproved(item) {
  const college = collegeNames[item.college] || item.college || 'all colleges';
  const title = item.type === 'pyq' ? 'New PYQ available! 📝' : 'New notes available! 📚';
  const body = `${item.title} — Semester ${item.sem}, ${college}. Open BCAPrime to download.`;
    // Targeting: only subscribed users matching this college + semester receive it.
  return sendPushBroadcast(title, body, 'resource-approved', { college: item.college || 'all', semester: item.sem != null ? Number(item.sem) : null });
}

async function handleNotifyFormSubmit(event) {
  event.preventDefault();
  const button = $('notifySend');
  const title = $('notifyTitle').value.trim();
  const body = $('notifyBody').value.trim();
  if (!title) return;
  button.disabled = true;
  button.textContent = 'Sending…';
  // Optional targeting from the form — empty = broadcast to all.
  const target = {
    college: $('notifyCollege').value || null,
    semester: $('notifySemester').value ? Number($('notifySemester').value) : null
  };
  const res = await sendPushBroadcast(title, body, undefined, target);
  button.disabled = false;
  if (res && res.ok) {
    $('notifyForm').reset();
    button.innerHTML = `✓ Sent! (delivered: ${res.sent}, failed: ${res.failed})`;
    setTimeout(() => { button.innerHTML = '<i>&#128276;</i> Send to all users'; }, 6000);
  } else {
    button.innerHTML = '<i>&#128276;</i> Send to all users';
  }
}
$('notifyForm').addEventListener('submit', handleNotifyFormSubmit);

/* ---- User feedback panel ---- */
async function loadFeedback(){
  const list=$('feedbackList');if(!list)return;
  list.innerHTML='<p class="note">Loading&hellip;</p>';
  if(typeof adminSupabaseClient==='undefined'||!adminSupabaseClient){list.innerHTML='<p class="note">Supabase is not configured.</p>';return}
  const {data,error}=await adminSupabaseClient.from('feedback').select('*').order('created_at',{ascending:false}).limit(50);
  if(error){list.innerHTML='<p class="note">Load failed: '+error.message+'</p>';return}
    if(!data||!data.length){list.innerHTML='<p class="note">No feedback yet. 🎉</p>';return}
  list.innerHTML=data.map(item=>{
    const kindClass={bug:'k-bug',idea:'k-idea',question:'k-question'}[item.kind]||'k-idea';
    const whoLine=[item.user_name,item.user_email].filter(Boolean).join(' · ');
    return `<div class="feedback-item ${item.status}">
      <div class="fi-head"><span class="fi-kind ${kindClass}">${item.kind}</span><small>${new Date(item.created_at).toLocaleString()}</small></div>
      <p class="fi-msg">${escapeHtml(item.message)}</p>
      ${item.screenshot_url?`<a href="${escapeHtml(item.screenshot_url)}" target="_blank" rel="noopener"><img src="${escapeHtml(item.screenshot_url)}" class="fi-shot" alt="screenshot"></a>`:''}
      ${whoLine?`<div class="fi-who"><i class="fa-solid fa-user"></i>${escapeHtml(whoLine)}${item.page_url?`<small>&middot; ${escapeHtml((item.page_url||'').slice(0,40))}</small>`:''}</div>`:''}
      <div class="fi-meta">${escapeHtml((item.user_agent||'').slice(0,70))}</div>
      <div class="row-actions">
        ${item.status==='open'?`<button class="button primary" onclick="resolveFeedback(${item.id})">Mark resolved</button>`:'<span class="fi-resolved">✔ Resolved</span>'}
        <button class="button danger" onclick="deleteFeedback(${item.id})">Delete</button>
      </div>
    </div>`}).join('');
}
async function resolveFeedback(id){
  if(typeof adminSupabaseClient==='undefined'||!adminSupabaseClient)return;
  await adminSupabaseClient.from('feedback').update({status:'resolved'}).eq('id',id);
  loadFeedback();
}
async function deleteFeedback(id){
  openSafeDelete('This feedback entry will be permanently removed. This cannot be undone.', async () => doDeleteFeedback(id));
}
async function doDeleteFeedback(id){
  if(typeof adminSupabaseClient==='undefined'||!adminSupabaseClient)return;
  await adminSupabaseClient.from('feedback').delete().eq('id',id);
  loadFeedback();
}

/* ============================================================
   Admin Tabs
   ============================================================ */
function switchTab(tab){
  document.querySelectorAll('.admin-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  ['material','subjects','pending','lostfound','reports','quizzes'].forEach(id => {
    const el = $('tab-' + id);
    if (el) el.hidden = (id !== tab);
  });
  if (tab === 'subjects') { if (!$('subjectCollege').options.length) populateSubjectFilters(); renderSubjects(); }
  if (tab === 'pending') loadPendingSubjects();
  if (tab === 'lostfound') loadLostFoundAdmin();
  if (tab === 'reports') loadReports();
  if (tab === 'quizzes') loadAdminQuizzes();
}

/* ============================================================
   Subject Manager (college + semester filters, card grid)
   ============================================================ */
const subjectColleges = [
  ['all','All Colleges'],['avviare','Avviare Educational Hub'],['glocal','Glocal University'],
  ['ccsu','CCSU Meerut'],['du','Delhi University'],['ipu','GGSIPU Delhi'],['aktu','AKTU / UPTU'],
  ['ignou','IGNOU'],['mdu','MDU Rohtak'],['bhu','BHU'],['pune','Pune University'],
  ['bangalore','Bangalore University'],['other','Other University']
];
const subjectCollegesMap = Object.fromEntries(subjectColleges);
let subjects = [];

function populateSubjectFilters(){
  const collegeSel = $('subjectCollege');
  collegeSel.innerHTML = subjectColleges.map(c => `<option value="${c[0]}">${escapeHtml(c[1])}</option>`).join('');
  const collegePick = $('subjectCollegePick');
  collegePick.innerHTML = subjectColleges.map(c => `<option value="${c[0]}">${escapeHtml(c[1])}</option>`).join('');
  const semSel = $('subjectSemester');
  semSel.innerHTML = '<option value="all">All Semesters</option>' + [1,2,3,4,5,6,7,8].map(s => `<option value="${s}">Semester ${s}</option>`).join('');
  const semPick = $('subjectSem');
  semPick.innerHTML = [1,2,3,4,5,6,7,8].map(s => `<option value="${s}">Semester ${s}</option>`).join('');
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
async function loadLostFoundAdmin(){
  const host=$('lostfoundQueue');if(!host)return;
  if(!adminSupabaseClient){host.innerHTML='<p class="note">Supabase is not configured.</p>';return}
  const {data,error}=await adminSupabaseClient.from('lost_found').select('*').order('created_at',{ascending:false}).limit(100);
  if(error){host.innerHTML='<p class="note">Could not load posts. ('+escapeHtml(error.message)+')</p>';return}
  const rows=data||[];
  if(!rows.length){host.innerHTML='<p class="note">No Lost &amp; Found posts yet.</p>';return}
  host.innerHTML=rows.map(r=>{
    const label=r.type==='lost'?'LOST':'FOUND';
    const cls=r.type==='lost'?'lf-adm-lost':'lf-adm-found';
    const item=(r.category==='other'&&(r.custom_category||'').trim())?r.custom_category:lfAdmCatName(r.category);
    const college=(collegeNames&&collegeNames[r.college])||r.college||'all';
    const who=(r.poster_name||'').replace(/[<>&"']/g,'');
    const time=r.created_at?new Date(r.created_at).toLocaleString():'';
    const img=r.image_url
      ?'<a href="'+escapeHtml(r.image_url)+'" target="_blank" rel="noopener" title="Open full image"><img class="lf-adm-thumb" src="'+escapeHtml(r.image_url)+'" alt="Item photo"></a>'
      :'<span class="lf-adm-noimg"><i class="fa-solid fa-image"></i> No photo</span>';
    let actions='';
    if(r.status==='pending'){
      actions='<div class="row-actions">'
        +'<button class="button primary" onclick="approveLostFoundPost('+r.id+')"><i class="fa-solid fa-check"></i> Approve</button>'
        +'<button class="button danger" onclick="openSafeDelete(\'Reject this Lost &amp; Found post? (campus-post #'+r.id+')\',()=>removeLostFoundPost('+r.id+'))"><i class="fa-solid fa-xmark"></i> Reject</button>'
        +'</div>';
    } else if(r.status==='removed'){
      actions='<div class="note">Rejected / archived (removed from public feed).</div>';
    } else {
      actions='<div class="row-actions"><button class="button danger" onclick="openSafeDelete(\'Remove this Lost &amp; Found post from the public feed? (campus-post #'+r.id+')\',()=>removeLostFoundPost('+r.id+'))"><i class="fa-solid fa-trash"></i> Remove</button></div>';
    }
    return '<div class="lf-admin-item '+r.status+'">'
      +'<div class="lf-adm-head"><span class="lf-adm-badge '+cls+'">'+label+'</span>'+lfAdmStatusBadge(r.status)+'<small>'+time+'</small></div>'
      +'<div class="lf-adm-withimg">'+img
      +'<div class="lf-adm-info"><div class="lf-adm-body"><b>'+escapeHtml(item)+'</b> &mdash; '+escapeHtml(r.description||'')+'</div>'
      +'<div class="lf-adm-meta"><span>&#128205; '+escapeHtml(r.location||'')+'</span><span>&#127979; '+escapeHtml(college)+'</span>'
      +(r.poster_avatar?'<img src="'+escapeHtml(r.poster_avatar)+'" alt="" width="18" height="18" style="border-radius:50%;object-fit:cover">':'')
      +'<span>'+(who||'Student')+'</span></div></div></div>'
      +actions
      +'</div>';
  }).join('');
}
async function approveLostFoundPost(id){
  if(!adminSupabaseClient)return;
  const {error}=await adminSupabaseClient.from('lost_found').update({status:'active'}).eq('id',id);
  if(error){ alert('Approve failed: ' + error.message); return; }
  /* Approve hote hi college ko push (notify-lostfound Edge Function) */
  try{
    const res = await fetch(SUPABASE_URL + '/functions/v1/notify-lostfound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: id, secret: ADMIN_NOTIFY_SECRET })
    });
    const result = await res.json();
    if (!res.ok && result.blocked === 'daily-limit') {
      alert('Notification blocked: daily post limit reached for this user.');
    } else if (!res.ok) {
      const detail = [result.error, result.hint].filter(Boolean).join(' | ');
      alert('Notification failed: ' + (detail || res.status));
    } else {
      console.info('[LostFound] push sent:', result.sent, 'failed:', result.failed);
    }
  }catch(e){ console.warn('LostFound notify failed:', e.message); }
  loadLostFoundAdmin();
}
async function removeLostFoundPost(id){
  if(!adminSupabaseClient)return;
  await adminSupabaseClient.from('lost_found').update({status:'removed'}).eq('id',id);
  loadLostFoundAdmin();
}
/* ---- Boot ---- */
document.documentElement.dataset.theme = localStorage.getItem('bca-theme') || 'dark';
$('authForm').addEventListener('submit', submitAuth);

async function initAuth() {
  if (!adminSupabaseClient) { setAuthMessage('Supabase is not configured.'); return; }
  const { data } = await adminSupabaseClient.auth.getSession();
  if (data.session) await showAdmin(data.session);
}

initAuth();

/* ---- PWA: installable admin panel ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('./admin-sw.js?q=2')
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
  btn.innerHTML = enabled
    ? '<i class="fa-solid fa-bell-slash"></i> Alerts On'
    : '<i class="fa-solid fa-bell"></i> Admin Alerts';
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
      const reg = await navigator.serviceWorker.getRegistration('./admin-sw.js?q=2');
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
    const reg = await navigator.serviceWorker.register('./admin-sw.js?q=2');
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






