/**
 * ============================================================
 * BCAPrime — PrimeBuddy: Floating Autonomous Study Mascot
 * (v3.6 — Session-Only Hide, Smart Time-of-Day Greeting & Organic Lifelike Behavior)
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
  const STORAGE_KEY_GREET_SLOT = 'bcaprime_primebuddy_last_greet_slot';
  const SESSION_KEY_RETURN_IDX = 'bcaprime_primebuddy_last_return_idx';

  const MASCOT_SIZE = 66; // 66px footprint
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

  const DIZZY_QUOTES = [
    'Whoa, the whole room is spinning! 💫',
    "Hold on, I'm seeing double! 😵💫",
    'Too fast! My crown is orbiting! 👑🌀',
    'Everything is swirling around me! 😵',
    'Arre bhai, duniya ghoom gayi! 💫',
    'Whoa, turbo spin mode! Give me a sec... 🌀',
    'My brain is doing backflips! 😵💫'
  ];

  const WHEEE_QUOTES = [
    'Wheee! ✨',
    'Yippee! 🚀',
    'Wohooo! ⭐',
    'Up we go! 🎈',
    'Spin spin! 💫',
    'Prime turbo speed! ⚡'
  ];

  const LOVE_QUOTES = [
    'Love you too! 💕',
    "Hehe, you're the best! 🥰",
    'Keep shining! 💖',
    'BCA Prime loves you! ❤️',
    'Aww, sending good vibes! 🌸',
    'You make study fun! ✨'
  ];

  const DRAG_QUOTES = [
    'Where are we going? 👀',
    'Wohooo! 🚀',
    'Wheee, flying! ✨',
    'Taking the scenic route! 🧭'
  ];

  /* ------------------------------------------------------------
     DOM Element References & Internal State
     ------------------------------------------------------------ */
  let mascotEl = null;
  let speechBubbleEl = null;
  let introModalEl = null;
  let actionPillEl = null;
  let actionPillBackdropEl = null;

  // In-memory session state for temporary hiding (never overwrites permanent localStorage setting)
  let isTemporarilyHiddenForSession = false;

  let isDragging = false;
  let wasDragged = false;
  let isFlinging = false;
  let isRoaming = false;
  let isNapping = false;
  let autoRoamEnabled = true;

  let currentMood = 'normal'; // 'normal' | 'dragging' | 'dizzy' | 'napping' | 'love'
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
  let loveTimer = null;
  let wheeeTimer = null;
  let blinkTimer = null;
  let waveTimer = null;

  // Rapid-tap combo tracking (3+ taps within 900ms triggers Wheee Spin!)
  let consecutiveTapsCount = 0;
  let lastTapTimestamp = 0;

  // Shake detection state (at least 4 sharp reversals within 450ms)
  let shakeHistory = [];
  let lastShakeX = 0;
  let lastShakeY = 0;
  let lastShakeDirX = 0;
  let lastShakeDirY = 0;

  // Non-repeating quote pickers
  let lastDizzyQuoteIndex = -1;
  let lastWheeeQuoteIndex = -1;
  let lastLoveQuoteIndex = -1;
  let lastDragQuoteIndex = -1;

  // Directional Drag Velocity & Inverse Air-Drag State
  let lastDragPointerX = 0;
  let lastDragPointerY = 0;
  let dragSmoothVx = 0;
  let dragSmoothVy = 0;
  let accumulatedDragDist = 0;
  let dragStartTime = 0;
  let hasTriggeredDragQuoteThisGesture = false;

  // Continuous Uninterrupted Wheee Spin State (rAF Driven)
  let isWheeeSpinning = false;
  let isWheeeDecelerating = false;
  let wheeeAngle = 0;
  let wheeeAngularVelocity = 0;
  let wheeeRafId = null;
  let wheeeDecelCooldownTimer = null;
  let lastWheeeFrameTime = 0;

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
     Helper: Viewport Boundaries & Non-Repeating Quote Pickers
     ------------------------------------------------------------ */
  function getMaxX() {
    return Math.max(0, (window.innerWidth || document.documentElement.clientWidth || 360) - MASCOT_SIZE);
  }

  function getMaxY() {
    return Math.max(0, (window.innerHeight || document.documentElement.clientHeight || 640) - MASCOT_SIZE);
  }

  function getRandomDizzyQuote() {
    let idx;
    do {
      idx = Math.floor(Math.random() * DIZZY_QUOTES.length);
    } while (idx === lastDizzyQuoteIndex && DIZZY_QUOTES.length > 1);
    lastDizzyQuoteIndex = idx;
    return DIZZY_QUOTES[idx];
  }

  function getRandomWheeeQuote() {
    let idx;
    do {
      idx = Math.floor(Math.random() * WHEEE_QUOTES.length);
    } while (idx === lastWheeeQuoteIndex && WHEEE_QUOTES.length > 1);
    lastWheeeQuoteIndex = idx;
    return WHEEE_QUOTES[idx];
  }

  function getRandomLoveQuote() {
    let idx;
    do {
      idx = Math.floor(Math.random() * LOVE_QUOTES.length);
    } while (idx === lastLoveQuoteIndex && LOVE_QUOTES.length > 1);
    lastLoveQuoteIndex = idx;
    return LOVE_QUOTES[idx];
  }

  function getRandomDragQuote() {
    let idx;
    do {
      idx = Math.floor(Math.random() * DRAG_QUOTES.length);
    } while (idx === lastDragQuoteIndex && DRAG_QUOTES.length > 1);
    lastDragQuoteIndex = idx;
    return DRAG_QUOTES[idx];
  }

  /* ------------------------------------------------------------
     Dashboard Greeting Synchronization & Anti-Repeat Rule
     ------------------------------------------------------------ */
  function getStudentName() {
    // 1. Try reading directly from hero greeting element populated by app.js
    const heroGreetEl = document.getElementById('heroGreetName');
    if (heroGreetEl && heroGreetEl.textContent) {
      const text = heroGreetEl.textContent.trim();
      const match = text.match(/Good\s+(?:Morning|Afternoon|Evening|Night),\s*([^!]+)!/i);
      if (match && match[1]) {
        const extracted = match[1].trim();
        if (extracted && extracted.toLowerCase() !== 'there') {
          return extracted.split(' ')[0];
        }
      }
    }

    // 2. Try window.accountSession or global accountSession
    try {
      const session = window.accountSession || (typeof accountSession !== 'undefined' ? accountSession : null);
      if (session) {
        if (session.displayName && session.displayName.trim()) {
          return session.displayName.trim().split(' ')[0];
        }
        if (session.user_metadata && session.user_metadata.full_name) {
          return session.user_metadata.full_name.trim().split(' ')[0];
        }
      }
    } catch (_e) {}

    // 3. Try localStorage 'bca-username'
    try {
      const stored = localStorage.getItem('bca-username');
      if (stored && stored.trim()) {
        return stored.trim().split(' ')[0];
      }
    } catch (_e) {}

    // 4. Try parsing Supabase auth token in localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const item = JSON.parse(localStorage.getItem(key) || '{}');
          const user = item.user || (item.session && item.session.user);
          if (user) {
            const rawName = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name || user.user_metadata.username)) || user.displayName;
            if (rawName && rawName.trim()) return rawName.trim().split(' ')[0];
            if (user.email) {
              const local = user.email.split('@')[0];
              return local.charAt(0).toUpperCase() + local.slice(1);
            }
          }
        }
      }
    } catch (_e) {}

    return '';
  }

  function getCurrentTimeSlot() {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) {
      return { slot: 'morning', prefix: 'Good Morning', emoji: '☀️' };
    }
    if (hour >= 12 && hour < 17) {
      return { slot: 'afternoon', prefix: 'Good Afternoon', emoji: '☀️' };
    }
    if (hour >= 17 && hour < 21) {
      return { slot: 'evening', prefix: 'Good Evening', emoji: '✨' };
    }
    return { slot: 'night', prefix: 'Good Night', emoji: '🌙' };
  }

  function triggerSmartGreeting() {
    if (!isBuddyVisible()) return;

    const timeInfo = getCurrentTimeSlot();
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentSlotKey = `${dateStr}_${timeInfo.slot}`;

    const lastSlotKey = localStorage.getItem(STORAGE_KEY_GREET_SLOT);
    const studentName = getStudentName();

    // First open in that time-of-day period: Greet with time-of-day + name!
    if (lastSlotKey !== currentSlotKey) {
      localStorage.setItem(STORAGE_KEY_GREET_SLOT, currentSlotKey);

      const greetText = studentName
        ? `${timeInfo.prefix}, ${studentName}! ${timeInfo.emoji}`
        : `${timeInfo.prefix}! ${timeInfo.emoji}`;

      triggerFriendlyWave(2000);
      showBubble(greetText, 3500);
    } else {
      // 2nd, 3rd, or subsequent opens within the SAME period: Warm return greetings
      const returnGreetings = studentName ? [
        `Welcome back, ${studentName}! 👋`,
        `Good to see you again, ${studentName}! 🚀`,
        `Back for another study session, ${studentName}? 📚`,
        `Hey ${studentName}, ready when you are! ✨`
      ] : [
        'Welcome back! 👋',
        'Good to see you again! 🚀',
        'Back for another study session? 📚',
        'Hey, ready when you are! ✨'
      ];

      let lastReturnIdx = -1;
      try {
        lastReturnIdx = parseInt(sessionStorage.getItem(SESSION_KEY_RETURN_IDX) || '-1', 10);
      } catch (_e) {}

      let nextIdx;
      do {
        nextIdx = Math.floor(Math.random() * returnGreetings.length);
      } while (nextIdx === lastReturnIdx && returnGreetings.length > 1);

      try {
        sessionStorage.setItem(SESSION_KEY_RETURN_IDX, String(nextIdx));
      } catch (_e) {}

      const returnText = returnGreetings[nextIdx];
      triggerFriendlyWave(1600);
      showBubble(returnText, 3000);
    }
  }

  /* ------------------------------------------------------------
     Organic Lifelike Micro-Behaviors:
     - Randomized natural blinking (2.2s to 6.5s) with cute double-blinks
     - Hand wave reaction
     ------------------------------------------------------------ */
  function scheduleNextBlink() {
    if (blinkTimer) clearTimeout(blinkTimer);
    // Organic randomized interval between 2.2s and 6.5s
    const nextDelay = 2200 + Math.random() * 4300;
    blinkTimer = setTimeout(performOrganicBlink, nextDelay);
  }

  function performOrganicBlink() {
    if (!mascotEl || isNapping || currentMood === 'dizzy' || isDragging || !isBuddyVisible()) {
      scheduleNextBlink();
      return;
    }

    mascotEl.classList.add('is-blinking');

    setTimeout(() => {
      if (mascotEl) mascotEl.classList.remove('is-blinking');

      // 28% chance of cute double-blink! (140ms apart)
      if (Math.random() < 0.28) {
        setTimeout(() => {
          if (!mascotEl || isNapping || currentMood === 'dizzy' || isDragging) return;
          mascotEl.classList.add('is-blinking');
          setTimeout(() => {
            if (mascotEl) mascotEl.classList.remove('is-blinking');
            scheduleNextBlink();
          }, 110);
        }, 140);
      } else {
        scheduleNextBlink();
      }
    }, 120);
  }

  function triggerFriendlyWave(duration = 1600) {
    if (!mascotEl) return;
    if (waveTimer) clearTimeout(waveTimer);
    mascotEl.classList.add('is-waving');
    waveTimer = setTimeout(() => {
      if (mascotEl) mascotEl.classList.remove('is-waving');
    }, duration);
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
        <g class="buddy-eye-socket" transform-origin="24 28">
          <ellipse cx="24" cy="28" rx="5.6" ry="6.4" fill="#ffffff" stroke="#1e1b4b" stroke-width="1.3"/>
          <g class="buddy-dizzy-spiral-l" transform-origin="24 28">
            <path d="M24,28 A1.5,1.5 0 0,1 25.5,28 A2.8,2.8 0 0,1 22.5,29.5 A4,4 0 0,1 21,26.5 A5.2,5.2 0 0,1 26,24.5" fill="none" stroke="#1e1b4b" stroke-width="2" stroke-linecap="round"/>
            <circle cx="24" cy="28" r="1.6" fill="#f43f5e"/>
          </g>
        </g>
        <g class="buddy-eye-socket" transform-origin="38 28">
          <ellipse cx="38" cy="28" rx="5.6" ry="6.4" fill="#ffffff" stroke="#1e1b4b" stroke-width="1.3"/>
          <g class="buddy-dizzy-spiral-r" transform-origin="38 28">
            <path d="M38,28 A1.5,1.5 0 0,1 39.5,28 A2.8,2.8 0 0,1 36.5,29.5 A4,4 0 0,1 35,26.5 A5.2,5.2 0 0,1 40,24.5" fill="none" stroke="#1e1b4b" stroke-width="2" stroke-linecap="round"/>
            <circle cx="38" cy="28" r="1.6" fill="#f43f5e"/>
          </g>
        </g>
      `;
      mouthSvg = `<path d="M26,38 Q29,41 32,38 T38,38" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>`;
    } else if (mood === 'love') {
      // Heart Eyes Morph + Sweet Smile
      eyesSvg = `
        <!-- Left Heart Eye -->
        <g class="buddy-eye-socket" transform-origin="24 28">
          <ellipse cx="24" cy="28" rx="5.2" ry="5.8" fill="#ffffff"/>
          <path d="M 24,28.8 C 24,27.2 21.2,24.8 19.4,26.2 C 17.6,27.6 18.2,30.2 24,33.2 C 29.8,30.2 30.4,27.6 28.6,26.2 C 26.8,24.8 24,27.2 24,28.8 Z" fill="url(#buddyHeartEyeGrad)" stroke="#ffffff" stroke-width="0.6"/>
          <circle cx="22.2" cy="27.4" r="0.75" fill="#ffffff"/>
        </g>
        <!-- Right Heart Eye -->
        <g class="buddy-eye-socket" transform-origin="38 28">
          <ellipse cx="38" cy="28" rx="5.2" ry="5.8" fill="#ffffff"/>
          <path d="M 38,28.8 C 38,27.2 35.2,24.8 33.4,26.2 C 31.6,27.6 32.2,30.2 38,33.2 C 43.8,30.2 44.4,27.6 42.6,26.2 C 40.8,24.8 38,27.2 38,28.8 Z" fill="url(#buddyHeartEyeGrad)" stroke="#ffffff" stroke-width="0.6"/>
          <circle cx="36.2" cy="27.4" r="0.75" fill="#ffffff"/>
        </g>
      `;
      mouthSvg = `<path d="M26,35.5 Q31,40 36,35.5" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>`;
      // Floating Pink Hearts Rising Above Crown
      extraOverlays = `
        <g class="buddy-floating-hearts" transform="translate(32, 10)">
          <path class="buddy-floating-heart heart-p-1" d="M 0,-1 C 0,-2.5 -2.5,-3.2 -3.2,-1.8 C -3.8,-0.4 -2.5,1.2 0,2.8 C 2.5,1.2 3.8,-0.4 3.2,-1.8 C 2.5,-3.2 0,-2.5 0,-1 Z" fill="#f43f5e"/>
          <path class="buddy-floating-heart heart-p-2" d="M 0,-1 C 0,-2.5 -2.5,-3.2 -3.2,-1.8 C -3.8,-0.4 -2.5,1.2 0,2.8 C 2.5,1.2 3.8,-0.4 3.2,-1.8 C 2.5,-3.2 0,-2.5 0,-1 Z" fill="#ec4899"/>
          <path class="buddy-floating-heart heart-p-3" d="M 0,-1.2 C 0,-3 -3,-3.8 -3.8,-2.2 C -4.5,-0.5 -3,1.5 0,3.4 C 3,1.5 4.5,-0.5 3.8,-2.2 C 3,-3.8 0,-3 0,-1.2 Z" fill="#fb7185"/>
          <path class="buddy-floating-heart heart-p-4" d="M 0,-0.8 C 0,-2 -2,-2.5 -2.5,-1.4 C -3,-0.3 -2,0.9 0,2.2 C 2,0.9 3,-0.3 2.5,-1.4 C 2,-2.5 0,-2 0,-0.8 Z" fill="#f43f5e"/>
        </g>
      `;
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
      // Playfully Lifted / Excited Eyes & Surprised "o" Mouth
      eyesSvg = `
        <g class="buddy-eye buddy-eye-left" transform-origin="24 28">
          <ellipse cx="24" cy="28" rx="5.4" ry="6" fill="#ffffff"/>
          <ellipse class="buddy-pupil" cx="${24 + eyeDx}" cy="28" rx="3.4" ry="3.6" fill="#0f172a"/>
          <ellipse class="buddy-pupil" cx="${24 + eyeDx}" cy="28" rx="2.3" ry="2.2" fill="#0284c7"/>
          <circle class="buddy-pupil" cx="${25.6 + eyeDx}" cy="26.3" r="1.6" fill="#ffffff"/>
          <circle class="buddy-pupil" cx="${23 + eyeDx}" cy="29.7" r="0.8" fill="#ffffff"/>
        </g>
        <g class="buddy-eye buddy-eye-right" transform-origin="38 28">
          <ellipse cx="38" cy="28" rx="5.4" ry="6" fill="#ffffff"/>
          <ellipse class="buddy-pupil" cx="${38 + eyeDx}" cy="28" rx="3.4" ry="3.6" fill="#0f172a"/>
          <ellipse class="buddy-pupil" cx="${38 + eyeDx}" cy="28" rx="2.3" ry="2.2" fill="#0284c7"/>
          <circle class="buddy-pupil" cx="${39.6 + eyeDx}" cy="26.3" r="1.6" fill="#ffffff"/>
          <circle class="buddy-pupil" cx="${37 + eyeDx}" cy="29.7" r="0.8" fill="#ffffff"/>
        </g>
      `;
      // Cute Surprised / Excited "o" mouth (matching reference screenshot)
      mouthSvg = `
        <g class="buddy-drag-mouth">
          <ellipse cx="31" cy="37.2" rx="3.2" ry="4" fill="#0f172a" stroke="#ffffff" stroke-width="1.3"/>
          <ellipse cx="31" cy="39.2" rx="1.8" ry="1.2" fill="#f43f5e"/>
        </g>
      `;
    } else {
      // Normal Happy Mascot Eyes (Direction-Aware & Organic Blinking)
      eyesSvg = `
        <g class="buddy-eye buddy-eye-left" transform-origin="24 28">
          <ellipse cx="24" cy="28" rx="4.8" ry="5.4" fill="#ffffff"/>
          <ellipse class="buddy-pupil" cx="${24 + eyeDx}" cy="28" rx="3" ry="3.2" fill="#0f172a"/>
          <ellipse class="buddy-pupil" cx="${24 + eyeDx}" cy="28.5" rx="2" ry="1.8" fill="#0284c7"/>
          <circle class="buddy-pupil" cx="${25.2 + eyeDx}" cy="26.8" r="1.3" fill="#ffffff"/>
          <circle class="buddy-pupil" cx="${23 + eyeDx}" cy="29.2" r="0.7" fill="#ffffff"/>
        </g>
        <g class="buddy-eye buddy-eye-right" transform-origin="38 28">
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
          <!-- Heart Eye Glowing Gradient -->
          <linearGradient id="buddyHeartEyeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fda4af"/>
            <stop offset="35%" stop-color="#f43f5e"/>
            <stop offset="100%" stop-color="#e11d48"/>
          </linearGradient>
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

          <!-- Subtle Cute Stubby Feet / Legs Under "B" Body -->
          <g class="buddy-feet">
            <g class="buddy-foot buddy-foot-left">
              <ellipse cx="23.5" cy="52.8" rx="3.4" ry="2.2" fill="url(#buddyHandGrad)"/>
              <path d="M21.5,51.8 C22.8,51.2 24.8,51.4 25.5,52.4" stroke="rgba(255,255,255,0.4)" stroke-width="0.8" stroke-linecap="round" fill="none"/>
            </g>
            <g class="buddy-foot buddy-foot-right">
              <ellipse cx="37.5" cy="52.8" rx="3.4" ry="2.2" fill="url(#buddyHandGrad)"/>
              <path d="M35.5,51.8 C36.8,51.2 38.8,51.4 39.5,52.4" stroke="rgba(255,255,255,0.4)" stroke-width="0.8" stroke-linecap="round" fill="none"/>
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

          <!-- Cheek Blushes (Rosier during Love mood) -->
          <ellipse cx="19" cy="35" rx="${mood === 'love' ? '4' : '3.2'}" ry="${mood === 'love' ? '2.2' : '1.8'}" fill="#f43f5e" opacity="${mood === 'love' ? '0.7' : '0.45'}"/>
          <ellipse cx="43" cy="35" rx="${mood === 'love' ? '4' : '3.2'}" ry="${mood === 'love' ? '2.2' : '1.8'}" fill="#f43f5e" opacity="${mood === 'love' ? '0.7' : '0.45'}"/>

          <!-- Expressive Eyes -->
          ${eyesSvg}

          <!-- Expressive Mouth -->
          ${mouthSvg}

          <!-- Floating Overlays (zZz particles or Floating Hearts) -->
          ${extraOverlays}

          <!-- Orbiting Dizzy Stars (in dizzy mood) -->
          ${crownSparkles}

          <!-- Bursting Sparkles (for Wheee Spin) -->
          <g class="buddy-sparkle-burst">
            <polygon points="14,9 15.2,11.8 18,13 15.2,14.2 14,17 12.8,14.2 10,13 12.8,11.8" fill="#fbbf24"/>
            <polygon points="50,9 51.2,11.8 54,13 51.2,14.2 50,17 48.8,14.2 46,13 48.8,11.8" fill="#38bdf8"/>
            <polygon points="6,34 7.2,36.8 10,38 7.2,39.2 6,42 4.8,39.2 2,38 4.8,36.8" fill="#fef08a"/>
            <polygon points="58,34 59.2,36.8 62,38 59.2,39.2 58,42 56.8,39.2 54,38 56.8,36.8" fill="#f43f5e"/>
            <polygon points="20,50 21,52 23,53 21,54 20,56 19,54 17,53 19,52" fill="#38bdf8"/>
            <polygon points="44,50 45,52 47,53 45,54 44,56 43,54 41,53 43,52" fill="#fbbf24"/>
          </g>

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

  function isBuddyVisible() {
    return isBuddyEnabled() && !isTemporarilyHiddenForSession;
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

  /* Edge-Clamped Speech Bubble */
  function showBubble(text, duration = 2500) {
    if (!speechBubbleEl || !mascotEl) return;
    // Strictly lock speech bubble to "Wheee! ✨" without interruption while spinning
    if (isWheeeSpinning && text !== 'Wheee! ✨') return;
    speechBubbleEl.textContent = text;

    // Dynamically clamp speech bubble within viewport edges
    const screenW = window.innerWidth || 360;
    mascotEl.classList.toggle('bubble-below', currentY < 48);
    mascotEl.classList.toggle('bubble-align-left', currentX < 24);
    mascotEl.classList.toggle('bubble-align-right', currentX > screenW - MASCOT_SIZE - 24);

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
      mascotEl.classList.toggle('is-in-love', mood === 'love');
    }
  }

  function triggerDizzyState(duration = 3000) {
    setMascotMood('dizzy');
    const quote = getRandomDizzyQuote();
    showBubble(quote, duration);
    triggerHaptic(25);

    if (dizzyRecoverTimer) clearTimeout(dizzyRecoverTimer);
    dizzyRecoverTimer = setTimeout(() => {
      setMascotMood('normal');
      showBubble('All good now! ✨', 1800);
    }, duration);
  }

  /* ------------------------------------------------------------
     Playful Tap Reactions:
     1. Heart-Eyes Love Reaction (😍 + Floating Hearts)
     2. Rapid-Tap Combo Spin (Wheee! ✨ + 720° Spin + Sparkles)
     3. Happy Hop Bounce
     ------------------------------------------------------------ */
  function triggerLoveReaction(duration = 2000) {
    if (currentMood === 'dizzy') return;
    setMascotMood('love');
    triggerHaptic(18);
    if (navigator.vibrate) {
      try { navigator.vibrate([15, 60, 20]); } catch (_e) {}
    }

    const quote = getRandomLoveQuote();
    showBubble(quote, duration);

    if (loveTimer) clearTimeout(loveTimer);
    loveTimer = setTimeout(() => {
      if (currentMood === 'love') setMascotMood('normal');
    }, duration);
    resetIdleTimer();
  }

  /* ------------------------------------------------------------
     Continuous Uninterrupted Wheee Spin (rAF Angular Velocity)
     - 3+ rapid taps starts continuous spin
     - Each additional tap smoothly adds spin momentum without resetting angle
     - Strictly locks speech bubble to "Wheee! ✨" without text flickering
     - Decelerates smoothly to upright after 700ms without taps
     ------------------------------------------------------------ */
  function triggerContinuousWheeeSpin() {
    if (currentMood === 'dizzy') return;
    if (currentMood === 'love') setMascotMood('normal');

    isWheeeSpinning = true;
    isWheeeDecelerating = false;
    wheeeAngularVelocity = 1260; // Initial ~3.5 rotations/sec

    if (mascotEl) mascotEl.classList.add('is-doing-wheee');

    // Strictly lock pill text to "Wheee! ✨"
    lockWheeeBubble();

    triggerHaptic(25);
    if (navigator.vibrate) {
      try { navigator.vibrate([15, 40, 20]); } catch (_e) {}
    }

    resetWheeeDecelCooldown();

    if (!wheeeRafId) {
      lastWheeeFrameTime = performance.now();
      wheeeRafId = requestAnimationFrame(stepContinuousWheeeSpin);
    }
    resetIdleTimer();
  }

  function boostContinuousWheeeSpin() {
    // Add extra spin momentum smoothly without resetting or interrupting rotation
    wheeeAngularVelocity = Math.min(2520, wheeeAngularVelocity + 540);
    isWheeeDecelerating = false;

    triggerHaptic(18);
    lockWheeeBubble();
    resetWheeeDecelCooldown();
    resetIdleTimer();
  }

  function resetWheeeDecelCooldown() {
    if (wheeeDecelCooldownTimer) clearTimeout(wheeeDecelCooldownTimer);
    // User must stop tapping for 700ms before deceleration starts
    wheeeDecelCooldownTimer = setTimeout(() => {
      isWheeeDecelerating = true;
    }, 700);
  }

  function lockWheeeBubble() {
    if (!speechBubbleEl || !mascotEl) return;
    speechBubbleEl.textContent = 'Wheee! ✨';

    const screenW = window.innerWidth || 360;
    mascotEl.classList.toggle('bubble-below', currentY < 48);
    mascotEl.classList.toggle('bubble-align-left', currentX < 24);
    mascotEl.classList.toggle('bubble-align-right', currentX > screenW - MASCOT_SIZE - 24);

    speechBubbleEl.classList.add('visible');
    if (bubbleTimeout) clearTimeout(bubbleTimeout);
  }

  function stepContinuousWheeeSpin(now) {
    if (!isWheeeSpinning) {
      wheeeRafId = null;
      return;
    }

    const dt = Math.min(0.064, (now - lastWheeeFrameTime) / 1000);
    lastWheeeFrameTime = now;

    const bodyEl = mascotEl ? mascotEl.querySelector('.prime-buddy-body') : null;

    if (isWheeeDecelerating) {
      // Smooth deceleration friction
      wheeeAngularVelocity *= Math.pow(0.92, dt * 60);

      if (wheeeAngularVelocity < 140) {
        // Find nearest upright orientation (multiple of 360deg)
        const targetAngle = Math.ceil(wheeeAngle / 360) * 360;
        const remainingAngle = targetAngle - wheeeAngle;

        if (remainingAngle <= 2.5 || wheeeAngularVelocity < 20) {
          // Completed spin: cleanly restore upright orientation
          stopContinuousWheeeSpin();
          return;
        }

        // Smooth ease toward upright target
        wheeeAngle += Math.max(1.2, remainingAngle * 0.16);
      } else {
        wheeeAngle += wheeeAngularVelocity * dt;
      }
    } else {
      // Active continuous spin
      wheeeAngle += wheeeAngularVelocity * dt;
    }

    if (bodyEl) {
      const hop = isWheeeDecelerating ? 0 : (Math.sin((wheeeAngle * Math.PI) / 180) * 4 - 6);
      bodyEl.style.transform = `translate3d(0, ${hop.toFixed(1)}px, 0) rotate(${(wheeeAngle % 360000).toFixed(1)}deg)`;
    }

    wheeeRafId = requestAnimationFrame(stepContinuousWheeeSpin);
  }

  function stopContinuousWheeeSpin() {
    isWheeeSpinning = false;
    isWheeeDecelerating = false;
    wheeeAngle = 0;
    wheeeAngularVelocity = 0;

    if (wheeeRafId) {
      cancelAnimationFrame(wheeeRafId);
      wheeeRafId = null;
    }
    if (wheeeDecelCooldownTimer) {
      clearTimeout(wheeeDecelCooldownTimer);
      wheeeDecelCooldownTimer = null;
    }

    const bodyEl = mascotEl ? mascotEl.querySelector('.prime-buddy-body') : null;
    if (bodyEl) bodyEl.style.transform = '';
    if (mascotEl) mascotEl.classList.remove('is-doing-wheee');

    if (bubbleTimeout) clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => {
      if (speechBubbleEl) speechBubbleEl.classList.remove('visible');
    }, 600);
    resetIdleTimer();
  }

  const triggerWheeeReaction = triggerContinuousWheeeSpin;

  function triggerBounceReaction() {
    triggerHaptic(12);

    mascotEl.classList.remove('is-doing-bounce');
    void mascotEl.offsetWidth; // Force reflow
    mascotEl.classList.add('is-doing-bounce');
    setTimeout(() => {
      if (mascotEl) mascotEl.classList.remove('is-doing-bounce');
    }, 450);

    const quote = BUDDY_QUOTES[Math.floor(Math.random() * BUDDY_QUOTES.length)];
    showBubble(quote, 2200);
    resetIdleTimer();
  }

  function handleMascotTap() {
    closeActionPill();

    // If currently napping, tap wakes him up!
    if (isNapping) {
      wakeUpMascot();
      return;
    }

    // If mascot is actively doing continuous spin, tap smoothly adds spin momentum!
    if (isWheeeSpinning) {
      boostContinuousWheeeSpin();
      return;
    }

    const now = performance.now();
    if (now - lastTapTimestamp < 900) {
      consecutiveTapsCount++;
    } else {
      consecutiveTapsCount = 1;
    }
    lastTapTimestamp = now;

    // 3 or more rapid taps within 900ms -> Continuous Wheee Spin!
    if (consecutiveTapsCount >= 3) {
      consecutiveTapsCount = 0;
      triggerContinuousWheeeSpin();
    } else if (consecutiveTapsCount === 2) {
      // Double tap -> Heart-Eyes Love Reaction!
      triggerLoveReaction();
    } else {
      // Single tap: alternate/random between Love and Bounce
      if (Math.random() < 0.5) {
        triggerLoveReaction();
      } else {
        triggerBounceReaction();
      }
    }
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
    mascotEl.style.zIndex = '10050'; // Floats above top header and bottom nav
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

    document.body.appendChild(mascotEl);

    restoreMascotPosition();
    initInteractionAndPhysics();
    initIdleDetection();
    createActionPillElement();
    createIntroModalElement();
    updateMascotVisibility();
    startCrownLoop();
    scheduleNextBlink();
  }

  /* Position restoration with full-screen boundary clamps (0px to 100vh) */
  function restoreMascotPosition() {
    const maxX = getMaxX();
    const maxY = getMaxY();

    let x = maxX - 12;
    let y = Math.max(0, maxY - 120);

    const saved = localStorage.getItem(STORAGE_KEY_POS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          x = Math.max(0, Math.min(parsed.x, maxX));
          y = Math.max(0, Math.min(parsed.y, maxY));
        } else if (parsed && typeof parsed.y === 'number') {
          y = Math.max(0, Math.min(parsed.y, maxY));
          x = parsed.edge === 'left' ? 10 : (maxX - 10);
        }
      } catch (_e) {}
    }

    currentX = Math.round(x);
    currentY = Math.round(y);
    currentEdge = currentX < (window.innerWidth || 360) / 2 ? 'left' : 'right';

    mascotEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    mascotEl.classList.toggle('edge-left', currentEdge === 'left');
    mascotEl.classList.toggle('edge-right', currentEdge === 'right');
  }

  /* ------------------------------------------------------------
     Tap & Long-Press Detection + Zero-Lag 1:1 Direct Drag Physics
     ------------------------------------------------------------ */
  function initInteractionAndPhysics() {
    if (!mascotEl) return;

    mascotEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;

      // If mascot is napping, tap wakes him up immediately!
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

      // Clear any remaining CSS transitions for 1:1 instant direct touch tracking
      mascotEl.style.transition = 'none';

      isDragging = true;
      wasDragged = false;
      isLongPressTriggered = false;

      dragStartX = e.clientX;
      dragStartY = e.clientY;
      elemStartX = currentX;
      elemStartY = currentY;

      lastDragPointerX = e.clientX;
      lastDragPointerY = e.clientY;
      dragSmoothVx = 0;
      dragSmoothVy = 0;
      accumulatedDragDist = 0;
      dragStartTime = performance.now();
      hasTriggeredDragQuoteThisGesture = false;

      pointerHistory = [{ x: e.clientX, y: e.clientY, time: performance.now() }];

      // Reset shake reversal tracking
      shakeHistory = [];
      lastShakeX = e.clientX;
      lastShakeY = e.clientY;
      lastShakeDirX = 0;
      lastShakeDirY = 0;

      // Set long-press timer (~400ms hold opens Action Pill)
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        if (isDragging && !wasDragged) {
          if (isWheeeSpinning) {
            stopContinuousWheeeSpin();
          }
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

      // Detect deliberate drag movement (> 5px)
      if (Math.hypot(dx, dy) > 5) {
        wasDragged = true;
        if (isWheeeSpinning) {
          stopContinuousWheeeSpin();
        }
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }

      // If long-press pill opened, lock position
      if (isLongPressTriggered) return;
      if (!wasDragged) return;

      mascotEl.classList.add('is-dragging');
      if (currentMood !== 'dizzy' && currentMood !== 'dragging') {
        setMascotMood('dragging');
      }

      const maxX = getMaxX();
      const maxY = getMaxY();

      // True edge-to-edge full-screen bounds (0px to 100vh)
      currentX = Math.round(Math.max(0, Math.min(elemStartX + dx, maxX)));
      currentY = Math.round(Math.max(0, Math.min(elemStartY + dy, maxY)));

      // ZERO-LAG 1:1 DIRECT DOM UPDATE (no scale/tilt shift, perfectly glued to finger)
      mascotEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;

      // Directional eye glance via CSS class toggle (zero SVG innerHTML re-renders!)
      const isLeft = currentX < (window.innerWidth || 360) / 2;
      mascotEl.classList.toggle('edge-left', isLeft);
      mascotEl.classList.toggle('edge-right', !isLeft);
      currentEdge = isLeft ? 'left' : 'right';

      const now = performance.now();
      pointerHistory.push({ x: e.clientX, y: e.clientY, time: now });
      while (pointerHistory.length > 5 && now - pointerHistory[0].time > 100) {
        pointerHistory.shift();
      }

      // Compute delta from last pointer event for dynamic directional drag physics
      const stepDx = e.clientX - lastDragPointerX;
      const stepDy = e.clientY - lastDragPointerY;
      lastDragPointerX = e.clientX;
      lastDragPointerY = e.clientY;

      // Low-pass filtered velocity for buttery-smooth inverse inertia
      dragSmoothVx = dragSmoothVx * 0.62 + stepDx * 0.38;
      dragSmoothVy = dragSmoothVy * 0.62 + stepDy * 0.38;

      // Directional Inverse Air-Drag & Lag
      // Dragging downward (vy > 0): hands trail upward (-y lag), eyes look down
      // Dragging upward (vy < 0): hands trail downward (+y lag), eyes look up
      // Dragging left/right (vx): body leans into movement (+-10deg tilt), hands & crown trail behind
      const bodyTilt = Math.max(-10, Math.min(10, dragSmoothVx * 1.2));
      const handLagX = Math.max(-5, Math.min(5, -dragSmoothVx * 0.45));
      const handLagY = Math.max(-6, Math.min(6, -dragSmoothVy * 0.5));
      const crownLagX = Math.max(-3, Math.min(3, -dragSmoothVx * 0.25));
      const crownLagY = Math.max(-3.5, Math.min(3.5, -dragSmoothVy * 0.3));
      const feetLagX = Math.max(-2.5, Math.min(2.5, -dragSmoothVx * 0.2));
      const feetLagY = Math.max(-3.5, Math.min(3.5, -dragSmoothVy * 0.35));
      const pupilX = Math.max(-2.5, Math.min(2.5, dragSmoothVx * 0.3));
      const pupilY = Math.max(-2.5, Math.min(2.5, dragSmoothVy * 0.35));

      mascotEl.style.setProperty('--drag-body-tilt', `${bodyTilt.toFixed(1)}deg`);
      mascotEl.style.setProperty('--drag-hand-x', `${handLagX.toFixed(1)}px`);
      mascotEl.style.setProperty('--drag-hand-y', `${handLagY.toFixed(1)}px`);
      mascotEl.style.setProperty('--drag-crown-x', `${crownLagX.toFixed(1)}px`);
      mascotEl.style.setProperty('--drag-crown-y', `${crownLagY.toFixed(1)}px`);
      mascotEl.style.setProperty('--drag-feet-x', `${feetLagX.toFixed(1)}px`);
      mascotEl.style.setProperty('--drag-feet-y', `${feetLagY.toFixed(1)}px`);
      mascotEl.style.setProperty('--drag-pupil-x', `${pupilX.toFixed(1)}px`);
      mascotEl.style.setProperty('--drag-pupil-y', `${pupilY.toFixed(1)}px`);

      // Playful Drag Speech Bubble (Once per sustained medium-speed drag gesture)
      accumulatedDragDist += Math.hypot(stepDx, stepDy);
      const dragElapsed = now - dragStartTime;
      if (!hasTriggeredDragQuoteThisGesture && accumulatedDragDist > 70 && dragElapsed > 200) {
        const currentSpeed = Math.hypot(dragSmoothVx, dragSmoothVy) * 60; // px/sec
        if (currentSpeed > 30 && currentMood !== 'dizzy') {
          hasTriggeredDragQuoteThisGesture = true;
          showBubble(getRandomDragQuote(), 2500);
        }
      }

      // SHAKE DETECTION: At least 4 sharp direction reversals within 450ms
      const moveDx = e.clientX - lastShakeX;
      const moveDy = e.clientY - lastShakeY;

      if (Math.abs(moveDx) > 8) {
        const dirX = Math.sign(moveDx);
        if (lastShakeDirX !== 0 && dirX !== lastShakeDirX) {
          shakeHistory.push(now);
        }
        lastShakeDirX = dirX;
        lastShakeX = e.clientX;
      }

      if (Math.abs(moveDy) > 8) {
        const dirY = Math.sign(moveDy);
        if (lastShakeDirY !== 0 && dirY !== lastShakeDirY) {
          shakeHistory.push(now);
        }
        lastShakeDirY = dirY;
        lastShakeY = e.clientY;
      }

      // Filter reversals older than 450ms
      shakeHistory = shakeHistory.filter(t => now - t <= 450);
      if (shakeHistory.length >= 4 && currentMood !== 'dizzy') {
        shakeHistory = [];
        triggerDizzyState(3200);
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

      // If user was holding for long press, pill is already open
      if (isLongPressTriggered) {
        isLongPressTriggered = false;
        return;
      }

      // 1. If user dragged or flung the mascot
      if (wasDragged) {
        // Clean up directional drag custom properties
        mascotEl.style.removeProperty('--drag-body-tilt');
        mascotEl.style.removeProperty('--drag-hand-x');
        mascotEl.style.removeProperty('--drag-hand-y');
        mascotEl.style.removeProperty('--drag-crown-x');
        mascotEl.style.removeProperty('--drag-crown-y');
        mascotEl.style.removeProperty('--drag-feet-x');
        mascotEl.style.removeProperty('--drag-feet-y');
        mascotEl.style.removeProperty('--drag-pupil-x');
        mascotEl.style.removeProperty('--drag-pupil-y');
        hasTriggeredDragQuoteThisGesture = false;
        accumulatedDragDist = 0;

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
          // Normal drag drop: rest freely right where placed!
          if (currentMood !== 'dizzy' && currentMood !== 'love') setMascotMood('normal');
          settleFreePosition();
        }
        return;
      }

      // 2. Otherwise: Tap Action (Love, Wheee Spin or Bounce!)
      handleMascotTap();
    };

    mascotEl.addEventListener('pointerup', onPointerRelease);
    mascotEl.addEventListener('pointercancel', onPointerRelease);
  }

  /* Settle freely at current coordinates without snapping to screen edge */
  function settleFreePosition() {
    const maxX = getMaxX();
    const maxY = getMaxY();

    currentX = Math.round(Math.max(0, Math.min(currentX, maxX)));
    currentY = Math.round(Math.max(0, Math.min(currentY, maxY)));
    currentEdge = currentX < (window.innerWidth || 360) / 2 ? 'left' : 'right';

    mascotEl.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
    mascotEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;

    setTimeout(() => {
      if (mascotEl) mascotEl.style.transition = '';
    }, 260);

    mascotEl.classList.toggle('edge-left', currentEdge === 'left');
    mascotEl.classList.toggle('edge-right', currentEdge === 'right');

    const bodyEl = mascotEl.querySelector('.prime-buddy-body');
    if (bodyEl) bodyEl.innerHTML = renderMascotBody(currentMood, currentEdge);

    savePosition({ x: currentX, y: currentY, edge: currentEdge });
    resetIdleTimer();
  }

  /* ------------------------------------------------------------
     4-Wall Ricochet Kinetic Physics Loop (True Edge-to-Edge 0px to 100vh)
     ------------------------------------------------------------ */
  function startFlingPhysics(initialVx, initialVy) {
    if (isFlinging) cancelAnimationFrame(flingRafId);
    isFlinging = true;
    mascotEl.classList.add('is-flinging');

    flingVelX = Math.max(-2800, Math.min(2800, initialVx));
    flingVelY = Math.max(-2800, Math.min(2800, initialVy));

    const initialSpeed = Math.hypot(flingVelX, flingVelY);
    // Extreme high-velocity throw candidate for wall slam dizziness
    let isHardFling = initialSpeed > 2600;

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

      const maxX = getMaxX();
      const maxY = getMaxY();

      let hitWall = false;

      // Left Wall Collision (0px)
      if (currentX <= 0) {
        currentX = 0;
        flingVelX = -flingVelX * RESTITUTION;
        hitWall = true;
        currentEdge = 'left';
      }
      // Right Wall Collision (100vw - size)
      else if (currentX >= maxX) {
        currentX = maxX;
        flingVelX = -flingVelX * RESTITUTION;
        hitWall = true;
        currentEdge = 'right';
      }

      // Top Wall Collision (0px - very top edge of screen)
      if (currentY <= 0) {
        currentY = 0;
        flingVelY = -flingVelY * RESTITUTION;
        hitWall = true;
      }
      // Bottom Wall Collision (100vh - size - very bottom edge of screen)
      else if (currentY >= maxY) {
        currentY = maxY;
        flingVelY = -flingVelY * RESTITUTION;
        hitWall = true;
      }

      if (hitWall) {
        triggerHaptic(10);
        // Only trigger dizzy if thrown at extreme speed AND slamming into wall
        if (isHardFling && Math.hypot(flingVelX, flingVelY) > 1700 && currentMood !== 'dizzy') {
          triggerDizzyState(3000);
          isHardFling = false;
        }

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
        if (currentMood !== 'dizzy' && currentMood !== 'love') setMascotMood('normal');
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

    const screenW = window.innerWidth || 360;
    const screenH = window.innerHeight || 640;
    const pillW = 216;
    const pillH = 44;

    // Horizontally center aligned with mascot
    let left = currentX + (MASCOT_SIZE / 2) - (pillW / 2);
    left = Math.max(8, Math.min(left, screenW - pillW - 8));

    // Prefer placing ABOVE mascot; if too close to top edge, place BELOW
    let top = currentY - pillH - 8;
    if (top < 8) {
      top = currentY + MASCOT_SIZE + 8;
    }
    top = Math.max(8, Math.min(top, screenH - pillH - 8));

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

  /* 3. Hide Action (Temporary session-only hide — reappears on refresh/reopen) */
  function hideBuddyAction() {
    closeActionPill();
    isTemporarilyHiddenForSession = true;
    updateMascotVisibility();
    showToast("PrimeBuddy hidden for now — he'll be back next time you open BCAPrime!", 'info');
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

    if (!autoRoamEnabled || isDragging || isFlinging || isNapping || !isBuddyVisible()) return;

    idleTimer = setTimeout(() => {
      startAutonomousRoam();
    }, IDLE_ROAM_DELAY);
  }

  function stopRoaming() {
    isRoaming = false;
    if (roamStepTimer) clearTimeout(roamStepTimer);
    if (mascotEl) {
      mascotEl.classList.remove('is-roaming');
      mascotEl.classList.remove('glance-left', 'glance-right', 'glance-up');
    }
  }

  function startAutonomousRoam() {
    if (!autoRoamEnabled || isRoaming || isDragging || isFlinging || isNapping || !isBuddyVisible()) return;
    isRoaming = true;
    if (mascotEl) mascotEl.classList.add('is-roaming');
    triggerAutonomousRoamStep();
  }

  function triggerAutonomousRoamStep() {
    if (!isRoaming || !autoRoamEnabled || isNapping || !isBuddyVisible()) return;

    const maxX = getMaxX();
    const maxY = getMaxY();

    // 1. Organic Curious Pause & Glances (Look around before stepping)
    const glanceDir = Math.random() < 0.5 ? 'left' : 'right';
    mascotEl.classList.add(`glance-${glanceDir}`);
    setTimeout(() => {
      if (mascotEl) mascotEl.classList.remove('glance-left', 'glance-right');
    }, 1100);

    // 2. Compute gentle curved trajectory (vary distance: short/medium strolls)
    const maxStepX = Math.min(260, maxX * 0.45);
    const maxStepY = Math.min(220, maxY * 0.4);
    const deltaX = (Math.random() * 2 - 1) * maxStepX;
    const deltaY = (Math.random() * 2 - 1) * maxStepY;

    const targetX = Math.round(Math.max(0, Math.min(currentX + deltaX, maxX)));
    const targetY = Math.round(Math.max(0, Math.min(currentY + deltaY, maxY)));

    // Variable duration based on distance travelled (2.4s to 4.2s)
    const dist = Math.hypot(targetX - currentX, targetY - currentY);
    const durationSec = Math.max(2.4, Math.min(4.2, 1.8 + (dist / 180)));

    currentX = targetX;
    currentY = targetY;
    currentEdge = currentX < (window.innerWidth || 360) / 2 ? 'left' : 'right';

    mascotEl.style.transition = `transform ${durationSec.toFixed(2)}s cubic-bezier(0.25, 1, 0.5, 1)`;
    mascotEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;

    mascotEl.classList.toggle('edge-left', currentEdge === 'left');
    mascotEl.classList.toggle('edge-right', currentEdge === 'right');
    savePosition({ x: currentX, y: currentY, edge: currentEdge });

    // 20% chance of a playful micro-reaction upon arrival
    setTimeout(() => {
      if (!isRoaming || !autoRoamEnabled || isNapping || isDragging || isFlinging) return;
      const microRand = Math.random();
      if (microRand < 0.15) {
        triggerFriendlyWave(1500);
      } else if (microRand < 0.3) {
        const quote = BUDDY_QUOTES[Math.floor(Math.random() * BUDDY_QUOTES.length)];
        showBubble(quote, 2500);
      }
    }, durationSec * 1000 + 100);

    // Organic pause duration before next stroll (2s to 5s)
    const pauseDuration = (durationSec * 1000) + 2000 + (Math.random() * 3000);
    roamStepTimer = setTimeout(() => {
      if (mascotEl) mascotEl.style.transition = '';
      if (isRoaming) triggerAutonomousRoamStep();
    }, pauseDuration);
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
          Your interactive campus study companion! Tap me for heart-eyes &amp; sparkles, rapid-tap for a 720° spin, drag me anywhere edge-to-edge, or hold me for actions (Dance, Nap &amp; Hide).
        </p>

        <div class="buddy-intro-features">
          <div class="buddy-intro-feat-row">
            <span class="buddy-feat-icon" style="color:#f43f5e"><i class="fa-solid fa-heart"></i></span>
            <div class="buddy-feat-text">
              <h4>Playful Tap Reactions</h4>
              <p>Heart-eyes love mode, floating hearts, and rapid-tap 720° Wheee spin</p>
            </div>
          </div>
          <div class="buddy-intro-feat-row">
            <span class="buddy-feat-icon"><i class="fa-solid fa-arrows-up-down-left-right"></i></span>
            <div class="buddy-feat-text">
              <h4>Free Roam &amp; 4-Wall Bounce</h4>
              <p>Move anywhere edge-to-edge (0px–100vh) with elastic ricochet momentum</p>
            </div>
          </div>
          <div class="buddy-intro-feat-row">
            <span class="buddy-feat-icon" style="color:#fbbf24"><i class="fa-solid fa-crown"></i></span>
            <div class="buddy-feat-text">
              <h4>3D Volumetric Rotating Crown</h4>
              <p>Continuous 360° rotating golden crown with sparkling jewel tips</p>
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
      showBubble("Hey! I'm PrimeBuddy! Tap me for fun 🚀", 3500);
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
     Settings Synchronization (Permanent ON/OFF)
     ------------------------------------------------------------ */
  function setPrimeBuddyEnabled(enabled, showFeedback = true) {
    localStorage.setItem(STORAGE_KEY_ENABLED, enabled ? 'true' : 'false');
    if (enabled) {
      isTemporarilyHiddenForSession = false; // Reset temporary hide if user explicitly re-enables in settings
    }
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
    const visible = isBuddyVisible();
    syncSettingsCheckboxes(isBuddyEnabled());
    if (mascotEl) {
      mascotEl.classList.toggle('is-hidden', !visible);
      mascotEl.style.display = visible ? 'block' : 'none';
    }
    if (!visible && actionPillEl) {
      closeActionPill();
    }
    if (visible) {
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
  window.triggerPrimeBuddyHide = hideBuddyAction;
  window.triggerPrimeBuddyLove = triggerLoveReaction;
  window.triggerPrimeBuddyWheee = triggerWheeeReaction;
  window.triggerPrimeBuddyGreeting = triggerSmartGreeting;

  window.PrimeBuddy = {
    init,
    toggle: () => setPrimeBuddyEnabled(!isBuddyEnabled()),
    enable: () => setPrimeBuddyEnabled(true),
    disable: () => setPrimeBuddyEnabled(false),
    dance: triggerDanceAction,
    nap: startNap,
    wake: wakeUpMascot,
    hide: hideBuddyAction,
    love: triggerLoveReaction,
    wheee: triggerWheeeReaction,
    greet: triggerSmartGreeting,
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

    // Trigger Smart Time-of-Day Greeting once dashboard initializes
    setTimeout(() => {
      triggerSmartGreeting();
    }, 700);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
