/* ============================================================
   BCAPrime — Floating, Draggable Study Mascot "PrimeBuddy"
   (v3.1 — True 3D Volumetric Crown, 4-Wall Fling Physics & Compact Tap Menu)
   ============================================================ */

(function () {
  'use strict';

  const STORAGE_KEY_ENABLED = 'bcaprime_buddy_enabled';
  const STORAGE_KEY_INTRO_SEEN = 'bcaprime_buddy_intro_seen';
  const STORAGE_KEY_POS = 'bcaprime_buddy_pos';
  const STORAGE_KEY_ROAM = 'bcaprime_buddy_roam';

  // Sizing & Margin Constants (Scale to 66px for high visibility)
  const MASCOT_SIZE = 66;
  const EDGE_SNAP_THRESHOLD = 48;
  const SAFE_MARGIN_X = 10;
  const SAFE_MARGIN_TOP = 65;
  const SAFE_MARGIN_BOTTOM = 98; // Strictly clears bottom-24 navigation bar
  const IDLE_ROAM_DELAY = 8000;  // 8s idle before slow roam starts

  let mascotEl = null;
  let menuEl = null;
  let menuBackdropEl = null;
  let introModalEl = null;
  let speechBubbleEl = null;
  let tuckBtnEl = null;

  // GPU Coordinate Tracking (translate3d)
  let currentX = 0;
  let currentY = 0;
  let currentEdge = 'right'; // 'left' | 'right'

  // Drag & Fling Physics State
  let isDragging = false;
  let isFlinging = false;
  let flingRafId = null;
  let flingVelX = 0;
  let flingVelY = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let elemStartX = 0;
  let elemStartY = 0;
  let pointerHistory = []; // Rolling buffer of { x, y, time } for true release velocity

  // Mascot Mood & State
  let isTucked = false;
  let currentMood = 'normal'; // 'normal' | 'wave' | 'dizzy' | 'dragging'
  let bubbleTimeout = null;
  let dizzyRecoverTimer = null;
  let consecutiveFunTaps = 0;
  let funTapTimeout = null;

  // Autonomous Roaming State
  let autoRoamEnabled = localStorage.getItem(STORAGE_KEY_ROAM) !== 'false';
  let isRoaming = false;
  let idleTimer = null;
  let roamStepTimer = null;

  const BUDDY_QUOTES = [
    'Tap me for fun tricks! ✨',
    'Fling me to see ricochets! 🚀',
    'Ready for study time! 📚',
    'BCA Prime companion! 👑',
    'Let me roam around! 🚶',
    'Full speed ahead! ⚡'
  ];

  /* ------------------------------------------------------------
     True 3D Volumetric Rotating Crown HTML Generator (360°)
     - Circular 3D Base Ring / Rim with hollow interior depth
     - 5 Distinct 3D Points radially positioned at 0°, 72°, 144°, 216°, 288°
     - Glowing jewel tips & dynamic specular highlights
     ------------------------------------------------------------ */
  function get3DCrownMarkup() {
    return `
      <div class="buddy-crown-glow-pool"></div>
      <div class="buddy-crown-3d-rotator">
        <!-- Circular 3D Base Disc (Hollow Inner Wall & Floor) -->
        <div class="buddy-crown-base-disc"></div>
        <div class="buddy-crown-inner-rim"></div>

        <!-- 5 Distinct 3D Crown Points/Spikes (0°, 72°, 144°, 216°, 288°) -->
        <div class="buddy-crown-point" style="--spike-rot: 0deg;">
          <div class="buddy-point-triangle"></div>
          <span class="buddy-point-jewel jewel-1"></span>
        </div>
        <div class="buddy-crown-point" style="--spike-rot: 72deg;">
          <div class="buddy-point-triangle"></div>
          <span class="buddy-point-jewel jewel-2"></span>
        </div>
        <div class="buddy-crown-point" style="--spike-rot: 144deg;">
          <div class="buddy-point-triangle"></div>
          <span class="buddy-point-jewel jewel-3"></span>
        </div>
        <div class="buddy-crown-point" style="--spike-rot: 216deg;">
          <div class="buddy-point-triangle"></div>
          <span class="buddy-point-jewel jewel-4"></span>
        </div>
        <div class="buddy-crown-point" style="--spike-rot: 288deg;">
          <div class="buddy-point-triangle"></div>
          <span class="buddy-point-jewel jewel-5"></span>
        </div>

        <!-- 5 Base Rim Segments (Front & Back Golden Cylinder Wall) -->
        <div class="buddy-crown-rim-seg" style="--rim-rot: 0deg;"></div>
        <div class="buddy-crown-rim-seg" style="--rim-rot: 72deg;"></div>
        <div class="buddy-crown-rim-seg" style="--rim-rot: 144deg;"></div>
        <div class="buddy-crown-rim-seg" style="--rim-rot: 216deg;"></div>
        <div class="buddy-crown-rim-seg" style="--rim-rot: 288deg;"></div>
      </div>
    `;
  }

  /* Combined 3D Crown Stage + Expressive Mascot SVG Canvas */
  function renderMascotBody(mood = 'normal', edge = currentEdge) {
    return `
      <div class="buddy-crown-3d-stage">
        ${get3DCrownMarkup()}
      </div>
      ${getMascotSvg(mood, edge)}
    `;
  }

  /* ------------------------------------------------------------
     High-Craft Multi-Layered "Crowned B" Mascot SVG Generator
     ------------------------------------------------------------ */
  function getMascotSvg(mood = 'normal', edge = currentEdge) {
    const eyeDx = edge === 'right' ? -1.8 : (edge === 'left' ? 1.8 : 0);

    let crownSparkles = '';
    if (mood === 'dizzy') {
      // Orbiting head stars around the spinning crown
      crownSparkles = `
        <g class="buddy-orbiting-ring" transform-origin="31 8">
          <polygon points="31,-2 32.2,0.8 35,1.2 33,3 33.6,5.8 31,4.2 28.4,5.8 29,3 27,1.2 29.8,0.8" fill="#fbbf24"/>
          <polygon points="17,14 18.2,16.8 21,17.2 19,19 19.6,21.8 17,20.2 14.4,21.8 15,19 13,17.2 15.8,16.8" fill="#fef08a"/>
          <polygon points="45,14 46.2,16.8 49,17.2 47,19 47.6,21.8 45,20.2 42.4,21.8 43,19 41,17.2 43.8,16.8" fill="#38bdf8"/>
        </g>
      `;
    }

    let eyesSvg = '';
    let mouthSvg = '';

    if (mood === 'dizzy') {
      // Rapid Spinning Hypnosis Spiral Eyes (Clockwise & Counter-Clockwise)
      eyesSvg = `
        <!-- Left Eye Socket with 360° Spinning Hypnosis Spiral -->
        <g transform-origin="24 28">
          <ellipse cx="24" cy="28" rx="5.6" ry="6.4" fill="#ffffff" stroke="#1e1b4b" stroke-width="1.3"/>
          <g class="buddy-dizzy-spiral-l" transform-origin="24 28">
            <path d="M24,28 A1.5,1.5 0 0,1 25.5,28 A2.8,2.8 0 0,1 22.5,29.5 A4,4 0 0,1 21,26.5 A5.2,5.2 0 0,1 26,24.5" fill="none" stroke="#1e1b4b" stroke-width="2" stroke-linecap="round"/>
            <circle cx="24" cy="28" r="1.6" fill="#f43f5e"/>
          </g>
        </g>
        <!-- Right Eye Socket with 360° Spinning Hypnosis Spiral -->
        <g transform-origin="38 28">
          <ellipse cx="38" cy="28" rx="5.6" ry="6.4" fill="#ffffff" stroke="#1e1b4b" stroke-width="1.3"/>
          <g class="buddy-dizzy-spiral-r" transform-origin="38 28">
            <path d="M38,28 A1.5,1.5 0 0,1 39.5,28 A2.8,2.8 0 0,1 36.5,29.5 A4,4 0 0,1 35,26.5 A5.2,5.2 0 0,1 40,24.5" fill="none" stroke="#1e1b4b" stroke-width="2" stroke-linecap="round"/>
            <circle cx="38" cy="28" r="1.6" fill="#f43f5e"/>
          </g>
        </g>
      `;
      // Wobbly undulating dizzy mouth 😵
      mouthSvg = `<path d="M26,38 Q29,41 32,38 T38,38" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>`;
    } else if (mood === 'dragging') {
      // Playfully Lifted / Excited Eyes
      eyesSvg = `
        <g class="buddy-eye" transform-origin="24 28">
          <ellipse cx="24" cy="28" rx="5.2" ry="5.8" fill="#ffffff"/>
          <ellipse class="buddy-pupil" cx="${24 + eyeDx}" cy="28" rx="3.2" ry="3.4" fill="#0f172a"/>
          <ellipse class="buddy-pupil" cx="${24 + eyeDx}" cy="28" rx="2.2" ry="2" fill="#0284c7"/>
          <circle class="buddy-pupil" cx="${25.5 + eyeDx}" cy="26.5" r="1.5" fill="#ffffff"/>
          <circle class="buddy-pupil" cx="${23 + eyeDx}" cy="29.5" r="0.8" fill="#ffffff"/>
        </g>
        <g class="buddy-eye" transform-origin="38 28">
          <ellipse cx="38" cy="28" rx="5.2" ry="5.8" fill="#ffffff"/>
          <ellipse class="buddy-pupil" cx="${38 + eyeDx}" cy="28" rx="3.2" ry="3.4" fill="#0f172a"/>
          <ellipse class="buddy-pupil" cx="${38 + eyeDx}" cy="28" rx="2.2" ry="2" fill="#0284c7"/>
          <circle class="buddy-pupil" cx="${39.5 + eyeDx}" cy="26.5" r="1.5" fill="#ffffff"/>
          <circle class="buddy-pupil" cx="${37 + eyeDx}" cy="29.5" r="0.8" fill="#ffffff"/>
        </g>
      `;
      mouthSvg = `<path d="M27.5,35.5 Q31,41 34.5,35.5 Z" fill="#ffffff" stroke="#ffffff" stroke-width="0.8"/>`;
    } else {
      // Normal Happy Mascot Eyes (Direction-Aware)
      eyesSvg = `
        <g class="buddy-eye" transform-origin="24 28">
          <ellipse cx="24" cy="28" rx="4.8" ry="5.4" fill="#ffffff"/>
          <ellipse class="buddy-pupil" cx="${24 + eyeDx}" cy="28" rx="3" ry="3.2" fill="#0f172a"/>
          <ellipse class="buddy-pupil" cx="${24 + eyeDx}" cy="28.5" rx="2" ry="1.8" fill="#0284c7"/>
          <circle class="buddy-pupil" cx="${25.2 + eyeDx}" cy="26.8" r="1.3" fill="#ffffff"/>
          <circle class="buddy-pupil" cx="${23 + eyeDx}" cy="29.2" r="0.7" fill="#ffffff"/>
        </g>
        <g class="buddy-eye" transform-origin="38 28">
          <ellipse cx="38" cy="28" rx="4.8" ry="5.4" fill="#ffffff"/>
          <ellipse class="buddy-pupil" cx="${38 + eyeDx}" cy="28" rx="3" ry="3.2" fill="#0f172a"/>
          <ellipse class="buddy-pupil" cx="${38 + eyeDx}" cy="28.5" rx="2" ry="1.8" fill="#0284c7"/>
          <circle class="buddy-pupil" cx="${39.2 + eyeDx}" cy="26.8" r="1.3" fill="#ffffff"/>
          <circle class="buddy-pupil" cx="${37 + eyeDx}" cy="29.2" r="0.7" fill="#ffffff"/>
        </g>
      `;
      mouthSvg = `<path d="M28,35 Q31,39 34,35" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>`;
    }

    return `
      <svg class="prime-buddy-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="buddyBodyGrad" x1="14" y1="14" x2="52" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="28%" stop-color="#2563eb"/>
            <stop offset="72%" stop-color="#1d4ed8"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
          <radialGradient id="buddy3DGlow" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stop-color="#93c5fd" stop-opacity="0.8"/>
            <stop offset="50%" stop-color="#3b82f6" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="buddyHandGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="100%" stop-color="#1d4ed8"/>
          </linearGradient>
          <radialGradient id="buddyFloorShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(0,0,0,0.35)"/>
            <stop offset="60%" stop-color="rgba(0,0,0,0.14)"/>
            <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
          </radialGradient>
        </defs>

        <!-- Ambient Floor Drop Shadow -->
        <ellipse cx="32" cy="59" rx="16" ry="3.2" fill="url(#buddyFloorShadow)" class="buddy-shadow-ellipse"/>

        <!-- Character Group with Floating & Idle Animations -->
        <g class="buddy-char-group">
          <!-- Floating Hands -->
          <g class="buddy-hands">
            <!-- Left Hand -->
            <g class="buddy-hand buddy-hand-left">
              <ellipse cx="10" cy="38" rx="4.8" ry="4" fill="url(#buddyHandGrad)"/>
              <path d="M7.5,36.5 C9,35.5 11,36 12,37" stroke="rgba(255,255,255,0.45)" stroke-width="1.1" stroke-linecap="round" fill="none"/>
            </g>
            <!-- Right Hand (Waving / Pointing) -->
            <g class="buddy-hand buddy-hand-right">
              <ellipse cx="54" cy="38" rx="4.8" ry="4" fill="url(#buddyHandGrad)"/>
              <path d="M51.5,36.5 C53,35.5 55,36 56,37" stroke="rgba(255,255,255,0.45)" stroke-width="1.1" stroke-linecap="round" fill="none"/>
            </g>
          </g>

          <!-- Main "Crowned B" Mascot Body Shape -->
          <path class="buddy-body-path" d="M18,17 C16,17 14,20 14,26 L14,44 C14,50 16,53 20,53 C26,53 38,54 44,50 C49,46 51,41 49,36 C47,33 43,32 39,32 C43,32 47,30 48,25 C50,20 46,16 40,16 C34,16 22,17 18,17 Z" fill="url(#buddyBodyGrad)"/>
          
          <!-- 3D Volumetric Lighting Overlay -->
          <path d="M18,17 C16,17 14,20 14,26 L14,44 C14,50 16,53 20,53 C26,53 38,54 44,50 C49,46 51,41 49,36 C47,33 43,32 39,32 C43,32 47,30 48,25 C50,20 46,16 40,16 C34,16 22,17 18,17 Z" fill="url(#buddy3DGlow)"/>

          <!-- Glossy Forehead & Belly Specular Highlights -->
          <path d="M18,19 C23,18 31,18 36,20 C34,22 24,21 18,22 Z" fill="#ffffff" opacity="0.55"/>
          <ellipse cx="24" cy="46" rx="5.5" ry="2.8" fill="#ffffff" opacity="0.18" transform="rotate(-15 24 46)"/>
          
          <!-- Electric Cyan Bounce Rim Light -->
          <path d="M46,23 C48,27 46,31 43,33 C47,37 49,42 46,47" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.7"/>

          <!-- Cheek Blushes -->
          <ellipse cx="19" cy="35" rx="3.2" ry="1.8" fill="#f43f5e" opacity="0.45"/>
          <ellipse cx="43" cy="35" rx="3.2" ry="1.8" fill="#f43f5e" opacity="0.45"/>

          <!-- Expressive Eyes -->
          ${eyesSvg}

          <!-- Expressive Mouth -->
          ${mouthSvg}

          <!-- Orbiting Dizzy Stars (in dizzy mood) -->
          ${crownSparkles}
        </g>
      </svg>
    `;
  }

  /* ------------------------------------------------------------
     State & Helper Functions
     ------------------------------------------------------------ */
  function isBuddyEnabled() {
    const val = localStorage.getItem(STORAGE_KEY_ENABLED);
    return val !== 'false';
  }

  function triggerHaptic(ms = 10) {
    if (window.BCA_UI && window.BCA_UI.triggerLightHaptic) {
      window.BCA_UI.triggerLightHaptic();
    } else if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (_e) {}
    }
  }

  function showToast(msg, type = 'info') {
    if (window.BCA_UI && window.BCA_UI.showToast) {
      window.BCA_UI.showToast(msg, type);
    }
  }

  function showBubble(text, duration = 3000) {
    if (!speechBubbleEl) return;
    speechBubbleEl.textContent = text;
    speechBubbleEl.classList.add('visible');

    if (bubbleTimeout) clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => {
      speechBubbleEl.classList.remove('visible');
    }, duration);
  }

  function setMascotMood(mood) {
    if (currentMood === mood) return;
    currentMood = mood;
    const bodyEl = mascotEl ? mascotEl.querySelector('.prime-buddy-body') : null;
    if (bodyEl) {
      bodyEl.innerHTML = renderMascotBody(mood, currentEdge);
    }
    if (mascotEl) {
      mascotEl.classList.toggle('is-dizzy', mood === 'dizzy');
    }
  }

  function triggerDizzyState(duration = 2800) {
    setMascotMood('dizzy');
    showBubble('Woah... dizzy... 😵‍💫', duration);
    triggerHaptic(25);

    if (dizzyRecoverTimer) clearTimeout(dizzyRecoverTimer);
    dizzyRecoverTimer = setTimeout(() => {
      setMascotMood('normal');
      showBubble('All good now! ✨', 1800);
    }, duration);
  }

  function savePosition(pos) {
    try {
      localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(pos));
    } catch (_e) {}
  }

  /* ------------------------------------------------------------
     DOM Creation: Mascot Floating Character
     ------------------------------------------------------------ */
  function createMascotElements() {
    if (document.getElementById('primeBuddyMascot')) return;

    mascotEl = document.createElement('div');
    mascotEl.id = 'primeBuddyMascot';
    mascotEl.className = 'prime-buddy-wrap';
    mascotEl.style.position = 'fixed';
    mascotEl.style.top = '0px';
    mascotEl.style.left = '0px';
    mascotEl.style.zIndex = '10030';
    mascotEl.style.width = '66px';
    mascotEl.style.height = '66px';
    mascotEl.style.touchAction = 'none';
    mascotEl.setAttribute('role', 'button');
    mascotEl.setAttribute('tabindex', '0');
    mascotEl.setAttribute('aria-label', 'PrimeBuddy Study Companion');

    // Speech bubble
    speechBubbleEl = document.createElement('div');
    speechBubbleEl.className = 'prime-buddy-bubble';
    speechBubbleEl.textContent = 'Hey! 👋';
    mascotEl.appendChild(speechBubbleEl);

    // Mascot Body (3D Crown + "Crowned B" SVG)
    const bodyEl = document.createElement('div');
    bodyEl.className = 'prime-buddy-body';
    bodyEl.innerHTML = renderMascotBody('normal', 'right');
    mascotEl.appendChild(bodyEl);

    // Edge Tuck Button / Tab
    tuckBtnEl = document.createElement('div');
    tuckBtnEl.className = 'prime-buddy-tuck-btn';
    tuckBtnEl.title = 'Tuck / Untuck PrimeBuddy';
    tuckBtnEl.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    tuckBtnEl.onclick = (e) => {
      e.stopPropagation();
      toggleTuckState();
    };
    mascotEl.appendChild(tuckBtnEl);

    document.body.appendChild(mascotEl);

    restoreMascotPosition();
    initDragPhysics();
    initIdleDetection();
    createMenuElement();
    createIntroModalElement();
    updateMascotVisibility();
  }

  /* Position restoration with boundary clamps */
  function restoreMascotPosition() {
    const screenW = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0, 360);
    const screenH = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0, 640);

    let edge = 'right';
    let x = screenW - MASCOT_SIZE - SAFE_MARGIN_X;
    let y = screenH - MASCOT_SIZE - SAFE_MARGIN_BOTTOM - 60;

    const saved = localStorage.getItem(STORAGE_KEY_POS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.y === 'number' && !isNaN(parsed.y)) {
          edge = parsed.edge === 'left' ? 'left' : 'right';
          x = edge === 'left' ? SAFE_MARGIN_X : (screenW - MASCOT_SIZE - SAFE_MARGIN_X);
          y = Math.min(Math.max(parsed.y, SAFE_MARGIN_TOP), screenH - MASCOT_SIZE - SAFE_MARGIN_BOTTOM);
        }
      } catch (_e) {}
    }

    if (isNaN(x) || x < 0) x = screenW - MASCOT_SIZE - SAFE_MARGIN_X;
    if (isNaN(y) || y < SAFE_MARGIN_TOP) y = screenH - MASCOT_SIZE - SAFE_MARGIN_BOTTOM - 60;

    currentX = Math.round(x);
    currentY = Math.round(y);
    currentEdge = edge;

    mascotEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    mascotEl.classList.remove('edge-left', 'edge-right');
    mascotEl.classList.add(`edge-${currentEdge}`);
    updateTuckBtnIcon();

    const bodyEl = mascotEl.querySelector('.prime-buddy-body');
    if (bodyEl) bodyEl.innerHTML = renderMascotBody(currentMood, currentEdge);
  }

  /* ------------------------------------------------------------
     Physics Engine: 4-Wall Throw-and-Bounce Ricochet
     ------------------------------------------------------------ */
  let wasDragged = false;

  function initDragPhysics() {
    if (!mascotEl) return;

    mascotEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.prime-buddy-tuck-btn')) return;

      // Stop active fling or roaming immediately
      if (isFlinging) {
        cancelAnimationFrame(flingRafId);
        isFlinging = false;
        mascotEl.classList.remove('is-flinging');
      }
      stopRoaming();

      isDragging = true;
      wasDragged = false;
      mascotEl.classList.add('is-dragging');
      setMascotMood('dragging');

      dragStartX = e.clientX;
      dragStartY = e.clientY;
      elemStartX = currentX;
      elemStartY = currentY;

      pointerHistory = [{ x: e.clientX, y: e.clientY, time: performance.now() }];

      try {
        mascotEl.setPointerCapture(e.pointerId);
      } catch (_e) {}
      triggerHaptic(8);
      e.preventDefault();
    });

    mascotEl.addEventListener('pointermove', (e) => {
      if (!isDragging) return;

      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      if (Math.hypot(dx, dy) > 8) {
        wasDragged = true;
      }

      currentX = elemStartX + dx;
      currentY = elemStartY + dy;

      // Track rolling pointer velocity for true fling release
      const now = performance.now();
      pointerHistory.push({ x: e.clientX, y: e.clientY, time: now });
      while (pointerHistory.length > 5 && now - pointerHistory[0].time > 100) {
        pointerHistory.shift();
      }

      // Tilt and squish reactively according to drag delta
      const tiltAngle = Math.max(-18, Math.min(18, dx * 0.25));
      mascotEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(1.08) rotate(${tiltAngle}deg)`;

      // Directional eye glance toward screen center
      const centerGlance = currentX < window.innerWidth / 2 ? 'right' : 'left';
      if (centerGlance !== currentEdge) {
        currentEdge = centerGlance;
        const bodyEl = mascotEl.querySelector('.prime-buddy-body');
        if (bodyEl) bodyEl.innerHTML = renderMascotBody('dragging', currentEdge);
      }
    });

    const onPointerRelease = (e) => {
      if (!isDragging) return;
      isDragging = false;
      mascotEl.classList.remove('is-dragging');

      const now = performance.now();
      pointerHistory.push({ x: e.clientX, y: e.clientY, time: now });

      // Compute true release velocity (pixels per second)
      let vx = 0;
      let vy = 0;
      if (pointerHistory.length >= 2) {
        const oldest = pointerHistory[0];
        const newest = pointerHistory[pointerHistory.length - 1];
        const dt = (newest.time - oldest.time) / 1000;
        if (dt > 0.015) {
          vx = (newest.x - oldest.x) / dt;
          vy = (newest.y - oldest.y) / dt;
        }
      }

      const totalDist = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
      const speed = Math.hypot(vx, vy);

      // If user clearly flung the mascot (speed > 280px/s or dragged fast)
      if (speed > 280 && totalDist > 12) {
        startFlingPhysics(vx, vy);
      } else {
        setMascotMood('normal');
        snapToEdge();
      }
    };

    mascotEl.addEventListener('pointerup', onPointerRelease);
    mascotEl.addEventListener('pointercancel', onPointerRelease);

    // Tap Mascot to open Compact Tap Menu
    mascotEl.addEventListener('click', (e) => {
      if (wasDragged) return;

      if (isTucked) {
        toggleTuckState();
        return;
      }
      toggleMenu();
    });
  }

  /* 4-Wall Ricochet Kinetic Physics Loop */
  function startFlingPhysics(initialVx, initialVy) {
    if (isFlinging) cancelAnimationFrame(flingRafId);
    isFlinging = true;
    mascotEl.classList.add('is-flinging');

    flingVelX = Math.max(-2800, Math.min(2800, initialVx));
    flingVelY = Math.max(-2800, Math.min(2800, initialVy));

    const speed = Math.hypot(flingVelX, flingVelY);
    // Hard throw triggers dizzy spinning eyes
    if (speed > 1650) {
      triggerDizzyState(2800);
    } else {
      setMascotMood('dragging');
    }

    const FRICTION = 0.982;
    const RESTITUTION = 0.72; // Bounce velocity retention
    const STOP_SPEED = 45;

    let lastTime = performance.now();

    function physicsStep(time) {
      if (!isFlinging) return;
      const dt = Math.min((time - lastTime) / 1000, 0.04);
      lastTime = time;

      currentX += flingVelX * dt;
      currentY += flingVelY * dt;

      flingVelX *= Math.pow(FRICTION, dt * 60);
      flingVelY *= Math.pow(FRICTION, dt * 60);

      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      const minX = SAFE_MARGIN_X;
      const maxX = screenW - MASCOT_SIZE - SAFE_MARGIN_X;
      const minY = SAFE_MARGIN_TOP;
      const maxY = screenH - MASCOT_SIZE - SAFE_MARGIN_BOTTOM;

      let hitWall = false;

      // Left Wall Collision
      if (currentX <= minX) {
        currentX = minX;
        flingVelX = -flingVelX * RESTITUTION;
        hitWall = true;
        currentEdge = 'left';
      }
      // Right Wall Collision
      else if (currentX >= maxX) {
        currentX = maxX;
        flingVelX = -flingVelX * RESTITUTION;
        hitWall = true;
        currentEdge = 'right';
      }

      // Top Wall Collision
      if (currentY <= minY) {
        currentY = minY;
        flingVelY = -flingVelY * RESTITUTION;
        hitWall = true;
      }
      // Bottom Wall Collision
      else if (currentY >= maxY) {
        currentY = maxY;
        flingVelY = -flingVelY * RESTITUTION;
        hitWall = true;
      }

      if (hitWall) {
        triggerHaptic(12);
        // Squash and stretch impact reaction
        const squishScale = hitWall ? 'scale(1.15, 0.85)' : 'scale(1)';
        mascotEl.style.transform = `translate3d(${Math.round(currentX)}px, ${Math.round(currentY)}px, 0) ${squishScale}`;
      } else {
        const flightTilt = Math.max(-25, Math.min(25, flingVelX * 0.02));
        mascotEl.style.transform = `translate3d(${Math.round(currentX)}px, ${Math.round(currentY)}px, 0) rotate(${flightTilt}deg)`;
      }

      const currentSpeed = Math.hypot(flingVelX, flingVelY);
      if (currentSpeed < STOP_SPEED) {
        isFlinging = false;
        mascotEl.classList.remove('is-flinging');
        if (currentMood !== 'dizzy') setMascotMood('normal');
        snapToEdge();
        return;
      }

      flingRafId = requestAnimationFrame(physicsStep);
    }

    flingRafId = requestAnimationFrame(physicsStep);
  }

  /* Snap softly to nearest left or right edge */
  function snapToEdge() {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    const snapLeft = currentX < (screenW - MASCOT_SIZE) / 2;
    currentEdge = snapLeft ? 'left' : 'right';
    currentX = snapLeft ? SAFE_MARGIN_X : (screenW - MASCOT_SIZE - SAFE_MARGIN_X);
    currentY = Math.min(Math.max(currentY, SAFE_MARGIN_TOP), screenH - MASCOT_SIZE - SAFE_MARGIN_BOTTOM);

    mascotEl.classList.add('is-snapping');
    mascotEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    mascotEl.classList.remove('edge-left', 'edge-right');
    mascotEl.classList.add(`edge-${currentEdge}`);
    updateTuckBtnIcon();

    const bodyEl = mascotEl.querySelector('.prime-buddy-body');
    if (bodyEl) bodyEl.innerHTML = renderMascotBody(currentMood, currentEdge);

    savePosition({ y: currentY, edge: currentEdge });

    setTimeout(() => {
      if (mascotEl) mascotEl.classList.remove('is-snapping');
      resetIdleTimer();
    }, 280);
  }

  /* ------------------------------------------------------------
     Edge-Tuck Mode (Clean Peeking Tab)
     ------------------------------------------------------------ */
  function updateTuckBtnIcon() {
    if (!tuckBtnEl) return;
    if (currentEdge === 'right') {
      tuckBtnEl.innerHTML = isTucked
        ? '<i class="fa-solid fa-chevron-left"></i>'
        : '<i class="fa-solid fa-chevron-right"></i>';
    } else {
      tuckBtnEl.innerHTML = isTucked
        ? '<i class="fa-solid fa-chevron-right"></i>'
        : '<i class="fa-solid fa-chevron-left"></i>';
    }
  }

  function toggleTuckState() {
    isTucked = !isTucked;
    triggerHaptic(10);
    mascotEl.classList.toggle('is-tucked', isTucked);
    updateTuckBtnIcon();

    if (isTucked) {
      stopRoaming();
      closeMenu();
      showBubble('Tucked away! Tap tab to peek 👋', 1800);
    } else {
      showBubble('Ready to study! ✨', 1800);
      resetIdleTimer();
    }
  }

  /* ------------------------------------------------------------
     Autonomous Roaming Loop ("Screen Par Ghoomna")
     ------------------------------------------------------------ */
  function initIdleDetection() {
    const activityEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(evt => {
      window.addEventListener(evt, () => {
        resetIdleTimer();
      }, { passive: true });
    });
    resetIdleTimer();
  }

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    if (isRoaming) stopRoaming();

    if (!autoRoamEnabled || isTucked || isDragging || isFlinging || !isBuddyEnabled()) return;

    idleTimer = setTimeout(() => {
      startAutonomousRoam();
    }, IDLE_ROAM_DELAY);
  }

  function stopRoaming() {
    isRoaming = false;
    if (roamStepTimer) clearTimeout(roamStepTimer);
    if (mascotEl) mascotEl.classList.remove('is-roaming');
  }

  function startAutonomousRoam() {
    if (!autoRoamEnabled || isRoaming || isTucked || isDragging || isFlinging || !isBuddyEnabled()) return;
    isRoaming = true;
    if (mascotEl) mascotEl.classList.add('is-roaming');
    triggerAutonomousRoamStep();
  }

  function triggerAutonomousRoamStep() {
    if (!isRoaming || !autoRoamEnabled || isTucked) return;

    const screenH = window.innerHeight;
    const minY = SAFE_MARGIN_TOP;
    const maxY = screenH - MASCOT_SIZE - SAFE_MARGIN_BOTTOM;

    // Gentle random vertical drift along current edge
    const stepDelta = (Math.random() * 80 - 40);
    let targetY = Math.min(Math.max(currentY + stepDelta, minY), maxY);

    currentY = Math.round(targetY);
    mascotEl.style.transition = 'transform 2.2s cubic-bezier(0.25, 1, 0.5, 1)';
    mascotEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;

    savePosition({ y: currentY, edge: currentEdge });

    // 25% chance to show a cheerful mascot quote while strolling
    if (Math.random() < 0.25) {
      const quote = BUDDY_QUOTES[Math.floor(Math.random() * BUDDY_QUOTES.length)];
      showBubble(quote, 2500);
    }

    roamStepTimer = setTimeout(() => {
      if (mascotEl) mascotEl.style.transition = '';
      if (isRoaming) triggerAutonomousRoamStep();
    }, 3200 + Math.random() * 2000);
  }

  function toggleAutoRoam() {
    autoRoamEnabled = !autoRoamEnabled;
    localStorage.setItem(STORAGE_KEY_ROAM, String(autoRoamEnabled));
    triggerHaptic(12);

    updateAutoRoamUI();

    if (autoRoamEnabled) {
      showBubble('Roaming ON! 🚶', 1800);
      resetIdleTimer();
    } else {
      stopRoaming();
      showBubble('Staying still! ⚓', 1800);
    }
  }

  function updateAutoRoamUI() {
    const badge = document.getElementById('buddyMenuRoamBadge');
    if (badge) {
      badge.textContent = autoRoamEnabled ? 'ON' : 'OFF';
      badge.className = `buddy-item-badge ${autoRoamEnabled ? 'badge-on' : 'badge-off'}`;
    }
  }

  /* ------------------------------------------------------------
     Fun Reaction / Spin Engine
     - 360° jump and flip reaction
     - Escalates to dizzy spin if tapped 3 times rapidly
     ------------------------------------------------------------ */
  function triggerFunReaction() {
    consecutiveFunTaps++;
    if (funTapTimeout) clearTimeout(funTapTimeout);
    funTapTimeout = setTimeout(() => { consecutiveFunTaps = 0; }, 2000);

    triggerHaptic(16);

    // If tapped 3 times rapidly, trigger dizzy hypnosis spirals!
    if (consecutiveFunTaps >= 3) {
      consecutiveFunTaps = 0;
      triggerDizzyState(3000);
      return;
    }

    // Perform a cute jump and 360° flip animation
    if (mascotEl) {
      mascotEl.classList.remove('is-doing-flip');
      void mascotEl.offsetWidth; // Force DOM reflow
      mascotEl.classList.add('is-doing-flip');
      setTimeout(() => {
        if (mascotEl) mascotEl.classList.remove('is-doing-flip');
      }, 720);
    }

    const funQuotes = [
      'Wheee! 🌀',
      'High five! ✋',
      'Jump jump! ⭐',
      'BCA Prime power! 🚀',
      'Full 360 flip! 💫',
      'Ready to study! 📚'
    ];
    const quote = funQuotes[Math.floor(Math.random() * funQuotes.length)];
    showBubble(quote, 2200);
  }

  function hideBuddyFromMenu() {
    closeMenu();
    setPrimeBuddyEnabled(false, false);
    showToast('PrimeBuddy hidden. You can bring it back anytime in Profile → Settings!', 'info');
  }

  /* ------------------------------------------------------------
     Compact Interactive Tap Menu (Clean & Lightweight)
     ------------------------------------------------------------ */
  function createMenuElement() {
    if (document.getElementById('primeBuddyMenu')) return;

    // Backdrop for outside click dismiss
    menuBackdropEl = document.createElement('div');
    menuBackdropEl.id = 'primeBuddyMenuBackdrop';
    menuBackdropEl.className = 'prime-buddy-menu-backdrop';
    menuBackdropEl.onclick = () => closeMenu();
    document.body.appendChild(menuBackdropEl);

    menuEl = document.createElement('div');
    menuEl.id = 'primeBuddyMenu';
    menuEl.className = 'prime-buddy-menu';
    menuEl.setAttribute('role', 'dialog');
    menuEl.setAttribute('aria-label', 'PrimeBuddy Controls');

    menuEl.innerHTML = `
      <div class="buddy-menu-head">
        <div class="buddy-menu-title-wrap">
          <i class="fa-solid fa-crown" style="color:#fbbf24; font-size:13px"></i>
          <h3 class="buddy-menu-title">PrimeBuddy</h3>
          <span class="buddy-menu-status-pill">Active</span>
        </div>
        <button class="buddy-menu-close-btn bca-pressable" id="buddyMenuCloseBtn" title="Close" aria-label="Close menu">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="buddy-menu-body">
        <!-- Roam Toggle -->
        <button class="buddy-menu-item bca-pressable" id="buddyMenuRoamBtn" type="button">
          <div class="buddy-item-icon-box buddy-item-icon-roam">
            <i class="fa-solid fa-person-walking"></i>
          </div>
          <div class="buddy-item-content">
            <span class="buddy-item-label">Autonomous Roam</span>
            <span class="buddy-item-sub">Wander along screen edges</span>
          </div>
          <span class="buddy-item-badge ${autoRoamEnabled ? 'badge-on' : 'badge-off'}" id="buddyMenuRoamBadge">
            ${autoRoamEnabled ? 'ON' : 'OFF'}
          </span>
        </button>

        <!-- Fun Reaction / Spin -->
        <button class="buddy-menu-item bca-pressable" id="buddyMenuSpinBtn" type="button">
          <div class="buddy-item-icon-box buddy-item-icon-spin">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
          </div>
          <div class="buddy-item-content">
            <span class="buddy-item-label">Fun Reaction / Spin</span>
            <span class="buddy-item-sub">Tap for flips, jumps &amp; spins</span>
          </div>
          <span class="buddy-item-action-icon">
            <i class="fa-solid fa-arrow-rotate-right"></i>
          </span>
        </button>

        <!-- Hide Buddy -->
        <button class="buddy-menu-item bca-pressable" id="buddyMenuHideBtn" type="button">
          <div class="buddy-item-icon-box buddy-item-icon-hide">
            <i class="fa-solid fa-eye-slash"></i>
          </div>
          <div class="buddy-item-content">
            <span class="buddy-item-label">Hide Buddy</span>
            <span class="buddy-item-sub">Re-enable in Profile &rarr; Settings</span>
          </div>
          <span class="buddy-item-action-icon">
            <i class="fa-solid fa-chevron-right"></i>
          </span>
        </button>
      </div>

      <div class="buddy-menu-footer">
        <i class="fa-solid fa-hand-pointer"></i>
        <span>Tip: Fling across screen for 4-wall ricochet!</span>
      </div>
    `;

    document.body.appendChild(menuEl);

    // Event Listeners
    const closeBtn = document.getElementById('buddyMenuCloseBtn') || menuEl.querySelector('#buddyMenuCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerHaptic(10);
        closeMenu();
      });
    }

    const roamBtn = document.getElementById('buddyMenuRoamBtn') || menuEl.querySelector('#buddyMenuRoamBtn');
    if (roamBtn) {
      roamBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAutoRoam();
      });
    }

    const spinBtn = document.getElementById('buddyMenuSpinBtn') || menuEl.querySelector('#buddyMenuSpinBtn');
    if (spinBtn) {
      spinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerFunReaction();
      });
    }

    const hideBtn = document.getElementById('buddyMenuHideBtn') || menuEl.querySelector('#buddyMenuHideBtn');
    if (hideBtn) {
      hideBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerHaptic(10);
        hideBuddyFromMenu();
      });
    }
  }

  function positionMenu() {
    if (!menuEl || !mascotEl) return;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const menuW = Math.min(screenW - 28, 265);
    const menuH = 225;
    const gap = 12;

    let left = 0;
    let top = 0;

    // If mascot is on the right half, position menu to the left
    if (currentX > (screenW - MASCOT_SIZE) / 2) {
      left = currentX - menuW - gap;
      if (left < 10) left = 10;
    } else {
      // On the left half, position menu to the right
      left = currentX + MASCOT_SIZE + gap;
      if (left + menuW > screenW - 10) {
        left = screenW - menuW - 10;
      }
    }

    // Vertically center aligned with mascot, clamped inside viewport
    top = currentY - (menuH / 2) + (MASCOT_SIZE / 2);
    if (top < 16) top = 16;
    if (top + menuH > screenH - 16) {
      top = screenH - menuH - 16;
    }

    menuEl.style.left = `${Math.round(left)}px`;
    menuEl.style.top = `${Math.round(top)}px`;
    menuEl.style.width = `${menuW}px`;
  }

  function toggleMenu() {
    if (!menuEl) return;
    const isOpen = menuEl.classList.contains('open');
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function openMenu() {
    if (!menuEl) return;
    if (isFlinging) { cancelAnimationFrame(flingRafId); isFlinging = false; }
    stopRoaming();
    updateAutoRoamUI();
    positionMenu();
    menuEl.classList.add('open');
    if (menuBackdropEl) menuBackdropEl.classList.add('open');
    triggerHaptic(12);
  }

  function closeMenu() {
    if (menuEl) menuEl.classList.remove('open');
    if (menuBackdropEl) menuBackdropEl.classList.remove('open');
    resetIdleTimer();
  }

  /* ------------------------------------------------------------
     Feature Introduction Modal ("Meet PrimeBuddy")
     ------------------------------------------------------------ */
  function createIntroModalElement() {
    if (document.getElementById('primeBuddyIntroModal')) return;

    introModalEl = document.createElement('div');
    introModalEl.id = 'primeBuddyIntroModal';
    introModalEl.className = 'buddy-intro-modal';
    introModalEl.setAttribute('role', 'dialog');
    introModalEl.setAttribute('aria-modal', 'true');
    introModalEl.setAttribute('aria-labelledby', 'buddyIntroTitle');

    introModalEl.innerHTML = `
      <div class="buddy-intro-card">
        <div class="buddy-intro-glow"></div>
        <span class="buddy-intro-badge"><i class="fa-solid fa-sparkles"></i> NEW FEATURE</span>
        
        <div class="buddy-intro-avatar-wrap">
          ${renderMascotBody('normal', 'right')}
        </div>

        <h2 class="buddy-intro-title" id="buddyIntroTitle">Meet PrimeBuddy</h2>
        <p class="buddy-intro-copy">
          Your interactive campus study companion! Drag me anywhere on screen, fling me across the walls with 4-wall ricochet physics, or let me roam around while you study.
        </p>

        <div class="buddy-intro-features">
          <div class="buddy-intro-feat-row">
            <span class="buddy-feat-icon"><i class="fa-solid fa-arrows-up-down-left-right"></i></span>
            <div class="buddy-feat-text">
              <h4>Spring &amp; Wall Bounce Physics</h4>
              <p>Drag and fling anywhere on screen with 4-wall ricochet momentum</p>
            </div>
          </div>
          <div class="buddy-intro-feat-row">
            <span class="buddy-feat-icon" style="color:#fbbf24"><i class="fa-solid fa-crown"></i></span>
            <div class="buddy-feat-text">
              <h4>3D Volumetric Rotating Crown</h4>
              <p>Continuous 360° rotating golden crown with dynamic jewel tips</p>
            </div>
          </div>
          <div class="buddy-intro-feat-row">
            <span class="buddy-feat-icon"><i class="fa-solid fa-person-walking"></i></span>
            <div class="buddy-feat-text">
              <h4>Autonomous Edge Roaming</h4>
              <p>Let PrimeBuddy stroll along your screen or tap for spins &amp; tricks</p>
            </div>
          </div>
        </div>

        <div class="buddy-intro-actions">
          <button class="buddy-btn-primary bca-pressable" id="buddyIntroTryBtn" onclick="window.acceptPrimeBuddyIntro()">
            <i class="fa-solid fa-sparkles"></i> Yes, Meet PrimeBuddy
          </button>
          <button class="buddy-btn-later bca-pressable" id="buddyIntroLaterBtn" onclick="window.dismissPrimeBuddyIntro()">
            Later
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(introModalEl);
  }

  function checkFirstTimeIntro() {
    const seen = localStorage.getItem(STORAGE_KEY_INTRO_SEEN);
    if (!seen) {
      setTimeout(() => {
        showIntroModal();
      }, 1200);
    }
  }

  function showIntroModal() {
    if (introModalEl) {
      introModalEl.classList.add('open');
      triggerHaptic(10);
    }
  }

  function closeIntroModal() {
    if (introModalEl) {
      introModalEl.classList.remove('open');
    }
  }

  function acceptPrimeBuddyIntro() {
    triggerHaptic(14);
    closeIntroModal();
    localStorage.setItem(STORAGE_KEY_INTRO_SEEN, 'true');
    setPrimeBuddyEnabled(true, true);
    setTimeout(() => {
      showBubble("Hey! I'm PrimeBuddy! Drag or fling me anytime 🚀", 4000);
    }, 400);
  }

  function dismissPrimeBuddyIntro() {
    triggerHaptic(8);
    closeIntroModal();
    localStorage.setItem(STORAGE_KEY_INTRO_SEEN, 'true');
    setPrimeBuddyEnabled(false, false);
    showToast('You can turn PrimeBuddy ON anytime from Profile → Settings', 'info');
  }

  /* ------------------------------------------------------------
     Settings Synchronization
     ------------------------------------------------------------ */
  function setPrimeBuddyEnabled(enabled, showFeedback = true) {
    localStorage.setItem(STORAGE_KEY_ENABLED, enabled ? 'true' : 'false');
    syncSettingsCheckboxes(enabled);
    updateMascotVisibility();

    if (showFeedback) {
      triggerHaptic(10);
      showToast(enabled ? 'PrimeBuddy enabled! 🚀' : 'PrimeBuddy turned off.', 'info');
    }
  }

  function syncSettingsCheckboxes(enabled) {
    const ids = ['primeBuddySettingsToggle', 'primeBuddyProfileToggle', 'settingsBuddyToggle'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = Boolean(enabled);
    });
  }

  function updateMascotVisibility() {
    const enabled = isBuddyEnabled();
    syncSettingsCheckboxes(enabled);
    if (mascotEl) {
      mascotEl.classList.toggle('is-hidden', !enabled);
      mascotEl.style.display = enabled ? 'block' : 'none';
    }
    if (!enabled && menuEl) {
      closeMenu();
    }
    if (enabled) {
      resetIdleTimer();
    } else {
      stopRoaming();
    }
  }

  /* ------------------------------------------------------------
     Global API Window Bindings
     ------------------------------------------------------------ */
  window.setPrimeBuddyEnabled = setPrimeBuddyEnabled;
  window.togglePrimeBuddyFromSettings = function (checked) {
    setPrimeBuddyEnabled(checked, true);
  };
  window.togglePrimeBuddyRoam = toggleAutoRoam;
  window.triggerPrimeBuddyReaction = triggerFunReaction;
  window.showPrimeBuddyIntro = showIntroModal;
  window.acceptPrimeBuddyIntro = acceptPrimeBuddyIntro;
  window.dismissPrimeBuddyIntro = dismissPrimeBuddyIntro;
  window.openPrimeBuddyMenu = openMenu;
  window.closePrimeBuddyMenu = closeMenu;
  window.togglePrimeBuddyMenu = toggleMenu;

  window.PrimeBuddy = {
    init,
    toggle: () => setPrimeBuddyEnabled(!isBuddyEnabled()),
    enable: () => setPrimeBuddyEnabled(true),
    disable: () => setPrimeBuddyEnabled(false),
    toggleRoam: toggleAutoRoam,
    triggerReaction: triggerFunReaction,
    triggerDizzy: triggerDizzyState,
    openMenu,
    closeMenu
  };

  /* ------------------------------------------------------------
     Lifecycle Initialization
     ------------------------------------------------------------ */
  function init() {
    createMascotElements();
    checkFirstTimeIntro();

    try {
      if (location.search.includes('buddy_intro=1')) {
        setTimeout(showIntroModal, 500);
      }
      if (location.search.includes('primebuddy=1')) {
        setPrimeBuddyEnabled(true, false);
      }
    } catch (_e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
