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
  if (!supabaseClient) { setAuthMessage('Supabase is not configured.'); return; }
  const result = await supabaseClient.auth.signInWithPassword({ email, password });
  if (result.error) { setAuthMessage(result.error.message); return; }
  await showAdmin(result.data.session);
}

/* Security note: showDirectAdmin() removed — ab sirf Supabase admin session se
   dashboard khulta hai. Admin banane ke liye supabase-security-fix.sql dekho. */
async function showAdmin(session) {
  const role = session?.user?.app_metadata?.role;
  if (role !== 'admin') {
    await supabaseClient.auth.signOut();
    setAuthMessage('Access denied: This account does not have admin privileges.');
    return;
  }
  $('authScreen').hidden = true;
  $('adminShell').hidden = false;
  $('logoutButton').style.display = 'inline-block';
  load();
}

async function logout() {
  if (supabaseClient) await supabaseClient.auth.signOut();
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
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

async function load() {
  if (!supabaseClient) {
    uploads = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!uploads.length) uploads = [...demoUploads];
    render();
    return;
  }
  try {
    const { data, error } = await supabaseClient.from('resources').select('*').order('created_at', { ascending: false });
    if (error) throw error;
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
      uploader: item.uploader_email || '',
      date: item.created_at
    }));
  } catch (error) {
    console.warn('Could not load resources.', error.message);
    uploads = [];
  }
  render();
  loadFeedback();
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
  $('bulkActions').style.display = selectedIds.size ? 'flex' : 'none';
  $('bulkCount').textContent = `${selectedIds.size} selected`;
  $('checkAll').checked = list.length > 0 && list.every(item => selectedIds.has(String(item.id)));

  const tbody = $('rows');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty">No material found for this filter.</div></td></tr>';
    return;
  }
  tbody.innerHTML = list.map(item => {
    const id = String(item.id);
    const badgeClass = item.status === 'approved' ? '' : 'archived';
    return `<tr>
          <td><input type="checkbox" ${selectedIds.has(id) ? 'checked' : ''} onchange="toggleSelected('${id}',this.checked)"></td>
          <td><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.subject || '')} &middot; ${item.type === 'pyq' ? 'PYQ' : 'Notes'}${item.fileName ? ` &middot; ${escapeHtml(item.fileName)}` : ''}</small>${item.fileUrl ? `<small><a href="${escapeHtml(item.fileUrl)}" target="_blank" rel="noopener">Open file</a></small>` : ''}</td>
          <td>${collegeNames[item.college] || escapeHtml(item.college || 'All colleges')}${item.uploader ? `<small>by ${escapeHtml(item.uploader)}</small>` : ''}</td>
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
  if (supabaseClient && !id.startsWith('demo-') && !id.startsWith('local-')) {
    const { error } = await supabaseClient.from('resources').update({ status }).eq('id', id);
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
  if (supabaseClient && cloudIds.length) {
    const { error } = await supabaseClient.from('resources').update({ status }).in('id', cloudIds);
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
      sendPushBroadcast(
        `${newlyApproved.length} new materials available! 📚`,
        'Fresh notes & PYQs were just approved on BCAPrime — open the library to grab them.',
        'resource-approved'
      );
    }
  }
}

async function bulkDelete() {
  if (!selectedIds.size) return;
  if (!confirm(`Delete ${selectedIds.size} selected item(s)? This cannot be undone.`)) return;
  const cloudIds = [...selectedIds].filter(id => !id.startsWith('demo-') && !id.startsWith('local-'));
  if (supabaseClient && cloudIds.length) {
    const { error } = await supabaseClient.from('resources').delete().in('id', cloudIds);
    if (error) { alert('Delete failed: ' + error.message); return; }
  }
  uploads = uploads.filter(item => !selectedIds.has(String(item.id)));
  saveLocalMirror();
  selectedIds.clear();
  render();
}

/* ---- Auto refresh while the dashboard is visible ---- */
setInterval(() => {
  if (supabaseClient && document.visibilityState === 'visible' && $('adminShell') && $('adminShell').hidden === false) load();
}, 20000);

/* ---- Broadcast push notifications (Web Push via Edge Function) ---- */
// Must match the NOTIFY_SECRET configured on the send-push Edge Function.
const ADMIN_NOTIFY_SECRET = 'F3g2qnkM18UWbVJUNHRD0-wCbr5IgHUz';

async function sendPushBroadcast(title, body, tag) {
  if (typeof SEND_PUSH_FUNCTION_URL === 'undefined') {
    console.warn('send-push function URL missing.');
    return false;
  }
  try {
    const response = await fetch(SEND_PUSH_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify({ title, body, url: '/index.html', tag: tag || 'bcaprime-broadcast', secret: ADMIN_NOTIFY_SECRET })
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
  return sendPushBroadcast(title, body, 'resource-approved');
}

async function handleNotifyFormSubmit(event) {
  event.preventDefault();
  const button = $('notifySend');
  const title = $('notifyTitle').value.trim();
  const body = $('notifyBody').value.trim();
  if (!title) return;
  button.disabled = true;
  button.textContent = 'Sending…';
  const res = await sendPushBroadcast(title, body);
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
  if(typeof supabaseClient==='undefined'||!supabaseClient){list.innerHTML='<p class="note">Supabase is not configured.</p>';return}
  const {data,error}=await supabaseClient.from('feedback').select('*').order('created_at',{ascending:false}).limit(50);
  if(error){list.innerHTML='<p class="note">Load failed: '+error.message+'</p>';return}
  if(!data||!data.length){list.innerHTML='<p class="note">Koi feedback nahi aaya abhi. 🎉</p>';return}
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
  if(typeof supabaseClient==='undefined'||!supabaseClient)return;
  await supabaseClient.from('feedback').update({status:'resolved'}).eq('id',id);
  loadFeedback();
}
async function deleteFeedback(id){
  if(!confirm('Delete this feedback?'))return;
  if(typeof supabaseClient==='undefined'||!supabaseClient)return;
  await supabaseClient.from('feedback').delete().eq('id',id);
  loadFeedback();
}

/* ---- Boot ---- */
document.documentElement.dataset.theme = localStorage.getItem('bca-theme') || 'dark';
$('authForm').addEventListener('submit', submitAuth);

async function initAuth() {
  if (!supabaseClient) { setAuthMessage('Supabase is not configured.'); return; }
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) await showAdmin(data.session);
}

initAuth();

