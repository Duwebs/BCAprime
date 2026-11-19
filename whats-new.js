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

const CURRENT_APP_VERSION = "3.3.0";

const LATEST_RELEASE = {
  version: "3.3.0",
  date: "November 2026",
  title: "What's new",
  subtitle: "BCAPrime just got better.",
  features: [
    { icon: "fa-qrcode", title: "QR Code Login", desc: "Scan on desktop with your phone camera or app to log in instantly." },
    { icon: "fa-wand-magic-sparkles", title: "Study Desk Sign Up", desc: "Streamlined single-screen account creation with mascot companion." },
    { icon: "fa-bolt", title: "Faster Social Login", desc: "Polished inline arc feedback for Google & LinkedIn with zero stuck states." }
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

    const versionText = LATEST_RELEASE.version ? 'v' + LATEST_RELEASE.version : 'v2.0';
    const titleText = LATEST_RELEASE.title || "What's new";
    const subtitleText = LATEST_RELEASE.subtitle || "BCAPrime just got better.";

    const items = (LATEST_RELEASE.features || []).map(function (f) {
      let iconClass = f.icon || 'fa-bolt';
      if (!iconClass.startsWith('fa-')) {
        if (f.type === 'ghost') iconClass = 'fa-ghost';
        else if (f.type === 'faster') iconClass = 'fa-bolt';
        else if (f.type === 'notes') iconClass = 'fa-comment-dots';
        else if (f.type === 'improved') iconClass = 'fa-bolt';
        else if (f.type === 'fix') iconClass = 'fa-wrench';
        else iconClass = 'fa-wand-magic-sparkles';
      }
      return (
        '<div class="wn-feat">' +
          '<span class="wn-feat-icon"><i class="fa-solid ' + iconClass + '"></i></span>' +
          '<div class="wn-feat-text">' +
            '<strong>' + f.title + '</strong>' +
            '<p>' + f.desc + '</p>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    const overlay = document.createElement('div');
    overlay.className = 'modal wn-modal';
    overlay.id = 'whatsNewModal';
    overlay.innerHTML =
      '<div class="dialog wn-dialog">' +
        '<div class="wn-backdrop">' +
          '<div class="wn-bg-bar" aria-hidden="true"></div>' +
          '<div class="wn-bg-box" aria-hidden="true"></div>' +
        '</div>' +
        '<div class="wn-content">' +
          '<span class="wn-badge">' + versionText + '</span>' +
          '<h2 class="wn-title">' + titleText + '</h2>' +
          '<p class="wn-subtitle">' + subtitleText + '</p>' +
          '<div class="wn-features">' + items + '</div>' +
          '<button type="button" class="wn-gotit bca-pressable" onclick="closeWhatsNew()">' +
            'Got it' +
          '</button>' +
        '</div>' +
        '<img src="assets/mascot-pointing.png" class="wn-mascot" alt="" aria-hidden="true">' +
      '</div>';
    document.body.appendChild(overlay);

    if (window.BCA_UI && window.BCA_UI.PressableScale) {
      const btn = overlay.querySelector('.wn-gotit');
      if (btn) new window.BCA_UI.PressableScale(btn);
    }
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
