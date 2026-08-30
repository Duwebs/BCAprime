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

const CURRENT_APP_VERSION = "2.4.0";

const LATEST_RELEASE = {
  version: "2.4.0",
  date: "August 2026",
  title: "Major Upgrade: PDF Reader & Fast Telemetry",
  features: [
    { type: "new",     title: "In-App PDF Viewer", desc: "Read notes directly inside the app without opening extra browser tabs." },
    { type: "improved",title: "Faster Downloads",  desc: "Optimized server requests for instant notes download." },
    { type: "fix",     title: "UI Polish",         desc: "Fixed button responsiveness and dark mode alignment bugs." }
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
        '<div class="wn-head">' +
          '<span class="wn-badge"><i class="fa-solid fa-gift"></i> What\'s New</span>' +
          '<span class="wn-version">v' + LATEST_RELEASE.version + '</span>' +
          '<span class="wn-date">' + LATEST_RELEASE.date + '</span>' +
        '</div>' +
        '<h2 class="wn-title">' + LATEST_RELEASE.title + '</h2>' +
        '<div class="wn-list">' + items + '</div>' +
        '<button class="primary wn-gotit" onclick="closeWhatsNew()"><i class="fa-solid fa-check"></i> Got it</button>' +
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
