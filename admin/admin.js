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
async function loadUserStats(showToastFeedback = false) {
  const tbody = $('userRows');
  const countBadge = $('userListCountBadge');
  const emptyWrap = $('usersEmptyState');

  if (emptyWrap) emptyWrap.hidden = true;

  // Render content-shaped skeleton loading rows (Rule 4: Skeleton Shimmer Placeholders on Loading)
  if (tbody) {
    tbody.innerHTML = [1, 2, 3, 4, 5].map((i) => `
      <tr class="skeleton-row">
        <td style="width:48px"><div class="shimmer-box" style="width:20px;height:16px"></div></td>
        <td>
          <div class="user-cell">
            <div class="shimmer-box" style="width:34px;height:34px;border-radius:50%"></div>
            <div style="display:flex;flex-direction:column;gap:6px">
              <div class="shimmer-box" style="width:${90 + (i * 15)}px;height:15px"></div>
              <div class="shimmer-box" style="width:${60 + (i * 10)}px;height:11px"></div>
            </div>
          </div>
        </td>
        <td><div class="shimmer-box" style="width:${130 + (i * 12)}px;height:14px"></div></td>
        <td>
          <div style="display:flex;flex-direction:column;gap:4px">
            <div class="shimmer-box" style="width:120px;height:14px"></div>
            <div class="shimmer-box" style="width:50px;height:11px"></div>
          </div>
        </td>
      </tr>
    `).join('');
  }

  try {
    let stats = null;
    let recent = [];

    if (adminSupabaseClient) {
      // 1. Primary: Server-side RPC get_admin_user_stats
      try {
        const { data, error } = await adminSupabaseClient.rpc('get_admin_user_stats', { p_limit: 50 });
        if (!error && data && typeof data === 'object') {
          stats = data;
          recent = Array.isArray(data.recent_users) ? data.recent_users : [];
        } else if (error) {
          console.warn('[Admin] RPC get_admin_user_stats returned error:', error);
        }
      } catch (rpcErr) {
        console.warn('[Admin] RPC call exception:', rpcErr);
      }

      // 2. Fallback if RPC didn't return data
      if (!stats) {
        console.info('[Admin] Attempting multi-tier fallback query for user stats...');
        let profs = null;

        // Tier A: Query public.profiles
        try {
          const { data: pData, error: pErr } = await adminSupabaseClient
            .from('profiles')
            .select('id, full_name, email, created_at, updated_at')
            .order('created_at', { ascending: false })
            .limit(50);

          if (!pErr && Array.isArray(pData) && pData.length > 0) {
            profs = pData.map(p => ({
              id: p.id,
              name: p.full_name || 'Student',
              email: p.email || '',
              created_at: p.created_at || p.updated_at || new Date().toISOString()
            }));
          }
        } catch (e) {
          console.warn('[Admin] Fallback Tier A (profiles) failed:', e);
        }

        // Tier B: Query public.user_profiles (with created_at)
        if (!profs || profs.length === 0) {
          try {
            const { data: upData, error: upErr } = await adminSupabaseClient
              .from('user_profiles')
              .select('uid, name, email, created_at, updated_at')
              .order('created_at', { ascending: false })
              .limit(50);

            if (!upErr && Array.isArray(upData) && upData.length > 0) {
              profs = upData.map(p => ({
                id: p.uid,
                name: p.name || 'Student',
                email: p.email || '',
                created_at: p.created_at || p.updated_at || new Date().toISOString()
              }));
            } else if (upErr) {
              // Tier C: Query public.user_profiles (with updated_at only, in case created_at is missing)
              const { data: upOldData } = await adminSupabaseClient
                .from('user_profiles')
                .select('uid, name, email, updated_at')
                .order('updated_at', { ascending: false })
                .limit(50);

              if (Array.isArray(upOldData)) {
                profs = upOldData.map(p => ({
                  id: p.uid,
                  name: p.name || 'Student',
                  email: p.email || '',
                  created_at: p.updated_at || new Date().toISOString()
                }));
              }
            }
          } catch (e) {
            console.warn('[Admin] Fallback Tier B/C (user_profiles) failed:', e);
          }
        }

        if (Array.isArray(profs)) {
          recent = profs;
          // Calculate approximate stats in IST
          const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
          const todayStart = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate());
          const weekStart = new Date(todayStart);
          weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
          const monthStart = new Date(nowIST.getFullYear(), nowIST.getMonth(), 1);
          const lastMonthStart = new Date(nowIST.getFullYear(), nowIST.getMonth() - 1, 1);
          const lastMonthEnd = new Date(nowIST.getFullYear(), nowIST.getMonth(), 0, 23, 59, 59, 999);

          let tCount = 0, wCount = 0, mCount = 0, lmCount = 0;
          recent.forEach(r => {
            const rDate = new Date(new Date(r.created_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
            if (rDate >= todayStart) tCount++;
            if (rDate >= weekStart) wCount++;
            if (rDate >= monthStart) mCount++;
            if (rDate >= lastMonthStart && rDate <= lastMonthEnd) lmCount++;
          });

          stats = {
            total_users: recent.length,
            users_today: tCount,
            users_this_week: wCount,
            users_this_month: mCount,
            users_last_month: lmCount,
            recent_users: recent
          };
        }
      }
    }

    if (!stats) {
      stats = {
        total_users: 0,
        users_today: 0,
        users_this_week: 0,
        users_this_month: 0,
        users_last_month: 0,
        recent_users: []
      };
    }

    // Populate stat counters
    if ($('statTotalUsers')) $('statTotalUsers').textContent = Number(stats.total_users || 0).toLocaleString();
    if ($('statUsersToday')) $('statUsersToday').textContent = Number(stats.users_today || 0).toLocaleString();
    if ($('statUsersWeek')) $('statUsersWeek').textContent = Number(stats.users_this_week || 0).toLocaleString();
    if ($('statUsersMonth')) $('statUsersMonth').textContent = Number(stats.users_this_month || 0).toLocaleString();
    if ($('statUsersLastMonth')) $('statUsersLastMonth').textContent = Number(stats.users_last_month || 0).toLocaleString();

    recentUsersList = Array.isArray(recent) ? recent : [];
    renderRecentUsers(recentUsersList);

    if (showToastFeedback) {
      showAdminToast('User statistics & signups updated.', 'success');
    }
  } catch (err) {
    console.error('[Admin] loadUserStats failed:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="empty" style="text-align:center;padding:36px 16px;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:26px;color:var(--brand);margin-bottom:10px;display:block"></i>
            <div style="font-weight:600;font-size:14px;margin-bottom:6px">Could not load user stats</div>
            <div style="color:var(--muted);font-size:12.5px;max-width:440px;margin:0 auto 16px;line-height:1.5">
              ${escapeHtml(err.message || 'Please check connection or ensure SQL migration has been executed.')}
            </div>
            <button class="button primary" onclick="loadUserStats(true)" style="min-height:44px;padding:0 20px">
              <i class="fa-solid fa-arrows-rotate"></i> Retry
            </button>
          </td>
        </tr>
      `;
    }
    if (showToastFeedback) {
      showAdminToast('Error loading stats: ' + (err.message || 'Unknown error'), 'error');
    }
  }
}

// Render recent user rows
function renderRecentUsers(usersToRender) {
  const tbody = $('userRows');
  const countBadge = $('userListCountBadge');
  const emptyWrap = $('usersEmptyState');

  if (!tbody) return;

  const list = Array.isArray(usersToRender) ? usersToRender : [];

  if (countBadge) {
    countBadge.textContent = `${list.length} ${list.length === 1 ? 'user' : 'users'}`;
  }

  // Dedicated EmptyState fallback (Rule 5: Dedicated EmptyState for Every List & Feed)
  if (list.length === 0) {
    tbody.innerHTML = '';
    if (emptyWrap) {
      emptyWrap.hidden = false;
      emptyWrap.innerHTML = `
        <div style="padding:28px 16px;text-align:center">
          <i class="fa-solid fa-users-slash" style="font-size:32px;color:var(--muted);margin-bottom:12px;display:block"></i>
          <h3 style="margin:0 0 6px;font-size:16px">No users found</h3>
          <p style="color:var(--muted);font-size:13px;margin:0 0 16px">No registered student accounts match your filter criteria.</p>
          <button class="button" onclick="clearUserFilter()" style="min-height:44px;padding:0 18px">
            <i class="fa-solid fa-xmark"></i> Clear Filter
          </button>
        </div>
      `;
      if (window.BCA_UI && window.BCA_UI.PressableScale) {
        const btn = emptyWrap.querySelector('button');
        if (btn) window.BCA_UI.PressableScale(btn);
      }
    }
    return;
  }

  if (emptyWrap) emptyWrap.hidden = true;

  try {
    tbody.innerHTML = list.map((u, idx) => {
      const displayName = escapeHtml(u.name || 'Student');
      const displayEmail = escapeHtml(u.email || 'No email');
      const firstLetter = (u.name || u.email || 'S').trim().charAt(0).toUpperCase();
      const avatarColor = getUserAvatarColor(u.name || u.email);
      const dateIST = formatISTDate(u.created_at);
      const relTime = getRelativeTime(u.created_at);

      return `
        <tr>
          <td style="color:var(--muted);font-weight:600;font-size:12px;width:48px">${idx + 1}</td>
          <td>
            <div class="user-cell">
              <div class="user-avatar-circle" style="background:${avatarColor}">${firstLetter}</div>
              <div class="user-info">
                <span class="user-name-text">${displayName}</span>
                ${u.id ? `<small style="display:block;color:var(--muted-dim);font-size:11px;font-family:monospace">UID: ${escapeHtml(String(u.id).slice(0, 8))}&hellip;</small>` : ''}
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
          </td>
        </tr>
      `;
    }).join('');
  } catch (renderErr) {
    console.error('[Admin] renderRecentUsers error:', renderErr);
    tbody.innerHTML = `<tr><td colspan="4" class="empty">Error rendering users: ${escapeHtml(renderErr.message)}</td></tr>`;
  }
}

// Live real-time search without find/submit buttons (Rule 7: Live Real-Time Filtering & Search)
function filterRecentUsers() {
  clearTimeout(userSearchDebounceTimer);
  userSearchDebounceTimer = setTimeout(() => {
    const q = ($('userSearchInput')?.value || '').trim().toLowerCase();
    if (!q) {
      renderRecentUsers(recentUsersList);
      return;
    }

    const filtered = recentUsersList.filter(u => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const uid = String(u.id || '').toLowerCase();
      return name.includes(q) || email.includes(q) || uid.includes(q);
    });

    renderRecentUsers(filtered);
  }, 250);
}

// Clear search input filter
function clearUserFilter() {
  const input = $('userSearchInput');
  if (input) input.value = '';
  renderRecentUsers(recentUsersList);
}

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
