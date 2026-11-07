/**
 * BCAPrime — notifications.js
 * Real-time Smart Notification Bell & Drawer backed by Supabase
 *
 * Implements:
 * - Realtime notifications listener (.on('INSERT', ...))
 * - Light / Dark mode responsive drawer using UI BottomSheet
 * - Unread red dot and smooth shaking animation
 * - Mark all as read & individual mark as read
 * - Instant router.push navigation to notes, PYQs, and community requests
 * - Full adherence to BCAPrime UI Architecture & Design System Rules
 */

(function () {
  'use strict';

  const STORAGE_READ_KEY = 'bca_read_notifications_v1';
  const NOTIFICATIONS_TABLE = 'notifications';

  let notificationsList = [];
  let unreadCount = 0;
  let bottomSheetInstance = null;
  let realtimeChannel = null;
  let isFetching = false;

  /* ============================================================
     1. Global Router Implementation (router.push)
     ============================================================ */
  window.router = window.router || {};
  window.router.push = function (target) {
    if (!target) return;

    let destination = target;
    if (typeof destination === 'object') {
      destination = destination.target_url || destination.target_resource || destination.url || '';
    }
    destination = String(destination).trim();

    console.info('[Router] Navigating to:', destination);

    // 1. Senior Requests / Ask seniors
    if (
      destination === 'senior-requests' ||
      destination === 'ask-seniors' ||
      destination === 'senior_requests' ||
      destination === '#seniorRequests' ||
      destination === '#ask-seniors'
    ) {
      if (typeof window.openSeniorRequestRoute === 'function') {
        window.openSeniorRequestRoute();
      } else if (typeof window.openSeniorRequest === 'function') {
        window.openSeniorRequest();
      }
      return;
    }

    // 2. Junior Requests / Community requests
    if (
      destination === 'juniors-requests' ||
      destination === 'junior-requests' ||
      destination === 'community-request' ||
      destination === '#juniors-requests'
    ) {
      if (typeof window.openJuniorsRequestRoute === 'function') {
        window.openJuniorsRequestRoute();
      } else if (typeof window.openJuniorsRequest === 'function') {
        window.openJuniorsRequest();
      }
      return;
    }

    // 3. Mock tests
    if (
      destination === 'mocktest' ||
      destination === 'mock-tests' ||
      destination === '#mocktest'
    ) {
      if (typeof window.openMockTestsRoute === 'function') {
        window.openMockTestsRoute();
      }
      return;
    }

    // 4. Upload material
    if (destination === 'upload' || destination === '#upload') {
      if (typeof window.openUpload === 'function') {
        window.openUpload();
      }
      return;
    }

    // 5. Hash navigation
    if (destination.startsWith('#')) {
      const targetEl = document.querySelector(destination);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' });
      } else {
        location.hash = destination;
      }
      return;
    }

    // 6. External or absolute URL
    if (destination.startsWith('http://') || destination.startsWith('https://')) {
      window.location.href = destination;
      return;
    }

    // 7. Resource Title / ID preview (notes or PYQ)
    const cleanId = destination.replace(/\W/g, '');
    if (typeof window.previewResource === 'function') {
      window.previewResource(cleanId);
      return;
    }

    // Fallback: search for resource
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.value = destination;
      if (typeof window.searchResources === 'function') {
        window.searchResources(destination);
      }
      searchInput.scrollIntoView({ behavior: 'smooth' });
    }
  };

  /* ============================================================
     2. Local Read Cache Helper
     ============================================================ */
  function getLocallyReadIds() {
    try {
      const raw = localStorage.getItem(STORAGE_READ_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  function markIdsLocallyRead(ids) {
    try {
      const current = getLocallyReadIds();
      ids.forEach((id) => current.add(String(id)));
      localStorage.setItem(STORAGE_READ_KEY, JSON.stringify(Array.from(current)));
    } catch (e) {
      /* ignore */
    }
  }

  /* ============================================================
     3. Relative Time Formatter
     ============================================================ */
  function formatRelativeTime(dateInput) {
    if (!dateInput) return 'Just now';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Just now';

    const now = new Date();
    const diffSeconds = Math.max(0, Math.floor((now - date) / 1000));

    if (diffSeconds < 60) return 'Just now';
    const diffMins = Math.floor(diffSeconds / 60);
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /* ============================================================
     4. Bell UI State & Animations
     ============================================================ */
  function updateBellState(forceAnimation = false) {
    const bellBtn = document.getElementById('heroNotifyBell');
    const badge = document.getElementById('heroBellBadge');
    if (!bellBtn) return;

    const locallyRead = getLocallyReadIds();
    unreadCount = notificationsList.filter(
      (n) => !n.is_read && !locallyRead.has(String(n.id))
    ).length;

    if (unreadCount > 0) {
      // If forcing animation (e.g. new realtime alert arrived), restart CSS shake
      if (forceAnimation) {
        bellBtn.classList.remove('has-unread');
        void bellBtn.offsetWidth; // Force DOM reflow to restart CSS keyframe animation
      }
      // Unread state: Red dot visible + smooth shaking animation
      bellBtn.classList.add('has-unread');
      if (badge) {
        badge.hidden = false;
        badge.setAttribute('aria-label', `${unreadCount} unread notifications`);
      }
      bellBtn.setAttribute('title', `${unreadCount} unread notifications`);
    } else {
      // Read state: Red dot disappears + shaking animation stops completely
      bellBtn.classList.remove('has-unread');
      if (badge) {
        badge.hidden = true;
      }
      bellBtn.setAttribute('title', 'Notifications (All caught up)');
    }

    // Update BottomSheet header badge if open
    if (bottomSheetInstance && bottomSheetInstance.titleEl) {
      bottomSheetInstance.titleEl.innerHTML = `Notifications ${
        unreadCount > 0 ? `<span class="notif-header-badge">${unreadCount} new</span>` : ''
      }`;
    }
  }

  /* ============================================================
     5. Type Icon Resolver
     ============================================================ */
  function getNotificationIcon(type) {
    const normalized = String(type || '').toLowerCase();
    if (normalized === 'pyq') {
      return '<i class="fa-solid fa-graduation-cap"></i>';
    }
    if (normalized === 'request' || normalized === 'senior') {
      return '<i class="fa-solid fa-users"></i>';
    }
    if (normalized === 'system' || normalized === 'announcement') {
      return '<i class="fa-solid fa-bullhorn"></i>';
    }
    return '<i class="fa-solid fa-file-lines"></i>';
  }

  /* ============================================================
     6. Render Drawer Content inside BottomSheet
     ============================================================ */
  function renderDrawerContent() {
    if (!bottomSheetInstance) return;

    // Update BottomSheet header title with unread badge (NO duplicate title inside drawer)
    if (bottomSheetInstance.titleEl) {
      bottomSheetInstance.titleEl.innerHTML = `Notifications ${
        unreadCount > 0 ? `<span class="notif-header-badge">${unreadCount} new</span>` : ''
      }`;
    }

    const wrap = document.createElement('div');
    wrap.className = 'notif-drawer-wrap';

    // Sub-bar inside drawer: Status label + "Mark all as read" button
    const subbar = document.createElement('div');
    subbar.className = 'notif-subbar';

    const statusLabel = document.createElement('span');
    statusLabel.className = 'notif-subbar-label';
    statusLabel.textContent =
      unreadCount > 0
        ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}`
        : 'Recent updates';
    subbar.appendChild(statusLabel);

    const markAllBtn = document.createElement('button');
    markAllBtn.type = 'button';
    markAllBtn.className = 'notif-mark-all-btn';
    markAllBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Mark all as read';
    if (unreadCount === 0) {
      markAllBtn.disabled = true;
    } else {
      markAllBtn.addEventListener('click', () => markAllNotificationsAsRead());
      if (window.BCA_UI && window.BCA_UI.PressableScale) {
        window.BCA_UI.PressableScale(markAllBtn);
      }
    }
    subbar.appendChild(markAllBtn);
    wrap.appendChild(subbar);

    // Body
    if (isFetching && notificationsList.length === 0) {
      // Shimmer Skeletons (Rule 4: No Spinners)
      const skelList = document.createElement('div');
      skelList.className = 'notif-list';
      for (let i = 0; i < 3; i++) {
        const skelCard = document.createElement('div');
        skelCard.className = 'notif-item';
        skelCard.style.gap = '12px';

        const skelIcon = (window.BCA_UI && window.BCA_UI.Skeleton)
          ? window.BCA_UI.Skeleton({ width: '42px', height: '42px', radius: 'md' })
          : document.createElement('div');
        skelIcon.className = 'bca-skeleton';
        skelIcon.style.width = '42px';
        skelIcon.style.height = '42px';

        const skelText = document.createElement('div');
        skelText.style.flex = '1';
        skelText.style.display = 'flex';
        skelText.style.flexDirection = 'column';
        skelText.style.gap = '8px';

        const line1 = document.createElement('div');
        line1.className = 'bca-skeleton';
        line1.style.width = '70%';
        line1.style.height = '14px';

        const line2 = document.createElement('div');
        line2.className = 'bca-skeleton';
        line2.style.width = '90%';
        line2.style.height = '12px';

        skelText.appendChild(line1);
        skelText.appendChild(line2);
        skelCard.appendChild(skelIcon);
        skelCard.appendChild(skelText);
        skelList.appendChild(skelCard);
      }
      wrap.appendChild(skelList);
      bottomSheetInstance.setContent(wrap);
      return;
    }

    if (notificationsList.length === 0) {
      // EmptyState component (Rule 5)
      let emptyEl;
      if (window.BCA_UI && window.BCA_UI.EmptyState) {
        emptyEl = window.BCA_UI.EmptyState({
          icon: '<i class="fa-regular fa-bell-slash" style="font-size:26px"></i>',
          title: 'No notifications yet',
          message: "You're all caught up! New notes, PYQs, and study requests will appear here in real time.",
          action: {
            label: 'Explore semester notes',
            onClick: () => {
              bottomSheetInstance.close();
              const finder = document.getElementById('finderSection') || document.getElementById('search');
              if (finder) finder.scrollIntoView({ behavior: 'smooth' });
            }
          }
        });
      } else {
        emptyEl = document.createElement('div');
        emptyEl.className = 'bca-empty-state';
        emptyEl.innerHTML = `
          <div class="bca-empty-state-icon-wrap"><i class="fa-regular fa-bell-slash"></i></div>
          <h4 class="bca-empty-state-title">No notifications yet</h4>
          <p class="bca-empty-state-message">You're all caught up! New notes, PYQs, and study requests will appear here.</p>
        `;
      }
      wrap.appendChild(emptyEl);
      bottomSheetInstance.setContent(wrap);
      return;
    }

    // Populated list
    const listEl = document.createElement('div');
    listEl.className = 'notif-list';
    const locallyRead = getLocallyReadIds();

    notificationsList.forEach((notif) => {
      const isUnread = !notif.is_read && !locallyRead.has(String(notif.id));
      const itemCard = document.createElement('div');
      itemCard.className = `notif-item ${isUnread ? 'is-unread' : ''}`;
      itemCard.setAttribute('role', 'button');
      itemCard.setAttribute('tabindex', '0');
      itemCard.setAttribute('aria-label', notif.title);

      // Icon wrap with unread red dot
      const iconWrap = document.createElement('div');
      iconWrap.className = 'notif-icon-wrap';
      iconWrap.innerHTML = getNotificationIcon(notif.type);
      if (isUnread) {
        const dot = document.createElement('span');
        dot.className = 'notif-unread-dot';
        iconWrap.appendChild(dot);
      }
      itemCard.appendChild(iconWrap);

      // Body: Title + message + relative timestamp
      const body = document.createElement('div');
      body.className = 'notif-item-body';

      const topRow = document.createElement('div');
      topRow.className = 'notif-item-top';

      const titleEl = document.createElement('strong');
      titleEl.className = 'notif-item-title';
      titleEl.textContent = notif.title;
      topRow.appendChild(titleEl);

      const timeEl = document.createElement('span');
      timeEl.className = 'notif-item-time';
      timeEl.textContent = formatRelativeTime(notif.created_at);
      topRow.appendChild(timeEl);

      body.appendChild(topRow);

      const msgEl = document.createElement('p');
      msgEl.className = 'notif-item-msg';
      msgEl.textContent = notif.message;
      body.appendChild(msgEl);

      itemCard.appendChild(body);

      // Click handler: Mark as read + router.push
      itemCard.addEventListener('click', () => {
        handleNotificationClick(notif);
      });
      itemCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNotificationClick(notif);
        }
      });

      // PressableScale (Rule 2)
      if (window.BCA_UI && window.BCA_UI.PressableScale) {
        window.BCA_UI.PressableScale(itemCard);
      }

      listEl.appendChild(itemCard);
    });

    wrap.appendChild(listEl);
    bottomSheetInstance.setContent(wrap);
  }

  /* ============================================================
     7. Open / Close BottomSheet Drawer
     ============================================================ */
  function openNotificationDrawer() {
    if (!bottomSheetInstance) {
      if (window.BCA_UI && window.BCA_UI.BottomSheet) {
        bottomSheetInstance = new window.BCA_UI.BottomSheet({
          title: 'Notifications',
          content: '',
          showCloseButton: true,
          dismissOnBackdrop: true,
          dismissOnSwipe: true,
          onOpen: () => {
            renderDrawerContent();
          }
        });
        if (bottomSheetInstance.sheetEl) {
          bottomSheetInstance.sheetEl.classList.add('bca-notif-sheet');
        }
        if (bottomSheetInstance.backdropEl) {
          bottomSheetInstance.backdropEl.classList.add('bca-notif-backdrop');
        }
      } else {
        console.warn('[Notifications] BottomSheet component not loaded yet.');
        return;
      }
    }

    renderDrawerContent();
    bottomSheetInstance.open();
  }

  /* ============================================================
     8. Handle Single Notification Click
     ============================================================ */
  async function handleNotificationClick(notif) {
    if (!notif) return;

    // 1. Mark as read locally and update bell state immediately
    notif.is_read = true;
    markIdsLocallyRead([notif.id]);
    updateBellState();

    // 2. Mark as read in Supabase
    if (typeof supabaseClient !== 'undefined' && supabaseClient && notif.id) {
      try {
        await supabaseClient
          .from(NOTIFICATIONS_TABLE)
          .update({ is_read: true })
          .eq('id', notif.id);
      } catch (err) {
        console.warn('[Notifications] Could not update read state on Supabase:', err);
      }
    }

    // 3. Close the drawer
    if (bottomSheetInstance && bottomSheetInstance.isOpen) {
      bottomSheetInstance.close();
    }

    // 4. Instantly redirect via window.router.push
    const target = notif.target_resource || notif.target_url || notif.title;
    window.router.push(target);
  }

  /* ============================================================
     9. Mark All Notifications as Read
     ============================================================ */
  async function markAllNotificationsAsRead() {
    const unreadIds = notificationsList
      .filter((n) => !n.is_read)
      .map((n) => n.id);

    // Update in-memory state
    notificationsList.forEach((n) => {
      n.is_read = true;
    });

    markIdsLocallyRead(unreadIds);
    updateBellState();
    renderDrawerContent();

    // Trigger haptic
    if (window.BCA_UI && window.BCA_UI.triggerLightHaptic) {
      window.BCA_UI.triggerLightHaptic();
    }

    // Toast confirmation (Rule 6)
    if (window.BCA_UI && window.BCA_UI.Toast) {
      window.BCA_UI.Toast.show({
        message: 'All notifications marked as read',
        variant: 'success'
      });
    } else if (typeof window.showToast === 'function') {
      window.showToast('All caught up', 'All notifications marked as read', 'success');
    }

    // Update in Supabase
    if (typeof supabaseClient !== 'undefined' && supabaseClient && unreadIds.length > 0) {
      try {
        await supabaseClient
          .from(NOTIFICATIONS_TABLE)
          .update({ is_read: true })
          .in('id', unreadIds);
      } catch (err) {
        console.warn('[Notifications] Could not mark all read in Supabase:', err);
      }
    }
  }

  /* ============================================================
     10. Fetch Notifications from Supabase
     ============================================================ */
  async function fetchNotifications() {
    isFetching = true;
    if (bottomSheetInstance && bottomSheetInstance.isOpen) {
      renderDrawerContent();
    }

    let fetchedData = null;

    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      try {
        const uid =
          typeof window.__bcaSessionUid === 'function' ? window.__bcaSessionUid() : '';

        let query = supabaseClient
          .from(NOTIFICATIONS_TABLE)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30);

        if (uid) {
          query = query.or(`user_id.is.null,user_id.eq.${uid}`);
        } else {
          query = query.or('user_id.is.null,user_id.eq.');
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          fetchedData = data;
        }
      } catch (e) {
        console.warn('[Notifications] Supabase fetch fallback:', e);
      }
    }

    // Fallback if table is empty or fresh
    if (!fetchedData || fetchedData.length === 0) {
      const localSeed = [
        {
          id: 'seed-pyq-1',
          title: 'Semester PYQs Updated',
          message: 'Previous Year Question papers are now available for all semesters.',
          type: 'pyq',
          target_resource: 'PYQs',
          target_url: '#finderSection',
          is_read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString()
        },
        {
          id: 'seed-notes-2',
          title: 'New Study Material',
          message: 'Explore handwritten notes and exam blue-prints on your study desk.',
          type: 'note',
          target_resource: 'Make this semester count',
          target_url: '#top',
          is_read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
        }
      ];
      fetchedData = localSeed;
    }

    notificationsList = fetchedData;
    isFetching = false;
    updateBellState();

    if (bottomSheetInstance && bottomSheetInstance.isOpen) {
      renderDrawerContent();
    }
  }

  /* ============================================================
     11. Real-time Incoming Notification Handler & Subscriptions
     ============================================================ */
  function handleIncomingNotification(newNotif) {
    if (!newNotif || !newNotif.title) return;

    // Deduplication check: Avoid adding exact same notification twice
    const exists = notificationsList.some(
      (n) =>
        (newNotif.id && String(n.id) === String(newNotif.id)) ||
        (n.title === newNotif.title && n.message === newNotif.message && Math.abs(new Date(n.created_at || 0) - new Date(newNotif.created_at || 0)) < 8000)
    );
    if (exists) return;

    // Targeting check: User UID (broadcast if empty/null)
    const currentUid =
      typeof window.__bcaSessionUid === 'function' ? window.__bcaSessionUid() : '';
    if (newNotif.user_id && String(newNotif.user_id).trim() !== '') {
      if (!currentUid || String(newNotif.user_id).trim() !== currentUid) {
        return; // targeted to another user
      }
    }

    // Targeting check: College & Semester
    const userCollege = (typeof localStorage !== 'undefined' && localStorage.getItem('bca-college')) || 'all';
    const userSem = (typeof localStorage !== 'undefined' && (localStorage.getItem('bca-profile-sem') || localStorage.getItem('bca-sem'))) || null;

    if (newNotif.college && newNotif.college !== 'all' && userCollege !== 'all' && newNotif.college !== userCollege) {
      return; // different college
    }
    if (newNotif.semester != null && userSem != null && Number(newNotif.semester) !== Number(userSem)) {
      return; // different semester
    }

    console.info('[Notifications] Real-time alert received instantly:', newNotif);

    // Ensure initial unread state
    newNotif.is_read = false;
    newNotif.created_at = newNotif.created_at || new Date().toISOString();
    newNotif.id = newNotif.id || `live-${Date.now()}`;

    // Prepend new alert to top of list
    notificationsList = [newNotif, ...notificationsList.filter((n) => n.id !== newNotif.id)];

    // Instantly trigger UI updates: Shake bell + show red dot
    updateBellState(true);

    // Light haptic feedback (Rule 2)
    if (window.BCA_UI && window.BCA_UI.triggerLightHaptic) {
      window.BCA_UI.triggerLightHaptic(25);
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }

    // Prompt immediate Toast notification on screen (Rule 6)
    if (window.BCA_UI && window.BCA_UI.Toast) {
      const summary = newNotif.message.length > 55 ? newNotif.message.slice(0, 55) + '…' : newNotif.message;
      window.BCA_UI.Toast.show({
        message: `🔔 ${newNotif.title}: ${summary}`,
        variant: 'info'
      });
    }

    // If drawer is currently open, re-render immediately
    if (bottomSheetInstance && bottomSheetInstance.isOpen) {
      renderDrawerContent();
    }
  }

  function setupRealtimeSubscription() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return;

    try {
      if (realtimeChannel) {
        try { supabaseClient.removeChannel(realtimeChannel); } catch (e) {}
      }

      // Listen on channel for BOTH postgres_changes (DB Insert) AND broadcast (Fast-path Admin Send)
      realtimeChannel = supabaseClient
        .channel('bca-notifications-live')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: NOTIFICATIONS_TABLE
          },
          (payload) => {
            handleIncomingNotification(payload.new);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: NOTIFICATIONS_TABLE
          },
          (payload) => {
            const updated = payload.new;
            if (!updated) return;
            const idx = notificationsList.findIndex((n) => n.id === updated.id);
            if (idx !== -1) {
              notificationsList[idx] = updated;
              updateBellState();
              if (bottomSheetInstance && bottomSheetInstance.isOpen) {
                renderDrawerContent();
              }
            }
          }
        )
        .on(
          'broadcast',
          { event: 'admin-notification' },
          (payload) => {
            handleIncomingNotification(payload.payload || payload);
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.info('[Notifications] Subscribed to real-time notification alerts ✔');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[Notifications] Realtime channel status:', status, err);
            // Reconnect after brief backoff
            setTimeout(setupRealtimeSubscription, 3000);
          }
        });
    } catch (err) {
      console.warn('[Notifications] Failed to setup real-time subscription:', err);
    }
  }

  // Auto-reconnect & re-sync when student switches back to the tab or reconnects online
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      fetchNotifications();
      setupRealtimeSubscription();
    });
  }

  /* ============================================================
     12. Initialization
     ============================================================ */
  function initNotificationBell() {
    const bellBtn = document.getElementById('heroNotifyBell');
    if (!bellBtn) {
      console.warn('[Notifications] Element #heroNotifyBell not found.');
      return;
    }

    // Attach PressableScale (Rule 2: Every Tappable Element Must Use PressableScale)
    if (window.BCA_UI && window.BCA_UI.PressableScale) {
      window.BCA_UI.PressableScale(bellBtn);
    }

    // Attach click listener to open drawer
    bellBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openNotificationDrawer();
    });

    // Initial fetch & realtime setup
    fetchNotifications();
    setupRealtimeSubscription();
  }

  // Bootstrapping
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotificationBell);
  } else {
    // Small timeout to ensure BCA_UI module is registered
    setTimeout(initNotificationBell, 50);
  }

  // Export helpers for external callers (e.g. upload or ask-senior triggers)
  window.bcaNotifications = {
    fetch: fetchNotifications,
    open: openNotificationDrawer,
    markAllRead: markAllNotificationsAsRead,
    refreshState: updateBellState
  };
})();

