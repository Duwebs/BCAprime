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
    return (await navigator.serviceWorker.getRegistration()) || navigator.serviceWorker.register('./sw.js');
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

  async function disableNotifications() {
    const registration = await getRegistration();
    if (registration) await removeSubscription(await registration.pushManager.getSubscription());
    localStorage.setItem(PREF_KEY, 'off');
    updateBell(false);
    showToast('Notifications off', 'You can turn them back on anytime from the bell.', 'info');
  }

  /* Called from the bell button in the topbar */
  window.toggleNotifications = async function (event, button) {
    if (event) event.preventDefault();
    if (Notification.permission === 'granted') {
      const registration = await getRegistration();
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      if (subscription && localStorage.getItem(PREF_KEY) !== 'off') await disableNotifications();
      else await enableNotifications();
    } else {
      await enableNotifications();
    }
  };

  function updateBell(enabled) {
    const bell = document.getElementById('notifyBell');
    const icon = document.getElementById('bellIcon');
    if (!bell || !icon) return;
    bell.classList.toggle('is-on', !!enabled);
    icon.className = enabled ? 'fa-solid fa-bell' : 'fa-regular fa-bell';
    bell.title = enabled ? 'Notifications are ON — click to mute' : 'Notifications are OFF — click to enable';
  }

  async function initBellState() {
    if (!supported) { updateBell(false); return; }
    const registration = await getRegistration();
    const subscription = registration ? await registration.pushManager.getSubscription() : null;
    updateBell(!!(subscription && Notification.permission === 'granted' && localStorage.getItem(PREF_KEY) !== 'off'));
    // Re-save silently in case the row was cleared on the server
    if (subscription && Notification.permission === 'granted') saveSubscription(subscription);
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

  /* ---------- Soft enable banner (ek baar, dismissible) ---------- */
  function showEnableBanner() {
    if (!supported || Notification.permission !== 'default' || localStorage.getItem(PREF_KEY)) return;
    const banner = document.createElement('aside');
    banner.className = 'notify-banner';
    banner.id = 'notifyBanner';
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML =
      '<span class="notify-banner-icon"><img src="assets/logo.png" alt="" width="36" height="36"><b class="pulse-dot"></b></span>' +
      '<span class="notify-banner-copy"><strong>Never miss an update</strong>' +
      '<span>Get instant alerts for new notes, PYQs &amp; important notices.</span></span>' +
      '<span class="notify-banner-actions">' +
      '<button class="primary" id="notifyAllowBtn"><i class="fa-solid fa-bell"></i> Notify me</button>' +
      '<button class="notify-dismiss" id="notifyLaterBtn" aria-label="Dismiss">Later</button></span>';
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('visible'));
    banner.querySelector('#notifyAllowBtn').addEventListener('click', async () => {
      banner.remove();
      await enableNotifications();
    });
    banner.querySelector('#notifyLaterBtn').addEventListener('click', () => {
      localStorage.setItem(PREF_KEY, 'off');
      banner.classList.add('leaving');
      setTimeout(() => banner.remove(), 320);
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    initBellState();
    // Banner thodi der baad dikhao taaki splash/onboarding pehle complete ho jaye
    setTimeout(showEnableBanner, supported ? 12000 : 100000000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

