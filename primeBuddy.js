/**
 * ============================================================
 * BCAPrime — PrimeBuddy: Floating Autonomous Study Mascot
 * (v3.3 — 60fps Free-Roam 4-Wall Physics, Orbiting 3D SVG Crown & Long-Press Pill)
 * ============================================================
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------
     Constants & Configuration
     ------------------------------------------------------------ */
  const STORAGE_KEY_ENABLED = 'bcaprime_primebuddy_enabled';
  const STORAGE_KEY_POS = 'bcaprime_primebuddy_pos';
  const STORAGE_KEY_INTRO_SEEN = 'bcaprime_primebuddy_intro_seen';
  const STORAGE_KEY_ROAM = 'bcaprime_primebuddy_roam_enabled';

  const MASCOT_SIZE = 66; // 66px footprint
  const SAFE_MARGIN_X = 10;
  const SAFE_MARGIN_TOP = 65; // Safe area below BCAPrime header
  const SAFE_MARGIN_BOTTOM = 88; // Safe area above bottom nav bar
  const IDLE_ROAM_DELAY = 6000; // 6 seconds idle before autonomous wandering

  const BUDDY_QUOTES = [
    'Ready to ace your semester! 🚀',
    'Stay focused, you got this! ⭐',
    'Hydrate and keep coding! 💧',
    'BCA Prime power! 💻',
    'One topic at a time! 📚',
    'Consistency beats perfection! 🎯',
    'Great job showing up today! 🌟',
    'Semester exams will be a breeze! 💯',
    'Take breaks, stay sharp! ☕',
    'PrimeBuddy is always with you! ✨'
  ];

  /* ------------------------------------------------------------
     DOM Element References & Internal State
     ------------------------------------------------------------ */
  let mascotEl = null;
  let speechBubbleEl = null;
  let tuckBtnEl = null;
  let introModalEl = null;
  let actionPillEl = null;
  let actionPillBackdropEl = null;

  let isDragging = false;
  let wasDragged = false;
  let isFlinging = false;
  let isRoaming = false;
  let isTucked = false;
  let isNapping = false;
  let autoRoamEnabled = true;

  let currentMood = 'normal'; // 'normal' | 'dragging' | 'dizzy' | 'napping'
  let currentEdge = 'right';

  let currentX = 0;
  let currentY = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let elemStartX = 0;
  let elemStartY = 0;

  let pointerHistory = [];
  let flingVelX = 0;
  let flingVelY = 0;
  let flingRafId = null;

  let idleTimer = null;
  let roamStepTimer = null;
  let bubbleTimeout = null;
  let dizzyRecoverTimer = null;
  let consecutiveFunTaps = 0;
  let funTapTimeout = null;

  // Long-press detection (Hold ~400ms without dragging)
  let longPressTimer = null;
  let isLongPressTriggered = false;

  // Orbiting 3D Crown State
  let crownAngle = 0;
  let crownRafId = null;

  // Load saved roam preference (default ON)
  const savedRoam = localStorage.getItem(STORAGE_KEY_ROAM);
  if (savedRoam !== null) {
    autoRoamEnabled = savedRoam === 'true';
  }

  /* ------------------------------------------------------------
     Mathematically Precise 3D Orbiting SVG Crown Generator (360°)
     - Perfectly centered at cx = 32, cy = 13.5 above "B" mascot head
     - Elliptical golden base rim (rx = 11.5, ry = 3.4)
     - 5 Radial Orbiting Peaks (72° apart) with depth z-scaling
     - Vivid jewel tips & specular highlights
     ------------------------------------------------------------ */
  function renderCrownElementsMarkup(angle) {
    const cx = 32;
    const cy = 13.5;
    const rx = 11.5;
    const ry = 3.4;
    const h = 7.6;
    const jewelColors = ['#f43f5e', '#38bdf8', '#10b981', '#fbbf24', '#c084fc'];

    // Compute 5 radial peaks around the cylinder
    const peaks = [];
    for (let i = 0; i < 5; i++) {
      const th = angle + (i * Math.PI * 2) / 5;
      const sinT = Math.sin(th);
      const cosT = Math.cos(th);
      const x = cx + rx * sinT;
      const y = cy + ry * cosT;
      const z = cosT; // -1 (back) to +1 (front)
      const tx = x;
      const ty = y - h * (0.88 + 0.12 * z);
      const hw = 3.2 * (0.8 + 0.2 * z);
      peaks.push({ i, x, y, z, tx, ty, hw, color: jewelColors[i] });
    }

    // Sort by depth (back-most first, front-most last)
    peaks.sort((a, b) => a.z - b.z);

    const backPeaks = peaks.filter(p => p.z < 0);
    const frontPeaks = peaks.filter(p => p.z >= 0);

    let backPeaksSvg = '';
    backPeaks.forEach(p => {
      const jRad = (1.1 + 0.25 * (p.z + 1)).toFixed(2);
      backPeaksSvg += `
        <polygon points="${(p.x - p.hw).toFixed(1)},${p.y.toFixed(1)} ${p.tx.toFixed(1)},${p.ty.toFixed(1)} ${(p.x + p.hw).toFixed(1)},${p.y.toFixed(1)}" fill="url(#crownDarkGrad)" opacity="0.82"/>
        <circle cx="${p.tx.toFixed(1)}" cy="${p.ty.toFixed(1)}" r="${jRad}" fill="${p.color}" opacity="0.85"/>
      `;
    });

    let frontPeaksSvg = '';
    frontPeaks.forEach(p => {
      const jRad = (1.3 + 0.45 * p.z).toFixed(2);
      frontPeaksSvg += `
        <polygon points="${(p.x - p.hw).toFixed(1)},${p.y.toFixed(1)} ${p.tx.toFixed(1)},${p.ty.toFixed(1)} ${(p.x + p.hw).toFixed(1)},${p.y.toFixed(1)}" fill="url(#crownGoldGrad)"/>
        <line x1="${p.tx.toFixed(1)}" y1="${p.ty.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="#fef08a" stroke-width="0.8" opacity="0.75"/>
        <circle cx="${p.tx.toFixed(1)}" cy="${p.ty.toFixed(1)}" r="${jRad}" fill="${p.color}" stroke="#ffffff" stroke-width="0.5"/>
        <circle cx="${(p.tx - 0.4).toFixed(1)}" cy="${(p.ty - 0.4).toFixed(1)}" r="0.45" fill="#ffffff" opacity="0.95"/>
      `;
    });

    return `
      <!-- Crown Hollow Base Interior -->
      <ellipse cx="32" cy="13.5" rx="11.5" ry="3.4" fill="#78350f" opacity="0.6"/>
      <!-- Back Rim Arc -->
      <path d="M 20.5,13.5 A 11.5,3.4 0 0,1 43.5,13.5" fill="none" stroke="#78350f" stroke-width="2.2" opacity="0.5"/>
      <!-- Back Crown Points -->
      ${backPeaksSvg}
      <!-- Crown Inner Golden Glow -->
      <ellipse cx="32" cy="13.5" rx="9.5" ry="2.6" fill="url(#crownInnerGlow)"/>
      <!-- Front Crown Points -->
      ${frontPeaksSvg}
      <!-- Front Golden Rim Arc -->
      <path d="M 20.5,13.5 A 11.5,3.4 0 0,0 43.5,13.5" fill="none" stroke="url(#crownGoldGrad)" stroke-width="2.6" stroke-linecap="round"/>
      <!-- Front Specular Rim Highlight -->
      <path d="M 23,14.6 A 9,2.2 0 0,0 41,14.6" fill="none" stroke="#fef08a" stroke-width="0.9" stroke-linecap="round" opacity="0.8"/>
    `;
  }

  function startCrownLoop() {
    if (crownRafId) cancelAnimationFrame(crownRafId);

    function step() {
      // Rotate 360° continuously (~4.8s full turntable revolution)
      crownAngle += 0.022;
      if (crownAngle >= Math.PI * 2) crownAngle -= Math.PI * 2;

      const groupEl = document.getElementById('buddyCrownSvgGroup');
      if (groupEl && !document.hidden && mascotEl && !mascotEl.classList.contains('is-hidden')) {
        groupEl.innerHTML = renderCrownElementsMarkup(crownAngle);
      }
      crownRafId = requestAnimationFrame(step);
    }

    crownRafId = requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------
     High-Craft Multi-Layered "Crowned B" Mascot SVG Generator
     ------------------------------------------------------------ */
  function getMascotSvg(mood = 'normal', edge = currentEdge) {
    const eyeDx = edge === 'right' ? -1.8 : (edge === 'left' ? 1.8 : 0);

    let crownSparkles = '';
    if (mood === 'dizzy') {
      // Orbiting dizzy stars
      crownSparkles = `
        <g class="buddy-orbiting-ring" transform-origin="32 8">
          <polygon points="32,-2 33.2,0.8 36,1.2 34,3 34.6,5.8 32,4.2 29.4,5.8 30,3 28,1.2 30.8,0.8" fill="#fbbf24"/>
          <polygon points="18,14 19.2,16.8 22,17.2 20,19 20.6,21.8 18,20.2 15.4,21.8 16,19 14,17.2 16.8,16.8" fill="#fef08a"/>
          <polygon points="46,14 47.2,16.8 50,17.2 48,19 48.6,21.8 46,20.2 43.4,21.8 44,19 42,17.2 44.8,16.8" fill="#38bdf8"/>
        </g>
      `;
    }

    let eyesSvg = '';
    let mouthSvg = '';
    let extraOverlays = '';

    if (mood === 'dizzy') {
      // 360° Rapid Hypnosis Spiral Eyes
      eyesSvg = `
        <g transform-origin="24 28">
          <ellipse cx="24" cy="28" rx="5.6" ry="6.4" fill="#ffffff" stroke="#1e1b4b" stroke-width="1.3"/>
          <g class="buddy-dizzy-spiral-l" transform-origin="24 28">
            <path d="M24,28 A1.5,1.5 0 0,1 25.5,28 A2.8,2.8 0 0,1 22.5,29.5 A4,4 0 0,1 21,26.5 A5.2,5.2 0 0,1 26,24.5" fill="none" stroke="#1e1b4b" stroke-width="2" stroke-linecap="round"/>
            <circle cx="24" cy="28" r="1.6" fill="#f43f5e"/>
          </g>
        </g>
        <g transform-origin="38 28">
          <ellipse cx="38" cy="28" rx="5.6" ry="6.4" fill="#ffffff" stroke="#1e1b4b" stroke-width="1.3"/>
          <g class="buddy-dizzy-spiral-r" transform-origin="38 28">
            <path d="M38,28 A1.5,1.5 0 0,1 39.5,28 A2.8,2.8 0 0,1 36.5,29.5 A4,4 0 0,1 35,26.5 A5.2,5.2 0 0,1 40,24.5" fill="none" stroke="#1e1b4b" stroke-width="2" stroke-linecap="round"/>
            <circle cx="38" cy="28" r="1.6" fill="#f43f5e"/>
          </g>
        </g>
      `;
      mouthSvg = `<path d="M26,38 Q29,41 32,38 T38,38" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>`;
    } else if (mood === 'napping') {
      // Cute Closed Curved Sleeping Eyes (^ ^)
      eyesSvg = `
        <path d="M 19,29 Q 24,34 29,29" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M 33,29 Q 38,34 43,29" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>
      `;
      mouthSvg = `<path d="M29,36 Q31,38 33,36" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>`;
      // Animated floating zZz letters
      extraOverlays = `
        <g class="buddy-zzz-group" transform="translate(38, 16)">
          <text x="0" y="0" font-size="7" class="zzz-letter zzz-1">z</text>
          <text x="5" y="-5" font-size="9" class="zzz-letter zzz-2">Z</text>
          <text x="11" y="-12" font-size="11" class="zzz-letter zzz-3">Z</text>
        </g>
      `;
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
          <!-- 3D Volumetric Crown Gradients -->
          <linearGradient id="crownGoldGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="35%" stop-color="#fbbf24"/>
            <stop offset="70%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#b45309"/>
          </linearGradient>
          <linearGradient id="crownDarkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#d97706"/>
            <stop offset="100%" stop-color="#78350f"/>
          </linearGradient>
          <radialGradient id="crownInnerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fef08a" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
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

          <!-- Floating zZz sleeping particles -->
          ${extraOverlays}

          <!-- Orbiting Dizzy Stars (in dizzy mood) -->
          ${crownSparkles}

          <!-- 3D Golden Orbiting Crown Stage -->
          <g id="buddyCrownSvgGroup" class="buddy-crown-svg-group">
            ${renderCrownElementsMarkup(crownAngle)}
          </g>
        </g>
      </svg>
    `;
  }

  function renderMascotBody(mood = 'normal', edge = currentEdge) {
    return getMascotSvg(mood, edge);
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

  function showBubble(text, duration = 2500) {
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
      mascotEl.classList.toggle('is-napping', mood === 'napping');
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
    mascotEl.setAttribute('aria-label', 'PrimeBuddy Mascot');

    // Speech bubble
    speechBubbleEl = document.createElement('div');
    speechBubbleEl.className = 'prime-buddy-bubble';
    speechBubbleEl.textContent = 'Hey! 👋';
    mascotEl.appendChild(speechBubbleEl);

    // Mascot Body
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
    initInteractionAndPhysics();
    initIdleDetection();
    createActionPillElement();
    createIntroModalElement();
    updateMascotVisibility();
    startCrownLoop();
  }

  /* Position restoration with boundary clamps */
  function restoreMascotPosition() {
    const screenW = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0, 360);
    const screenH = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0, 640);

    let x = screenW - MASCOT_SIZE - SAFE_MARGIN_X;
    let y = screenH - MASCOT_SIZE - SAFE_MARGIN_BOTTOM - 60;
    let edge = 'right';

    const saved = localStorage.getItem(STORAGE_KEY_POS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          x = Math.max(SAFE_MARGIN_X, Math.min(parsed.x, screenW - MASCOT_SIZE - SAFE_MARGIN_X));
          y = Math.max(SAFE_MARGIN_TOP, Math.min(parsed.y, screenH - MASCOT_SIZE - SAFE_MARGIN_BOTTOM));
        } else if (parsed && typeof parsed.y === 'number') {
          y = Math.max(SAFE_MARGIN_TOP, Math.min(parsed.y, screenH - MASCOT_SIZE - SAFE_MARGIN_BOTTOM));
          x = parsed.edge === 'left' ? SAFE_MARGIN_X : (screenW - MASCOT_SIZE - SAFE_MARGIN_X);
        }
      } catch (_e) {}
    }

    currentX = Math.round(x);
    currentY = Math.round(y);
    currentEdge = currentX < screenW / 2 ? 'left' : 'right';

    mascotEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    mascotEl.classList.remove('edge-left', 'edge-right');
    mascotEl.classList.add(`edge-${currentEdge}`);
    updateTuckBtnIcon();
  }

  /* ------------------------------------------------------------
     Tap & Long-Press Detection + 60fps Free Drag Physics
     - Tap (< 400ms, < 6px move): Cute bounce reaction + greeting (no menu)
     - Long-Press (~400ms hold): Opens Floating Action Pill (Dance | Nap | Hide)
     - Drag & Fling: Free 4-wall ricochet momentum, zero edge lock!
     ------------------------------------------------------------ */
  function initInteractionAndPhysics() {
    if (!mascotEl) return;

    mascotEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.prime-buddy-tuck-btn')) return;

      // If mascot is napping, a tap wakes him up immediately!
      if (isNapping) {
        wakeUpMascot();
        e.preventDefault();
        return;
      }

      // Stop active fling or roaming immediately
      if (isFlinging) {
        cancelAnimationFrame(flingRafId);
        isFlinging = false;
        mascotEl.classList.remove('is-flinging');
      }
      stopRoaming();

      isDragging = true;
      wasDragged = false;
      isLongPressTriggered = false;

      dragStartX = e.clientX;
      dragStartY = e.clientY;
      elemStartX = currentX;
      elemStartY = currentY;

      pointerHistory = [{ x: e.clientX, y: e.clientY, time: performance.now() }];

      // Set long-press timer (~400ms hold opens Action Pill)
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        if (isDragging && !wasDragged) {
          isLongPressTriggered = true;
          triggerHaptic(25);
          openActionPill();
        }
      }, 400);

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

      // Detect deliberate drag movement
      if (Math.hypot(dx, dy) > 7) {
        wasDragged = true;
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }

      // If long-press pill already opened, do not move the character
      if (isLongPressTriggered) return;

      if (!wasDragged) return;

      mascotEl.classList.add('is-dragging');
      if (currentMood !== 'dizzy') setMascotMood('dragging');

      currentX = elemStartX + dx;
      currentY = elemStartY + dy;

      // Rolling velocity tracking for fling release
      const now = performance.now();
      pointerHistory.push({ x: e.clientX, y: e.clientY, time: now });
      while (pointerHistory.length > 5 && now - pointerHistory[0].time > 100) {
        pointerHistory.shift();
      }

      // Reactive tilt and squish following finger movement
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
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      if (!isDragging) return;
      isDragging = false;
      mascotEl.classList.remove('is-dragging');

      // If user was holding for long press, pill is open, so don't fling/bounce
      if (isLongPressTriggered) {
        isLongPressTriggered = false;
        return;
      }

      // 1. If user dragged or flung the mascot
      if (wasDragged) {
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

        // Fling across 4 walls if speed > 280px/s
        if (speed > 280 && totalDist > 12) {
          startFlingPhysics(vx, vy);
        } else {
          // Normal drag drop: clamp inside safe bounds and rest freely!
          if (currentMood !== 'dizzy') setMascotMood('normal');
          settleFreePosition();
        }
        return;
      }

      // 2. Otherwise: Single Tap Action!
      triggerSingleTapReaction();
    };

    mascotEl.addEventListener('pointerup', onPointerRelease);
    mascotEl.addEventListener('pointercancel', onPointerRelease);
  }

  /* Single Tap: Cute happy bounce reaction + playful quote (no menu!) */
  function triggerSingleTapReaction() {
    if (isTucked) {
      toggleTuckState();
      return;
    }

    // Close action pill if open
    closeActionPill();

    // If currently napping, wake up!
    if (isNapping) {
      wakeUpMascot();
      return;
    }

    triggerHaptic(12);

    // Hop bounce animation
    mascotEl.classList.remove('is-doing-bounce');
    void mascotEl.offsetWidth; // Reflow
    mascotEl.classList.add('is-doing-bounce');
    setTimeout(() => {
      if (mascotEl) mascotEl.classList.remove('is-doing-bounce');
    }, 450);

    // Cheerful speech bubble
    const quote = BUDDY_QUOTES[Math.floor(Math.random() * BUDDY_QUOTES.length)];
    showBubble(quote, 2200);
    resetIdleTimer();
  }

  /* Settle freely at current coordinates without snapping to screen edge */
  function settleFreePosition() {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    const minX = SAFE_MARGIN_X;
    const maxX = screenW - MASCOT_SIZE - SAFE_MARGIN_X;
    const minY = SAFE_MARGIN_TOP;
    const maxY = screenH - MASCOT_SIZE - SAFE_MARGIN_BOTTOM;

    currentX = Math.round(Math.max(minX, Math.min(currentX, maxX)));
    currentY = Math.round(Math.max(minY, Math.min(currentY, maxY)));
    currentEdge = currentX < screenW / 2 ? 'left' : 'right';

    mascotEl.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
    mascotEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;

    setTimeout(() => {
      if (mascotEl) mascotEl.style.transition = '';
    }, 240);

    mascotEl.classList.remove('edge-left', 'edge-right');
    mascotEl.classList.add(`edge-${currentEdge}`);
    updateTuckBtnIcon();

    const bodyEl = mascotEl.querySelector('.prime-buddy-body');
    if (bodyEl) bodyEl.innerHTML = renderMascotBody(currentMood, currentEdge);

    savePosition({ x: currentX, y: currentY, edge: currentEdge });
    resetIdleTimer();
  }

  /* ------------------------------------------------------------
     4-Wall Ricochet Kinetic Physics Loop (Elastic & Buttery Smooth)
     ------------------------------------------------------------ */
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

    const FRICTION = 0.985; // Low air friction for extended free ricochet
    const RESTITUTION = 0.82; // Lively 4-wall bounce elasticity
    const STOP_SPEED = 22; // Stop threshold

    let lastTime = performance.now();

    function physicsStep(time) {
      if (!isFlinging) return;
      const dt = Math.min((time - lastTime) / 1000, 0.035);
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

      // Top Wall Collision (Below BCAPrime header)
      if (currentY <= minY) {
        currentY = minY;
        flingVelY = -flingVelY * RESTITUTION;
        hitWall = true;
      }
      // Bottom Wall Collision (Above bottom nav bar)
      else if (currentY >= maxY) {
        currentY = maxY;
        flingVelY = -flingVelY * RESTITUTION;
        hitWall = true;
      }

      if (hitWall) {
        triggerHaptic(10);
        // Squash and stretch impact reaction
        mascotEl.style.transform = `translate3d(${Math.round(currentX)}px, ${Math.round(currentY)}px, 0) scale(1.14, 0.86)`;
      } else {
        const flightTilt = Math.max(-25, Math.min(25, flingVelX * 0.02));
        mascotEl.style.transform = `translate3d(${Math.round(currentX)}px, ${Math.round(currentY)}px, 0) rotate(${flightTilt}deg)`;
      }

      const currentSpeed = Math.hypot(flingVelX, flingVelY);
      if (currentSpeed < STOP_SPEED) {
        isFlinging = false;
        mascotEl.classList.remove('is-flinging');
        if (currentMood !== 'dizzy') setMascotMood('normal');
        // Rest freely at landing spot (no snap back to edge!)
        settleFreePosition();
        return;
      }

      flingRafId = requestAnimationFrame(physicsStep);
    }

    flingRafId = requestAnimationFrame(physicsStep);
  }

  /* ------------------------------------------------------------
     Long-Press Action Pill: Dance | Nap | Hide
     ------------------------------------------------------------ */
  function createActionPillElement() {
    if (document.getElementById('buddyActionPill')) return;

    // Backdrop for outside click dismiss
    actionPillBackdropEl = document.createElement('div');
    actionPillBackdropEl.id = 'buddyPillBackdrop';
    actionPillBackdropEl.className = 'buddy-pill-backdrop';
    actionPillBackdropEl.onclick = () => closeActionPill();
    document.body.appendChild(actionPillBackdropEl);

    // Horizontal Floating Action Pill
    actionPillEl = document.createElement('div');
    actionPillEl.id = 'buddyActionPill';
    actionPillEl.className = 'buddy-action-pill';
    actionPillEl.setAttribute('role', 'toolbar');
    actionPillEl.setAttribute('aria-label', 'PrimeBuddy Actions');

    actionPillEl.innerHTML = `
      <button class="buddy-pill-btn bca-pressable" id="buddyPillDanceBtn" type="button" aria-label="Dance">
        <span class="pill-btn-emoji">💃</span>
        <span>Dance</span>
      </button>
      <div class="buddy-pill-sep"></div>
      <button class="buddy-pill-btn bca-pressable" id="buddyPillNapBtn" type="button" aria-label="Nap">
        <span class="pill-btn-emoji">😴</span>
        <span id="buddyPillNapLabel">Nap</span>
      </button>
      <div class="buddy-pill-sep"></div>
      <button class="buddy-pill-btn bca-pressable" id="buddyPillHideBtn" type="button" aria-label="Hide">
        <span class="pill-btn-emoji">👋</span>
        <span>Hide</span>
      </button>
    `;

    document.body.appendChild(actionPillEl);

    // Event Listeners
    const danceBtn = document.getElementById('buddyPillDanceBtn');
    if (danceBtn) {
      danceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerDanceAction();
      });
    }

    const napBtn = document.getElementById('buddyPillNapBtn');
    if (napBtn) {
      napBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNapAction();
      });
    }

    const hideBtn = document.getElementById('buddyPillHideBtn');
    if (hideBtn) {
      hideBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideBuddyAction();
      });
    }
  }

  function positionActionPill() {
    if (!actionPillEl || !mascotEl) return;

    const screenW = window.innerWidth;
    const pillW = 216;
    const pillH = 44;

    // Horizontally center aligned with mascot
    let left = currentX + (MASCOT_SIZE / 2) - (pillW / 2);
    left = Math.max(10, Math.min(left, screenW - pillW - 10));

    // Prefer placing ABOVE mascot; if too close to top header, place BELOW
    let top = currentY - pillH - 10;
    if (top < SAFE_MARGIN_TOP) {
      top = currentY + MASCOT_SIZE + 10;
    }

    actionPillEl.style.left = `${Math.round(left)}px`;
    actionPillEl.style.top = `${Math.round(top)}px`;
  }

  function openActionPill() {
    if (!actionPillEl) return;
    if (isFlinging) {
      cancelAnimationFrame(flingRafId);
      isFlinging = false;
      mascotEl.classList.remove('is-flinging');
    }
    stopRoaming();

    // Update Nap / Wake button label
    const napLabel = document.getElementById('buddyPillNapLabel');
    if (napLabel) {
      napLabel.textContent = isNapping ? 'Wake' : 'Nap';
    }

    positionActionPill();
    actionPillEl.classList.add('open');
    if (actionPillBackdropEl) actionPillBackdropEl.classList.add('open');
  }

  function closeActionPill() {
    if (actionPillEl) actionPillEl.classList.remove('open');
    if (actionPillBackdropEl) actionPillBackdropEl.classList.remove('open');
    resetIdleTimer();
  }

  /* 1. Dance Action: 3s fun rhythmic dance & spin */
  function triggerDanceAction() {
    closeActionPill();
    if (isNapping) {
      isNapping = false;
      mascotEl.classList.remove('is-napping');
    }
    setMascotMood('normal');

    triggerHaptic(18);
    if (navigator.vibrate) {
      try { navigator.vibrate([20, 80, 20, 80, 40]); } catch (_e) {}
    }

    mascotEl.classList.remove('is-dancing');
    void mascotEl.offsetWidth; // Reflow
    mascotEl.classList.add('is-dancing');

    showBubble('Dancing time! 💃✨', 3200);

    setTimeout(() => {
      if (mascotEl) mascotEl.classList.remove('is-dancing');
    }, 3100);
  }

  /* 2. Nap Action: peaceful sleeping state with zZz particles */
  function toggleNapAction() {
    closeActionPill();
    if (isNapping) {
      wakeUpMascot();
    } else {
      startNap();
    }
  }

  function startNap() {
    isNapping = true;
    stopRoaming();
    setMascotMood('napping');
    triggerHaptic(14);
    showBubble('Taking a quick nap... zZz 😴', 2400);
  }

  function wakeUpMascot() {
    if (!isNapping) return;
    isNapping = false;
    mascotEl.classList.remove('is-napping');
    mascotEl.classList.add('is-waking-up');
    setMascotMood('normal');
    triggerHaptic(14);
    showBubble("I'm awake! Ready to study ✨", 2200);

    setTimeout(() => {
      if (mascotEl) mascotEl.classList.remove('is-waking-up');
    }, 520);

    resetIdleTimer();
  }

  /* 3. Hide Action */
  function hideBuddyAction() {
    closeActionPill();
    setPrimeBuddyEnabled(false, false);
    showToast('PrimeBuddy hidden — turn ON anytime in Profile → Settings', 'info');
  }

  /* ------------------------------------------------------------
     Autonomous 2D Screen Wandering ("Dheere-Dheere Ghoomna")
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

    if (!autoRoamEnabled || isTucked || isDragging || isFlinging || isNapping || !isBuddyEnabled()) return;

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
    if (!autoRoamEnabled || isRoaming || isTucked || isDragging || isFlinging || isNapping || !isBuddyEnabled()) return;
    isRoaming = true;
    if (mascotEl) mascotEl.classList.add('is-roaming');
    triggerAutonomousRoamStep();
  }

  function triggerAutonomousRoamStep() {
    if (!isRoaming || !autoRoamEnabled || isTucked || isNapping) return;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const minX = SAFE_MARGIN_X;
    const maxX = screenW - MASCOT_SIZE - SAFE_MARGIN_X;
    const minY = SAFE_MARGIN_TOP;
    const maxY = screenH - MASCOT_SIZE - SAFE_MARGIN_BOTTOM;

    // Pick a smooth random 2D coordinate inside safe boundaries
    const targetX = Math.round(minX + Math.random() * (maxX - minX));
    const targetY = Math.round(minY + Math.random() * (maxY - minY));

    currentX = targetX;
    currentY = targetY;
    currentEdge = currentX < screenW / 2 ? 'left' : 'right';

    mascotEl.style.transition = 'transform 3.5s cubic-bezier(0.25, 1, 0.5, 1)';
    mascotEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;

    mascotEl.classList.remove('edge-left', 'edge-right');
    mascotEl.classList.add(`edge-${currentEdge}`);
    savePosition({ x: currentX, y: currentY, edge: currentEdge });

    // 25% chance to show a cheerful quote while strolling
    if (Math.random() < 0.25) {
      const quote = BUDDY_QUOTES[Math.floor(Math.random() * BUDDY_QUOTES.length)];
      showBubble(quote, 2500);
    }

    roamStepTimer = setTimeout(() => {
      if (mascotEl) mascotEl.style.transition = '';
      if (isRoaming) triggerAutonomousRoamStep();
    }, 4200 + Math.random() * 2500);
  }

  /* ------------------------------------------------------------
     Edge-Tuck Mode
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
      closeActionPill();
      showBubble('Tucked away! Tap tab to peek 👋', 1800);
    } else {
      showBubble('Ready to study! ✨', 1800);
      resetIdleTimer();
    }
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
          Your interactive campus study companion! Drag me freely anywhere on screen, fling me across all 4 walls with ricochet momentum, or hold me for quick actions (Dance, Nap &amp; Hide).
        </p>

        <div class="buddy-intro-features">
          <div class="buddy-intro-feat-row">
            <span class="buddy-feat-icon"><i class="fa-solid fa-arrows-up-down-left-right"></i></span>
            <div class="buddy-feat-text">
              <h4>Free Roam &amp; 4-Wall Bounce</h4>
              <p>Place anywhere on screen or throw with 4-wall elastic ricochet physics</p>
            </div>
          </div>
          <div class="buddy-intro-feat-row">
            <span class="buddy-feat-icon" style="color:#fbbf24"><i class="fa-solid fa-crown"></i></span>
            <div class="buddy-feat-text">
              <h4>3D Volumetric Rotating Crown</h4>
              <p>Continuous 360° rotating golden crown with sparkling jewel tips</p>
            </div>
          </div>
          <div class="buddy-intro-feat-row">
            <span class="buddy-feat-icon"><i class="fa-solid fa-hand-pointer"></i></span>
            <div class="buddy-feat-text">
              <h4>Hold for Action Pill</h4>
              <p>Long-press for 💃 Dance, 😴 Nap (with zZz), or 👋 Hide</p>
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
      showBubble("Hey! I'm PrimeBuddy! Hold me for actions 🚀", 3500);
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
    if (!enabled && actionPillEl) {
      closeActionPill();
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
  window.showPrimeBuddyIntro = showIntroModal;
  window.acceptPrimeBuddyIntro = acceptPrimeBuddyIntro;
  window.dismissPrimeBuddyIntro = dismissPrimeBuddyIntro;
  window.openPrimeBuddyPill = openActionPill;
  window.closePrimeBuddyPill = closeActionPill;
  window.triggerPrimeBuddyDance = triggerDanceAction;
  window.triggerPrimeBuddyNap = toggleNapAction;
  window.wakeUpPrimeBuddy = wakeUpMascot;

  window.PrimeBuddy = {
    init,
    toggle: () => setPrimeBuddyEnabled(!isBuddyEnabled()),
    enable: () => setPrimeBuddyEnabled(true),
    disable: () => setPrimeBuddyEnabled(false),
    dance: triggerDanceAction,
    nap: startNap,
    wake: wakeUpMascot,
    openPill: openActionPill,
    closePill: closeActionPill,
    triggerDizzy: triggerDizzyState
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
