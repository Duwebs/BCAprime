/* ============================================================
   BCAPrime — push-subscribe.js
   Web Push subscriptions + premium in-app notification UI
   ============================================================ */

(function () {
  'use strict';

  const SUBS_TABLE = 'push_subscriptions';
  const PREF_KEY = 'bca-notify-choice'; // 'on' | 'off' | null

  const support = {
    sw: 'serviceWorker' in navigator,
    push: 'PushManager' in window,
    permission: 'Notification' in window
  };
  const supported = support.sw && support.push && support.permission && typeof supabaseClient !== 'undefined' && !!supabaseClient;

  /* ---------- Small helpers ---------- */
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
    return output;
  }

  async function getRegistration() {
    if (!support.sw) return null;
    return (await navigator.serviceWorker.getRegistration()) || navigator.serviceWorker.register('./sw.js?v=21');
  }

  /* ---------- Supabase subscription storage ---------- */
  // User ki enrolled college + semester subscribe time par save hota hai taaki
  // notifications sirf same college + semester ke users ko targeting kar sakein.
  function enrolledCollege() {
    try { return localStorage.getItem('bca-college') || 'all'; } catch (e) { return 'all'; }
  }
  function enrolledSemester() {
    try {
      var v = localStorage.getItem('bca-sem');
      var n = Number(v);
      return (v && v !== 'all' && n >= 1 && n <= 6) ? n : null;
    } catch (e) { return null; }
  }
  // Account (Firebase uid) bhi save karo, taaki naye-device approval wali
  // notification sirf is user ke devices ko targeting kar sake.
  function enrolledUid() {
    try {
      if (window.__bcaSessionUid) return window.__bcaSessionUid() || null;
      return null;
    } catch (e) { return null; }
  }
  async function saveSubscription(subscription) {
    const json = subscription.toJSON();
    const payload = {
      endpoint: json.endpoint,
      p256dh: json.keys ? json.keys.p256dh : null,
      auth: json.keys ? json.keys.auth : null,
      user_agent: navigator.userAgent,
      college: enrolledCollege(),
      semester: enrolledSemester(),
      uid: enrolledUid()
    };
    const { error } = await supabaseClient.from(SUBS_TABLE).upsert(payload, { onConflict: 'endpoint' });
    if (error) console.warn('Could not save push subscription.', error.message);
  }

  async function removeSubscription(subscription) {
    if (!subscription) return;
    try {
      await supabaseClient.from(SUBS_TABLE).delete().eq('endpoint', subscription.endpoint);
    } catch (error) { /* ignore */ }
    try { await subscription.unsubscribe(); } catch (error) { /* ignore */ }
  }

  /* ---------- Core enable / disable ---------- */
  async function enableNotifications() {
    if (!supported) { showToast('Notifications', 'This browser does not support push notifications.', 'warn'); return false; }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('Notifications off', 'Allow notifications from your browser settings to get alerts.', 'warn');
      return false;
    }
    const registration = await getRegistration();
    if (!registration) return false;
    try {
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      await saveSubscription(subscription);
      localStorage.setItem(PREF_KEY, 'on');
      updateBell(true);
      showToast('Notifications on 🔔', 'You will now get alerts for new notes, PYQs & notices.', 'success');
      return true;
    } catch (error) {
      console.warn('Push subscription failed.', error);
      showToast('Setup failed', error.message, 'error');
      return false;
    }
  }

  /* ---------- STRICT-ON notification mode ----------
     - Notification ON hote hi bell HIDE ho jaata hai (galti se off karne ka
       raasta hi nahi bachta)
     - Agar permission/subscription kabhi kho jaye (browser update, settings
       change, server row clear) -> auto re-subscribe / re-prompt
     - "Later" sirf current session ke liye dismiss hai — agli visit par
       banner wapas aata hai jab tak notifications ON nahi hoti */

  async function disableNotifications() {
    /* Kept as a no-op: users can no longer turn notifications off from the UI. */
    showToast('Notifications stay on 🔔', 'BCAPrime alerts are always on so you never miss new notes.', 'info');
  }

  /* Core: notifications ko pakka ON state mein pahunchao (silent re-enforce) */
  async function ensureNotificationsEnabled(interactive) {
    if (!supported) { updateBell(false); return false; }
    if (Notification.permission === 'denied') {
      updateBell(false);
      if (interactive) showEnableBanner(true);
      return false;
    }
    if (Notification.permission !== 'granted') {
      updateBell(false);
      if (interactive) showEnableBanner(false);
      return false; /* permission ke liye user gesture chahiye — banner handle karega */
    }
    /* Permission granted hai — subscription ka pakka hona ensure karo */
    try {
      const registration = await getRegistration();
      if (!registration) return false;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }
      await saveSubscription(subscription);
      localStorage.setItem(PREF_KEY, 'on');
      updateBell(true);
      return true;
    } catch (error) {
      console.warn('Push ensure failed.', error);
      updateBell(false);
      return false;
    }
  }

  /* Called from the bell button in the topbar — sirf ON karne ke liye */
  window.toggleNotifications = async function (event) {
    if (event) event.preventDefault();
    if (Notification.permission === 'denied') {
      showEnableBanner(true);
      return;
    }
    await enableNotifications();
  };

  function updateBell(enabled) {
    const bell = document.getElementById('notifyBell');
    const icon = document.getElementById('bellIcon');
    if (!bell) return;
    /* ON hote hi bell gayab — mute option hi nahi dikhega */
    bell.hidden = !!enabled;
    if (icon) icon.className = enabled ? 'fa-solid fa-bell' : 'fa-regular fa-bell';
    if (!enabled) bell.title = 'Notifications are OFF — tap to enable';
  }

  async function initBellState() {
    /* Agar permission granted hai par subscription/PREF gir gaya ho to silently
       repair ho jayega; warna bell OFF dikhkar enable ka rasta dega. */
    await ensureNotificationsEnabled(false);
  }

  /* ---------- Premium in-app toast + chime (app open hone par) ---------- */
  let audioCtx = null;

  function playChime() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      // Two-note "ding" — premium soft bell
      [[880, 0], [1174.66, 0.18]].forEach(([freq, offset]) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.22, now + offset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.9);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 1);
      });
    } catch (error) { /* autoplay blocked or no WebAudio — skip sound */ }
  }

  function showToast(title, body, tone) {
    let root = document.getElementById('pushToastRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'pushToastRoot';
      document.body.appendChild(root);
    }
    const icons = { success: 'fa-circle-check', info: 'fa-bell', warn: 'fa-triangle-exclamation', error: 'fa-circle-exclamation' };
    const card = document.createElement('div');
    card.className = 'push-toast tone-' + (tone || 'info');
    card.setAttribute('role', 'status');
    card.innerHTML =
      '<span class="push-toast-icon"><i class="fa-solid ' + (icons[tone] || icons.info) + '"></i></span>' +
      '<span class="push-toast-copy"><strong></strong><span></span></span>' +
      '<button class="push-toast-close" aria-label="Dismiss">&times;</button>';
    card.querySelector('strong').textContent = title;
    card.querySelectorAll('.push-toast-copy span')[0].textContent = body || '';
    const close = () => { card.classList.add('leaving'); setTimeout(() => card.remove(), 320); };
    card.querySelector('.push-toast-close').addEventListener('click', close);
    root.appendChild(card);
    requestAnimationFrame(() => card.classList.add('visible'));
    if (tone === 'success') playChime();
    setTimeout(close, 6000);
  }
  window.bcaShowPushToast = showToast;

  /* App band hone ke baad notification tap karke wapas aaye to welcome toast */
  if (support.sw) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data && event.data.type === 'push-clicked') {
        showToast('Welcome back!', 'You just opened this from a BCAPrime alert.', 'success');
      }
    });
  }

  /* ---------- Enable banner (har visit par, jab tak ON nahi hota) ---------- */
  function showEnableBanner(denied) {
    if (!supported) return;
    /* Already granted ho to banner ki zaroorat nahi — silently ensure karo */
    if (Notification.permission === 'granted') { ensureNotificationsEnabled(false); return; }
    /* "Later" sirf is session ke liye — agli visit par banner wapas */
    if (sessionStorage.getItem('bca-notify-dismissed') === '1') return;
    if (document.getElementById('notifyBanner')) return;

    const blocked = denied || Notification.permission === 'denied';
    const banner = document.createElement('aside');
    banner.className = 'notify-banner';
    banner.id = 'notifyBanner';
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML =
      '<span class="notify-banner-icon"><img src="assets/logo.png" alt="" width="36" height="36"><b class="pulse-dot"></b></span>' +
      '<span class="notify-banner-copy"><strong>' + (blocked ? 'Notifications are blocked' : 'Never miss an update') + '</strong>' +
      '<span>' + (blocked
        ? 'BCAPrime alerts stay ON. Enable them from your browser settings — tap the lock/info icon in the address bar &rarr; Notifications &rarr; Allow.'
        : 'Get instant alerts for new notes, PYQs &amp; important notices. Alerts stay on so you never miss out.') + '</span></span>' +
      '<span class="notify-banner-actions">' +
      (blocked
        ? '<button class="primary" id="notifyAllowBtn"><i class="fa-solid fa-shield-halved"></i> How to enable</button>'
        : '<button class="primary" id="notifyAllowBtn"><i class="fa-solid fa-bell"></i> Notify me</button>') +
      '<button class="notify-dismiss" id="notifyLaterBtn" aria-label="Dismiss">Later</button></span>';
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('visible'));
    banner.querySelector('#notifyAllowBtn').addEventListener('click', async () => {
      if (blocked) {
        /* Denied permission ko JS se re-request nahi kar sakte — settings guide do */
        banner.classList.add('leaving');
        setTimeout(() => banner.remove(), 320);
        showToast('Enable from browser', 'Address bar ka lock/info icon → Notifications → Allow karo', 'warn');
        return;
      }
      banner.remove();
      await enableNotifications();
    });
    banner.querySelector('#notifyLaterBtn').addEventListener('click', () => {
      try { sessionStorage.setItem('bca-notify-dismissed', '1'); } catch (e) { /* ignore */ }
      banner.classList.add('leaving');
      setTimeout(() => banner.remove(), 320);
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    initBellState();
    /* Har visit par banner (jab tak ON nahi hota) — thodi der baad taaki
       splash/onboarding pehle complete ho jaye */
    setTimeout(showEnableBanner, supported ? 12000 : 100000000);
    /* Re-enforce loop: tab focus / har 60s mein check karo ki subscription
       zinda hai. Permission granted hai par subscription gir gayi ho to
       silently re-subscribe ho jata hai — notifications kabhi off nahi rahengi. */
    setInterval(() => { if (document.visibilityState === 'visible') ensureNotificationsEnabled(false); }, 60000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') ensureNotificationsEnabled(false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

