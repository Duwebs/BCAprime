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

const CURRENT_APP_VERSION = "2.6.0";

const LATEST_RELEASE = {
  version: "2.6.0",
  date: "September 2026",
  title: "Meet the new What's New Experience",
  subtitle: "Release updates now arrive in style — and you'll always know which version you're running.",
  features: [
    { type: "new",     title: "What's New Updates", desc: "Every major update now greets you with a beautiful changelog — you'll never miss what's new." },
    { type: "new",     title: "Version at a Glance", desc: "Check exactly which version of BCAPrime you're running, right from the footer." },
    { type: "improved",title: "Cleaner Footer", desc: "A refined footer layout with subtle version tagging for a more professional feel." }
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

    const overlay = document.createElement('div');
    overlay.className = 'modal wn-modal';
    overlay.id = 'whatsNewModal';
    overlay.innerHTML =
      '<div class="dialog wn-dialog">' +
        '<div class="wn-hero">' +
          '<span class="wn-orb wn-orb1"></span><span class="wn-orb wn-orb2"></span>' +
          '<i class="fa-solid fa-wand-magic-sparkles wn-spark wn-spark1"></i>' +
          '<i class="fa-solid fa-star wn-spark wn-spark2"></i>' +
          '<i class="fa-solid fa-star wn-spark wn-spark3"></i>' +
          '<img class="wn-logo" src="assets/logo.png" alt="">' +
          '<span class="wn-badge"><i class="fa-solid fa-gift"></i> What\'s New</span>' +
          '<span class="wn-meta"><span class="wn-version">v' + LATEST_RELEASE.version + '</span></span>' +
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
