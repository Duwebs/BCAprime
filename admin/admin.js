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
  loadSubjects();
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
  try { localStorage.setItem('bca-theme-manual', '1'); } catch (e) {}
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
      uploader: item.uploader_name || item.uploader_email || '',
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
            // Bulk: if all share the same college + semester, target only those; otherwise broadcast to all.
      const colleges = [...new Set(newlyApproved.map(i => i.college ? String(i.college) : 'all'))];
      const sems = [...new Set(newlyApproved.map(i => i.sem != null ? Number(i.sem) : null))];
      const target = {
        college: colleges.length === 1 ? colleges[0] : null,
        semester: sems.length === 1 ? sems[0] : null
      };
      sendPushBroadcast(
        `${newlyApproved.length} new materials available! 📚`,
        'Fresh notes & PYQs were just approved on BCAPrime — open the library to grab them.',
        'resource-approved',
        target
      );
    }
  }
}

async function bulkDelete() {
  if (!selectedIds.size) return;
  openSafeDelete(`Delete ${selectedIds.size} selected item(s)? This cannot be undone.`, async () => {
    const cloudIds = [...selectedIds].filter(id => !id.startsWith('demo-') && !id.startsWith('local-'));
    if (supabaseClient && cloudIds.length) {
      const { error } = await supabaseClient.from('resources').delete().in('id', cloudIds);
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
  if (supabaseClient && document.visibilityState === 'visible' && $('adminShell') && $('adminShell').hidden === false) load();
}, 20000);

/* ---- Broadcast push notifications (Web Push via Edge Function) ---- */
// Must match the NOTIFY_SECRET configured on the send-push Edge Function.
const ADMIN_NOTIFY_SECRET = 'F3g2qnkM18UWbVJUNHRD0-wCbr5IgHUz';

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
  if(typeof supabaseClient==='undefined'||!supabaseClient){list.innerHTML='<p class="note">Supabase is not configured.</p>';return}
  const {data,error}=await supabaseClient.from('feedback').select('*').order('created_at',{ascending:false}).limit(50);
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
  if(typeof supabaseClient==='undefined'||!supabaseClient)return;
  await supabaseClient.from('feedback').update({status:'resolved'}).eq('id',id);
  loadFeedback();
}
async function deleteFeedback(id){
  openSafeDelete('This feedback entry will be permanently removed. This cannot be undone.', async () => doDeleteFeedback(id));
}
async function doDeleteFeedback(id){
  if(typeof supabaseClient==='undefined'||!supabaseClient)return;
  await supabaseClient.from('feedback').delete().eq('id',id);
  loadFeedback();
}

/* ============================================================
   Admin Tabs
   ============================================================ */
function switchTab(tab){
  document.querySelectorAll('.admin-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  ['material','subjects','pending'].forEach(id => {
    const el = $('tab-' + id);
    if (el) el.hidden = (id !== tab);
  });
  if (tab === 'subjects') { if (!$('subjectCollege').options.length) populateSubjectFilters(); renderSubjects(); }
  if (tab === 'pending') loadPendingSubjects();
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
  if (!supabaseClient) { $('subjectGrid').innerHTML = '<p class="note">Supabase is not configured.</p>'; return; }
  if (!$('subjectCollege').options.length) populateSubjectFilters();
  try {
    const { data, error } = await supabaseClient.from('subjects').select('*').order('created_at', { ascending: false });
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
    if (!supabaseClient) throw new Error('Supabase is not configured.');
    await supabaseClient.from('subjects').update(payload).eq('id', id);
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
    if (supabaseClient) await supabaseClient.from('subjects').delete().eq('id', id);
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
  if (!supabaseClient) { if (queue) queue.innerHTML = '<p class="note">Supabase is not configured.</p>'; return; }
  let pending = subjects.filter(s => s.status === 'pending');
  if (!subjects.length) {
    const { data, error } = await supabaseClient.from('subjects').select('*').eq('status', 'pending').order('created_at', { ascending: false });
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
  if (!supabaseClient) return;
  await supabaseClient.from('subjects').update({ status: 'approved', is_public: true }).eq('id', id);
  await loadSubjects();
}

function rejectPendingSubject(id){
  const s = subjects.find(sub => String(sub.id) === String(id));
  openSafeDelete(`Pending subject request "${s ? s.name : '#' + id}" will be fully deleted (rejected). This cannot be undone.`, async () => {
    if (supabaseClient) await supabaseClient.from('subjects').delete().eq('id', id);
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
/* ---- Boot ---- */
document.documentElement.dataset.theme = localStorage.getItem('bca-theme') || 'dark';
$('authForm').addEventListener('submit', submitAuth);

async function initAuth() {
  if (!supabaseClient) { setAuthMessage('Supabase is not configured.'); return; }
  const { data } = await supabaseClient.auth.getSession();
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


