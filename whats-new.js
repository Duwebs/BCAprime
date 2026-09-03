/* ============================================================
   BCAPrime — What's New (Update Modal)
   ------------------------------------------------------------
   RELEASE PROCESS (har major update par):
   1. CURRENT_APP_VERSION ka version number badhao (e.g. "2.5.0").
   2. LATEST_RELEASE me naye features / improvements / fixes
      likho — yahi modal me returning users ko dikhega.
   3. Bas. Logic khud handle karega:
      - First-time user  → modal NAHI dikhta (silent save)
      - Returning user  → modal ek baar dikhta hai
      - Up-to-date user → kuch nahi hota
   ============================================================ */

const CURRENT_APP_VERSION = "2.9.0";

const LATEST_RELEASE = {
  version: "2.9.0",
  date: "September 2026",
  title: "A Cleaner, Clearer Experience",
  subtitle: "Every message is now in polished English — plus a signup safety fix.",
  features: [
    { type: "improved", title: "Fully Professional English UI", desc: "All toasts, alerts, and notifications across the app — including QR login, uploads, and senior help — now use clear, professional English." },
    { type: "improved", title: "Clearer Push Notifications", desc: "Notifications for senior requests and fulfilled material have been rewritten in friendly, easy-to-read English." },
    { type: "fix",     title: "Duplicate Usernames Blocked", desc: "Usernames are now checked when you sign up, so two students can no longer claim the same one." }
  ]
};

(function () {
  const KEY = 'bcaprime_last_version';
  let didCheck = false;

  function getVersion() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function saveVersion() {
    try { localStorage.setItem(KEY, CURRENT_APP_VERSION); } catch (e) {}
  }

  /* Modal markup inject karo (ek hi baar) */
  function buildModal() {
    if (document.getElementById('whatsNewModal')) return;
    const icons = {
      new:     { icon: 'fa-wand-magic-sparkles', cls: 'wn-new' },
      improved:{ icon: 'fa-arrow-trend-up',      cls: 'wn-improved' },
      fix:     { icon: 'fa-wrench',              cls: 'wn-fix' }
    };
    const items = (LATEST_RELEASE.features || []).map(function (f) {
      const meta = icons[f.type] || icons.new;
      return '<div class="wn-item">' +
        '<span class="wn-item-icon ' + meta.cls + '"><i class="fa-solid ' + meta.icon + '"></i></span>' +
        '<div class="wn-item-copy"><strong>' + f.title + '</strong><span>' + f.desc + '</span></div>' +
        '</div>';
    }).join('');

    /* Personalized greeting: login name → email part → guest */
    let who = 'there';
    try {
      const cached = JSON.parse(localStorage.getItem('bca-profile-cache') || 'null');
      const n = cached && (cached.name || '').trim();
      const e = cached && (cached.email || '').split('@')[0].trim();
      who = n || e || 'there';
    } catch (err) {}
    const greeting = 'Hi ' + who + ' \uD83D\uDC4B';
    const subtitle = who === 'there' ? 'We\'ve got something new for you' : 'We\'ve got an update for you';

    const overlay = document.createElement('div');
    overlay.className = 'modal wn-modal';
    overlay.id = 'whatsNewModal';
    overlay.innerHTML =
      '<div class="dialog wn-dialog">' +
        '<div class="wn-hero">' +
          '<span class="wn-orb wn-orb1"></span><span class="wn-orb wn-orb2"></span>' +
          '<img class="wn-logo" src="assets/logo.png" alt="">' +
          '<h2 class="wn-greet">' + greeting + '</h2>' +
          '<p class="wn-subtitle">' + subtitle + '</p>' +
          '<span class="wn-pill"><i class="fa-solid fa-gift"></i> What\'s New<span class="wn-pill-sep"></span>v' + LATEST_RELEASE.version + '</span>' +
        '</div>' +
        '<div class="wn-list">' + items + '</div>' +
        '<div class="wn-foot">' +
          '<button class="primary wn-gotit" onclick="closeWhatsNew()"><i class="fa-solid fa-check"></i> Got it</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
  }

  function showWhatsNewModal() {
    buildModal();
    const overlay = document.getElementById('whatsNewModal');
    if (!overlay) return;
    overlay.classList.add('open');
  }

  /* Global: Got it / overlay click / ESC — sabse version save hota hai */
  window.closeWhatsNew = function () {
    const overlay = document.getElementById('whatsNewModal');
    if (overlay) overlay.classList.remove('open');
    saveVersion();
  };

  /* Overlay click se close (app ke generic modal pattern jaisa) */
  document.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('wn-modal')) window.closeWhatsNew();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.getElementById('whatsNewModal') &&
        document.getElementById('whatsNewModal').classList.contains('open')) window.closeWhatsNew();
  });

  /* Preview/debug: window.showWhatsNewModal() console se bhi chalega */
  window.showWhatsNewModal = showWhatsNewModal;

  /* Preview mode: ?whatsnew=1 — script load hote hi modal force dikhega (testing / release preview) */
  try {
    if (location.search.indexOf('whatsnew') !== -1) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showWhatsNewModal);
      } else {
        showWhatsNewModal();
      }
    }
  } catch (e) {}

  /* Footer me live version dikhao (CURRENT_APP_VERSION se auto-sync) */
  try {
    const applyVersionLabel = function () {
      const el = document.getElementById('appVersion');
      if (el) el.textContent = 'Version ' + CURRENT_APP_VERSION;
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyVersionLabel);
    else applyVersionLabel();
  } catch (e) {}

  /* Reliability fallback: auth flow se call miss ho jaye toh bhi check hoga */
  try {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () { window.checkWhatsNew(); }, 1600);
    });
  } catch (e) {}

  /* ===== Version check — teen cases ===== */
  window.checkWhatsNew = function () {
    if (didCheck) return;
    didCheck = true;
    const last = getVersion();
    if (last === null) {          /* CASE 1: First-time user — silent save, no modal */
      saveVersion();
      return;
    }
    if (last !== CURRENT_APP_VERSION) {  /* CASE 2: Returning user after update */
      showWhatsNewModal();
      return;                     /* version close par save hoga */
    }
    /* CASE 3: Up to date — kuch nahi */
  };
})();
