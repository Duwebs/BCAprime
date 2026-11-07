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
  function updateBellState() {
    const bellBtn = document.getElementById('heroNotifyBell');
    const badge = document.getElementById('heroBellBadge');
    if (!bellBtn) return;

    const locallyRead = getLocallyReadIds();
    unreadCount = notificationsList.filter(
      (n) => !n.is_read && !locallyRead.has(String(n.id))
    ).length;

    if (unreadCount > 0) {
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

    const wrap = document.createElement('div');
    wrap.className = 'notif-drawer-wrap';

    // Header inside drawer
    const header = document.createElement('div');
    header.className = 'notif-drawer-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'notif-header-left';

    const title = document.createElement('h4');
    title.className = 'notif-header-title';
    title.textContent = 'Notifications';
    headerLeft.appendChild(title);

    if (unreadCount > 0) {
      const countPill = document.createElement('span');
      countPill.className = 'notif-unread-count-pill';
      countPill.textContent = `${unreadCount} new`;
      headerLeft.appendChild(countPill);
    }
    header.appendChild(headerLeft);

    // "Mark all as read" button
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
    header.appendChild(markAllBtn);
    wrap.appendChild(header);

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
          ? window.BCA_UI.Skeleton({ width: '36px', height: '36px', radius: 'md' })
          : document.createElement('div');
        skelIcon.className = 'bca-skeleton';
        skelIcon.style.width = '36px';
        skelIcon.style.height = '36px';

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
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = `notif-item ${isUnread ? 'is-unread' : ''}`;
      itemBtn.setAttribute('role', 'button');
      itemBtn.setAttribute('aria-label', notif.title);

      // Icon wrap with unread red dot
      const iconWrap = document.createElement('div');
      iconWrap.className = 'notif-icon-wrap';
      iconWrap.innerHTML = getNotificationIcon(notif.type);
      if (isUnread) {
        const dot = document.createElement('span');
        dot.className = 'notif-unread-dot';
        iconWrap.appendChild(dot);
      }
      itemBtn.appendChild(iconWrap);

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

      itemBtn.appendChild(body);

      // Click handler: Mark as read + router.push
      itemBtn.addEventListener('click', () => {
        handleNotificationClick(notif);
      });

      // PressableScale (Rule 2)
      if (window.BCA_UI && window.BCA_UI.PressableScale) {
        window.BCA_UI.PressableScale(itemBtn);
      }

      listEl.appendChild(itemBtn);
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
     11. Real-time Subscription (.on('INSERT', ...))
     ============================================================ */
  function setupRealtimeSubscription() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return;

    try {
      if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
      }

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
            const newNotif = payload.new;
            if (!newNotif) return;

            // Check targeting: null (all users) or matching user's uid
            const currentUid =
              typeof window.__bcaSessionUid === 'function' ? window.__bcaSessionUid() : '';
            if (newNotif.user_id && currentUid && newNotif.user_id !== currentUid) {
              return; // Targeted to someone else
            }

            console.info('[Notifications] Real-time notification received:', newNotif);

            // Prepend new notification
            notificationsList = [newNotif, ...notificationsList.filter((n) => n.id !== newNotif.id)];
            updateBellState();

            // Light haptic feedback (Rule 2)
            if (window.BCA_UI && window.BCA_UI.triggerLightHaptic) {
              window.BCA_UI.triggerLightHaptic(15);
            }

            // If drawer is open, re-render immediately
            if (bottomSheetInstance && bottomSheetInstance.isOpen) {
              renderDrawerContent();
            }
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
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.info('[Notifications] Subscribed to real-time notification alerts ✔');
          }
        });
    } catch (err) {
      console.warn('[Notifications] Failed to setup real-time subscription:', err);
    }
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

