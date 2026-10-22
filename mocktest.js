/* ============================================================
   BCAPrime — mocktest.js
   MCQ Mock Test System & Active Player Engine
   Features:
     - On-the-fly AI Quiz Generation with Daily Quota (Max 3/day)
     - Automatic Backend Failover Wrapper
     - Responsive Player: Countdown Timer, Single-Select Options, Palette
     - Instant Evaluation & Review Solutions Card
     - Supabase user_results persistence
   ============================================================ */
'use strict';

(function () {
  // BCA Standard Curriculum Subjects by Semester
  const BCA_SUBJECTS = {
    1: ['Programming Principles & C', 'Digital Electronics & Computer Architecture', 'Discrete Mathematics', 'Business Communication', 'Environmental Studies'],
    2: ['Data Structures using C', 'Object Oriented Programming with C++', 'Organization Behavior', 'Financial Accounting & Management', 'Mathematics II'],
    3: ['Database Management Systems', 'Computer Networks', 'Java Programming', 'Operating Systems', 'Software Engineering'],
    4: ['Web Technologies & PHP', 'Python Programming', 'Information Security & Cyber Law', 'Design & Analysis of Algorithms', 'Computer Graphics'],
    5: ['Mobile Application Development', 'Cloud Computing', 'Artificial Intelligence', 'Data Mining & Warehousing', 'E-Commerce'],
    6: ['Major Project', 'Machine Learning & Big Data', 'Internet of Things (IoT)', 'Network Security & Cryptography', 'Software Testing & Quality Assurance']
  };

  // State Management
  const mtState = {
    view: 'hub', // 'hub' | 'player' | 'result'
    quizzes: [],
    myResults: [],
    activeQuiz: null,
    activeQuestions: [],
    currentIndex: 0,
    selectedAnswers: {}, // { [questionIndex]: 'A' | 'B' | 'C' | 'D' }
    timerSeconds: 0,
    initialTimerSeconds: 0,
    timerInterval: null,
    timeTakenSeconds: 0,
    quota: {
      used: 0,
      limit: 3,
      remaining: 3,
      resetAt: null
    },
    activeTab: 'all', // 'all' | 'sem' | 'my'
    evalResult: null
  };

  // DOM Helper
  const $id = (id) => document.getElementById(id);

  /* ---- Initialize & Open Mock Test Hub ---- */
  window.openMockTestHub = async function (preferredSubject = '') {
    const modal = $id('mockTestModal');
    if (!modal) return;

    modal.classList.add('open');
    setMtView('hub');

    // Populate semester and subjects in AI generator form
    initAiGeneratorForm(preferredSubject);

    // Fetch daily quota & library mock tests
    await Promise.all([fetchAiQuota(), loadLibraryQuizzes()]);
  };

  window.closeMockTestModal = function () {
    if (mtState.view === 'player') {
      if (!confirm('Are you sure you want to exit? Your test progress will be lost.')) return;
      stopTimer();
    }
    const modal = $id('mockTestModal');
    if (modal) {
      modal.classList.remove('open');
      modal.classList.remove('is-fullscreen');
      const dialog = modal.querySelector('.mt-dialog');
      if (dialog) dialog.classList.remove('is-fullscreen');
    }
    stopTimer();

    // Exit browser fullscreen if active
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
    updateFullscreenButtons();
  };

  /* ---- Fullscreen / Immersive Mode ---- */
  window.toggleMtFullscreen = function () {
    const modal = $id('mockTestModal');
    const dialog = modal ? modal.querySelector('.mt-dialog') : null;
    if (!modal || !dialog) return;

    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || dialog.classList.contains('is-fullscreen'));

    if (!isFs) {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      }
      dialog.classList.add('is-fullscreen');
      modal.classList.add('is-fullscreen');
    } else {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
      dialog.classList.remove('is-fullscreen');
      modal.classList.remove('is-fullscreen');
    }
    updateFullscreenButtons();
  };

  function updateFullscreenButtons() {
    const modal = $id('mockTestModal');
    const dialog = modal ? modal.querySelector('.mt-dialog') : null;
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || (dialog && dialog.classList.contains('is-fullscreen')));

    document.querySelectorAll('#mtFullscreenBtn, .mt-fs-btn').forEach(btn => {
      btn.innerHTML = isFs ? '<i class="fa-solid fa-compress"></i>' : '<i class="fa-solid fa-expand"></i>';
      btn.setAttribute('title', isFs ? 'Exit Full-Screen' : 'Full-Screen Mode');
      btn.setAttribute('aria-label', isFs ? 'Exit Full-Screen' : 'Full-Screen Mode');
    });
  }

  document.addEventListener('fullscreenchange', updateFullscreenButtons);
  document.addEventListener('webkitfullscreenchange', updateFullscreenButtons);

  /* ---- View Switching ---- */
  function setMtView(viewName) {
    mtState.view = viewName;
    const views = ['mtHubView', 'mtPlayerView', 'mtResultView'];
    views.forEach(v => {
      const el = $id(v);
      if (el) el.hidden = (v !== `${viewName === 'hub' ? 'mtHubView' : (viewName === 'player' ? 'mtPlayerView' : 'mtResultView')}`);
    });
  }

  /* ---- AI Generator Form & Quota ---- */
  function initAiGeneratorForm(preferredSubject = '') {
    const semSel = $id('mtAiSem');
    const subSel = $id('mtAiSubject');
    if (!semSel || !subSel) return;

    // Detect user's current semester from app state if available
    const userSem = (typeof state !== 'undefined' && state.sem && state.sem !== 'all') ? parseInt(state.sem, 10) : 3;
    semSel.value = String(userSem);

    updateAiSubjectOptions(userSem, preferredSubject);

    semSel.onchange = function () {
      updateAiSubjectOptions(parseInt(this.value, 10));
    };
  }

  function updateAiSubjectOptions(semester, defaultSubject = '') {
    const subSel = $id('mtAiSubject');
    if (!subSel) return;

    const list = BCA_SUBJECTS[semester] || BCA_SUBJECTS[3];
    subSel.innerHTML = list.map(s => `<option value="${s}" ${s === defaultSubject ? 'selected' : ''}>${s}</option>`).join('') +
      '<option value="__custom">+ Custom / University Subject...</option>';

    subSel.onchange = function () {
      const customWrap = $id('mtAiCustomSubWrap');
      if (customWrap) customWrap.hidden = (this.value !== '__custom');
    };
  }

  async function fetchAiQuota() {
    if (typeof accountSession === 'undefined' || !accountSession || !accountSession.uid) {
      renderQuotaPill({ used: 0, limit: 3, remaining: 3 });
      return;
    }

    try {
      const token = await getAuthToken();
      if (!token) return;

      const endpoint = (typeof AUTH_API !== 'undefined' && AUTH_API.quizQuota) ? AUTH_API.quizQuota : '/api/quiz-quota';
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        mtState.quota = data;
        renderQuotaPill(data);
      }
    } catch (e) {
      console.warn('[MockTest] Quota fetch failed:', e.message);
    }
  }

  function renderQuotaPill(quota) {
    const pill = $id('mtQuotaPill');
    const alertBox = $id('mtQuotaAlert');
    const genBtn = $id('mtGenerateBtn');
    if (!pill) return;

    const used = quota.used || 0;
    const limit = quota.limit || 3;
    const remaining = typeof quota.remaining === 'number' ? quota.remaining : Math.max(0, limit - used);

    pill.innerHTML = `<i class="fa-solid fa-calendar-day"></i> Daily Limit: <strong>${used}/${limit}</strong>`;
    
    if (remaining <= 0) {
      pill.classList.add('limit-reached');
      if (alertBox) {
        alertBox.hidden = false;
        alertBox.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> You have reached your daily limit of ${limit} custom tests. Limit resets at midnight. You can take any library mock tests below without limits!`;
      }
      if (genBtn) genBtn.disabled = true;
    } else {
      pill.classList.remove('limit-reached');
      if (alertBox) alertBox.hidden = true;
      if (genBtn) genBtn.disabled = false;
    }
  }

  /* ---- Library Quizzes Loading ---- */
  async function loadLibraryQuizzes() {
    const grid = $id('mtQuizGrid');
    if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading BCA Mock Tests...</div>';

    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
      if (grid) grid.innerHTML = '<div style="grid-column:1/-1;color:var(--muted)">Database connection unavailable.</div>';
      return;
    }

    try {
      const { data, error } = await supabaseClient
        .from('quizzes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      mtState.quizzes = data || [];
      renderLibraryQuizzes();
    } catch (err) {
      console.warn('[MockTest] Load error:', err.message);
      if (grid) grid.innerHTML = `<div style="grid-column:1/-1;color:var(--muted)">Could not load tests: ${err.message}</div>`;
    }
  }

  window.setMtHubTab = function (tab) {
    mtState.activeTab = tab;
    document.querySelectorAll('.mt-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'my') {
      loadMyResults();
    } else {
      renderLibraryQuizzes();
    }
  };

  function renderLibraryQuizzes() {
    const grid = $id('mtQuizGrid');
    if (!grid) return;

    const query = ($id('mtSearchInput') ? $id('mtSearchInput').value : '').toLowerCase().trim();
    const userSem = (typeof state !== 'undefined' && state.sem && state.sem !== 'all') ? parseInt(state.sem, 10) : 3;

    let list = mtState.quizzes.filter(q => {
      if (mtState.activeTab === 'sem' && Number(q.semester) !== Number(userSem)) return false;
      if (query) {
        const matchTitle = (q.title || '').toLowerCase().includes(query);
        const matchSub = (q.subject || '').toLowerCase().includes(query);
        if (!matchTitle && !matchSub) return false;
      }
      return true;
    });

    if (!list.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px 20px;background:var(--surface-2);border-radius:16px;border:1px dashed var(--line)">
          <i class="fa-solid fa-graduation-cap" style="font-size:32px;color:var(--muted);margin-bottom:10px"></i>
          <h4 style="margin:0 0 6px;color:var(--ink)">No mock tests found</h4>
          <p style="color:var(--muted);font-size:13px;margin:0 0 16px">Create a custom practice test above or search for another subject.</p>
        </div>`;
      return;
    }

    grid.innerHTML = list.map(q => {
      const qCount = q.total_questions || 10;
      const mins = q.time_limit_minutes || 15;
      const isAi = q.is_ai_generated;

      return `
        <div class="mt-quiz-card">
          <div class="mt-card-top">
            <div class="mt-badge-row">
              <span class="mt-badge sem"><i class="fa-solid fa-graduation-cap"></i> Sem ${q.semester}</span>
              ${isAi ? '<span class="mt-badge sem"><i class="fa-solid fa-sliders"></i> Practice Test</span>' : '<span class="mt-badge"><i class="fa-solid fa-check"></i> Standard</span>'}
            </div>
            <h4 class="mt-card-title">${escapeHtml(q.title)}</h4>
            <div class="mt-card-subject">
              <i class="fa-solid fa-book-bookmark" style="color:var(--brand)"></i>
              <span>${escapeHtml(q.subject)}</span>
            </div>
          </div>

          <div>
            <div class="mt-card-meta">
              <span>Questions: <strong>${qCount}</strong></span>
              <span>Time: <strong>${mins} mins</strong></span>
            </div>
            <button class="mt-start-btn" onclick="startQuizById(${q.id})" style="margin-top:12px">
              <i class="fa-solid fa-play"></i> Start Test
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ---- Past Attempts / My Results Tab ---- */
  async function loadMyResults() {
    const grid = $id('mtQuizGrid');
    if (!grid) return;

    if (typeof accountSession === 'undefined' || !accountSession || !accountSession.uid) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px 20px;background:var(--surface-2);border-radius:16px;border:1px dashed var(--line)">
          <i class="fa-solid fa-lock" style="font-size:32px;color:var(--muted);margin-bottom:10px"></i>
          <h4 style="margin:0 0 6px;color:var(--ink)">Login Required</h4>
          <p style="color:var(--muted);font-size:13px;margin:0 0 16px">Log in with your free account to track your mock test scores and review past attempts.</p>
          <button class="primary" onclick="requireAccount('Log in to view your test history.','mocktest')">Log In</button>
        </div>`;
      return;
    }

    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading your past tests...</div>';

    try {
      const { data, error } = await supabaseClient
        .from('user_results')
        .select('*, quizzes(*)')
        .eq('user_id', accountSession.uid)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      mtState.myResults = data || [];

      if (!mtState.myResults.length) {
        grid.innerHTML = `
          <div style="grid-column:1/-1;text-align:center;padding:40px 20px;background:var(--surface-2);border-radius:16px;border:1px dashed var(--line)">
            <i class="fa-solid fa-chart-simple" style="font-size:32px;color:var(--muted);margin-bottom:10px"></i>
            <h4 style="margin:0 0 6px;color:var(--ink)">No tests attempted yet</h4>
            <p style="color:var(--muted);font-size:13px;margin:0">Start a mock test from the "All Tests" tab to evaluate your score!</p>
          </div>`;
        return;
      }

      grid.innerHTML = mtState.myResults.map(res => {
        const quiz = res.quizzes || {};
        const pct = Math.round(res.percentage || 0);
        const dateStr = res.timestamp ? new Date(res.timestamp).toLocaleDateString() : 'Recent';
        const mins = Math.floor((res.time_taken_seconds || 0) / 60);
        const secs = (res.time_taken_seconds || 0) % 60;

        return `
          <div class="mt-quiz-card">
            <div class="mt-card-top">
              <div class="mt-badge-row">
                <span class="mt-badge sem">Sem ${quiz.semester || 'BCA'}</span>
                <span class="mt-badge" style="background:${pct >= 60 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};color:${pct >= 60 ? '#10b981' : '#ef4444'}">
                  Score: ${res.score}/${res.total_questions} (${pct}%)
                </span>
              </div>
              <h4 class="mt-card-title">${escapeHtml(quiz.title || 'Mock Test')}</h4>
              <div class="mt-card-subject">
                <i class="fa-solid fa-clock" style="color:var(--muted)"></i>
                <span>${dateStr} &middot; ${mins}m ${secs}s</span>
              </div>
            </div>

            <div>
              <button class="mt-start-btn" onclick="reviewPastResult(${res.id})" style="margin-top:12px">
                <i class="fa-solid fa-square-poll-vertical"></i> Review Solutions
              </button>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      grid.innerHTML = `<div style="grid-column:1/-1;color:var(--muted)">Could not load history: ${e.message}</div>`;
    }
  }

  /* ---- On-the-Fly Practice Test Generation ---- */
  window.triggerGenerateAiQuiz = async function () {
    // 1. Authenticated user check
    if (typeof accountSession === 'undefined' || !accountSession || !accountSession.uid) {
      if (typeof requireAccount === 'function') {
        requireAccount('Log in to create custom practice tests.', 'mocktest');
      } else {
        alert('Please log in to create practice tests.');
      }
      return;
    }

    // 2. Daily Quota Check
    if (mtState.quota.remaining <= 0) {
      alert('You have reached your daily limit of 3 custom practice tests. Quota resets at midnight!');
      return;
    }

    const btn = $id('mtGenerateBtn');
    const sem = parseInt($id('mtAiSem').value, 10) || 3;
    let subject = $id('mtAiSubject').value;
    if (subject === '__custom') {
      subject = ($id('mtAiCustomSubInput').value || '').trim();
      if (!subject) {
        alert('Please enter your subject name.');
        return;
      }
    }
    const topic = ($id('mtAiTopic') ? $id('mtAiTopic').value : '').trim();
    const count = parseInt($id('mtAiCount') ? $id('mtAiCount').value : '10', 10) || 10;
    const difficulty = $id('mtAiDifficulty') ? $id('mtAiDifficulty').value : 'medium';

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing Test...';

    try {
      const token = await getAuthToken();
      const endpoint = (typeof AUTH_API !== 'undefined' && AUTH_API.generateQuiz) ? AUTH_API.generateQuiz : '/api/generate-quiz';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subject,
          semester: sem,
          topic,
          questionCount: count,
          difficulty
        })
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        if (result.error === 'quota_exceeded') {
          mtState.quota.remaining = 0;
          renderQuotaPill(mtState.quota);
          alert(result.message || 'Daily practice test quota reached! Quota resets at midnight.');
          return;
        }
        throw new Error(result.error || result.message || 'Failed to generate quiz');
      }

      // Update remaining quota
      if (result.quota) {
        mtState.quota = result.quota;
        renderQuotaPill(result.quota);
      }

      // Start the newly generated test immediately!
      startTestWithData(result.quiz, result.questions);
    } catch (err) {
      console.error('[MockTest] Generation Error:', err);
      alert('Could not generate test: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-play"></i> Generate Test';
    }
  };

  /* ---- Start Test (Existing or Generated) ---- */
  window.startQuizById = async function (quizId) {
    if (typeof accountSession === 'undefined' || !accountSession || !accountSession.uid) {
      if (typeof requireAccount === 'function') {
        requireAccount('Log in to start this mock test and save your score.', 'mocktest');
      } else {
        alert('Please log in to start this mock test.');
      }
      return;
    }

    const quiz = mtState.quizzes.find(q => q.id === quizId);
    if (!quiz) return;

    try {
      const { data: questions, error } = await supabaseClient
        .from('questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('id', { ascending: true });

      if (error) throw error;
      if (!questions || !questions.length) {
        alert('This quiz does not have any questions yet.');
        return;
      }

      startTestWithData(quiz, questions);
    } catch (err) {
      alert('Could not start quiz: ' + err.message);
    }
  };

  function startTestWithData(quiz, questions) {
    mtState.activeQuiz = quiz;
    mtState.activeQuestions = questions;
    mtState.currentIndex = 0;
    mtState.selectedAnswers = {};
    mtState.evalResult = null;

    // Time setup
    const mins = quiz.time_limit_minutes || 15;
    mtState.initialTimerSeconds = mins * 60;
    mtState.timerSeconds = mins * 60;
    mtState.timeTakenSeconds = 0;

    // Setup UI
    if ($id('mtPlayerTitle')) $id('mtPlayerTitle').textContent = quiz.title;
    if ($id('mtPlayerSubject')) $id('mtPlayerSubject').textContent = `Semester ${quiz.semester} · ${quiz.subject}`;

    setMtView('player');
    startTimer();
    renderCurrentQuestion();
    renderPalette();
  }

  /* ---- Active Test Player Logic ---- */
  function renderCurrentQuestion() {
    const q = mtState.activeQuestions[mtState.currentIndex];
    if (!q) return;

    const total = mtState.activeQuestions.length;
    const curNum = mtState.currentIndex + 1;

    // Counter & text
    if ($id('mtQCounter')) $id('mtQCounter').textContent = `Question ${curNum} of ${total}`;
    if ($id('mtQText')) $id('mtQText').textContent = q.question_text;

    // Progress bar
    const pct = Math.round((curNum / total) * 100);
    const pFill = $id('mtProgressFill');
    if (pFill) pFill.style.width = `${pct}%`;

    // Options
    const optList = $id('mtOptionsList');
    if (optList) {
      const opts = [
        { key: 'A', text: q.option_a },
        { key: 'B', text: q.option_b },
        { key: 'C', text: q.option_c },
        { key: 'D', text: q.option_d }
      ];

      const userPick = mtState.selectedAnswers[mtState.currentIndex];

      optList.innerHTML = opts.map(o => `
        <div class="mt-opt-card ${userPick === o.key ? 'selected' : ''}" onclick="selectOption('${o.key}')">
          <div class="mt-opt-key">${o.key}</div>
          <div class="mt-opt-text">${escapeHtml(o.text)}</div>
        </div>
      `).join('');
    }

    // Nav buttons
    const prevBtn = $id('mtPrevBtn');
    const nextBtn = $id('mtNextBtn');
    if (prevBtn) prevBtn.disabled = (mtState.currentIndex === 0);
    if (nextBtn) {
      if (curNum === total) {
        nextBtn.innerHTML = '<i class="fa-solid fa-check"></i> Submit Test';
        nextBtn.className = 'mt-nav-btn primary';
      } else {
        nextBtn.innerHTML = 'Next <i class="fa-solid fa-arrow-right"></i>';
        nextBtn.className = 'mt-nav-btn primary';
      }
    }

    renderPalette();
  }

  window.selectOption = function (key) {
    mtState.selectedAnswers[mtState.currentIndex] = key;
    renderCurrentQuestion();
  };

  window.mtNext = function () {
    if (mtState.currentIndex < mtState.activeQuestions.length - 1) {
      mtState.currentIndex++;
      renderCurrentQuestion();
    } else {
      submitActiveTest();
    }
  };

  window.mtPrev = function () {
    if (mtState.currentIndex > 0) {
      mtState.currentIndex--;
      renderCurrentQuestion();
    }
  };

  window.jumpToQuestion = function (idx) {
    if (idx >= 0 && idx < mtState.activeQuestions.length) {
      mtState.currentIndex = idx;
      renderCurrentQuestion();
    }
  };

  window.toggleMtPalette = function () {
    const pal = $id('mtPaletteGrid');
    if (pal) pal.hidden = !pal.hidden;
  };

  function renderPalette() {
    const grid = $id('mtPaletteGrid');
    if (!grid) return;

    grid.innerHTML = mtState.activeQuestions.map((q, i) => {
      const isAnswered = !!mtState.selectedAnswers[i];
      const isCurrent = (i === mtState.currentIndex);
      let cls = 'mt-pal-chip';
      if (isAnswered) cls += ' answered';
      if (isCurrent) cls += ' current';

      return `<button class="${cls}" onclick="jumpToQuestion(${i})">${i + 1}</button>`;
    }).join('');
  }

  /* ---- Countdown Timer Engine ---- */
  function startTimer() {
    stopTimer();
    updateTimerDisplay();

    mtState.timerInterval = setInterval(() => {
      mtState.timerSeconds--;
      mtState.timeTakenSeconds++;
      updateTimerDisplay();

      if (mtState.timerSeconds <= 0) {
        stopTimer();
        alert('Time is up! Your answers are being evaluated.');
        submitActiveTest(true);
      }
    }, 1000);
  }

  function stopTimer() {
    if (mtState.timerInterval) {
      clearInterval(mtState.timerInterval);
      mtState.timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    const timerEl = $id('mtTimerDisplay');
    if (!timerEl) return;

    const mins = Math.floor(Math.max(0, mtState.timerSeconds) / 60);
    const secs = Math.max(0, mtState.timerSeconds) % 60;
    timerEl.innerHTML = `<i class="fa-solid fa-stopwatch"></i> ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (mtState.timerSeconds < 120) {
      timerEl.classList.add('urgent');
    } else {
      timerEl.classList.remove('urgent');
    }
  }

  /* ---- Submit & Instant Evaluation ---- */
  window.submitActiveTest = async function (autoSubmit = false) {
    if (!autoSubmit) {
      const answeredCount = Object.keys(mtState.selectedAnswers).length;
      const totalCount = mtState.activeQuestions.length;
      const unanswered = totalCount - answeredCount;

      let msg = 'Are you ready to submit your test?';
      if (unanswered > 0) {
        msg = `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. Are you sure you want to finish and view your score?`;
      }
      if (!confirm(msg)) return;
    }

    stopTimer();

    // Calculate score
    let score = 0;
    const total = mtState.activeQuestions.length;
    const answersRecord = [];

    mtState.activeQuestions.forEach((q, idx) => {
      const userPick = mtState.selectedAnswers[idx] || null;
      const isCorrect = (userPick === q.correct_answer);
      if (isCorrect) score++;

      answersRecord.push({
        question_id: q.id,
        question_text: q.question_text,
        user_answer: userPick,
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
        explanation: q.explanation || ''
      });
    });

    const percentage = Number(((score / total) * 100).toFixed(2));
    const timeTaken = mtState.timeTakenSeconds;

    mtState.evalResult = {
      score,
      total,
      percentage,
      timeTaken,
      answers: answersRecord,
      quiz: mtState.activeQuiz
    };

    // Render score summary card
    renderScoreSummary(mtState.evalResult);
    setMtView('result');

    // Save result to Supabase
    saveResultToSupabase(score, total, percentage, answersRecord, timeTaken);
  };

  function renderScoreSummary(res) {
    if ($id('mtScoreNum')) $id('mtScoreNum').textContent = `${res.score} / ${res.total}`;
    if ($id('mtScorePct')) $id('mtScorePct').textContent = `${Math.round(res.percentage)}%`;

    const titleEl = $id('mtResultTitle');
    const msgEl = $id('mtResultMsg');

    if (res.percentage >= 80) {
      if (titleEl) titleEl.textContent = 'Outstanding Mastery! 🏆';
      if (msgEl) msgEl.textContent = 'Excellent performance! You demonstrate top-tier grasp of this BCA syllabus.';
    } else if (res.percentage >= 60) {
      if (titleEl) titleEl.textContent = 'Well Done! 👍';
      if (msgEl) msgEl.textContent = 'Good grasp of the concepts! Review the explanations below to turn mistakes into strengths.';
    } else {
      if (titleEl) titleEl.textContent = 'Needs Focused Revision 📚';
      if (msgEl) msgEl.textContent = 'Do not worry — mock tests are for learning! Study the detailed solution explanations below.';
    }

    const mins = Math.floor(res.timeTaken / 60);
    const secs = res.timeTaken % 60;
    const timeStr = `${mins}m ${secs}s`;

    if ($id('mtStatCorrect')) $id('mtStatCorrect').textContent = res.score;
    if ($id('mtStatIncorrect')) $id('mtStatIncorrect').textContent = res.total - res.score;
    if ($id('mtStatTime')) $id('mtStatTime').textContent = timeStr;
    if ($id('mtStatAccuracy')) $id('mtStatAccuracy').textContent = `${Math.round(res.percentage)}%`;

    // Render detailed questions review
    const revContainer = $id('mtReviewQuestionsList');
    if (revContainer) {
      revContainer.innerHTML = res.answers.map((ans, idx) => {
        const q = mtState.activeQuestions[idx];
        const isUserCorrect = ans.is_correct;

        const options = [
          { key: 'A', text: q.option_a },
          { key: 'B', text: q.option_b },
          { key: 'C', text: q.option_c },
          { key: 'D', text: q.option_d }
        ];

        return `
          <div class="mt-review-item">
            <h5 class="mt-review-q-title">
              <span style="color:#818cf8;margin-right:6px">Q${idx + 1}.</span> ${escapeHtml(q.question_text)}
            </h5>

            <div class="mt-review-options">
              ${options.map(opt => {
                let optClass = 'mt-rev-opt';
                let icon = '';

                if (opt.key === ans.correct_answer) {
                  optClass += ' is-correct';
                  icon = '<i class="fa-solid fa-circle-check"></i>';
                } else if (opt.key === ans.user_answer && !isUserCorrect) {
                  optClass += ' user-wrong';
                  icon = '<i class="fa-solid fa-circle-xmark"></i>';
                }

                return `
                  <div class="${optClass}">
                    <span><strong>${opt.key}.</strong> ${escapeHtml(opt.text)}</span>
                    ${icon}
                  </div>
                `;
              }).join('')}
            </div>

            ${ans.explanation ? `
              <div class="mt-explanation-box">
                <strong><i class="fa-solid fa-lightbulb"></i> Explanation:</strong>
                ${escapeHtml(ans.explanation)}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }
  }

  async function saveResultToSupabase(score, total, percentage, answersRecord, timeTaken) {
    if (typeof accountSession === 'undefined' || !accountSession || !accountSession.uid) return;
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return;

    try {
      const quizId = mtState.activeQuiz && mtState.activeQuiz.id ? mtState.activeQuiz.id : null;
      if (!quizId) return;

      await supabaseClient.from('user_results').insert({
        user_id: accountSession.uid,
        quiz_id: quizId,
        score,
        total_questions: total,
        percentage,
        answers: answersRecord,
        time_taken_seconds: timeTaken
      });
    } catch (e) {
      console.warn('[MockTest] Result persistence warning:', e.message);
    }
  }

  /* ---- Retake Test ---- */
  window.retakeActiveTest = function () {
    if (mtState.activeQuiz && mtState.activeQuestions.length) {
      startTestWithData(mtState.activeQuiz, mtState.activeQuestions);
    } else {
      setMtView('hub');
    }
  };

  window.backToMockTestHub = function () {
    stopTimer();
    setMtView('hub');
    fetchAiQuota();
    loadLibraryQuizzes();
  };

  /* Review past result from history */
  window.reviewPastResult = function (resultId) {
    const item = mtState.myResults.find(r => r.id === resultId);
    if (!item) return;

    const answers = Array.isArray(item.answers) ? item.answers : [];
    mtState.activeQuestions = answers.map((a, i) => ({
      id: a.question_id || i,
      question_text: a.question_text || `Question ${i + 1}`,
      option_a: 'A',
      option_b: 'B',
      option_c: 'C',
      option_d: 'D',
      correct_answer: a.correct_answer,
      explanation: a.explanation
    }));

    mtState.evalResult = {
      score: item.score,
      total: item.total_questions,
      percentage: item.percentage,
      timeTaken: item.time_taken_seconds || 0,
      answers,
      quiz: item.quizzes || {}
    };

    renderScoreSummary(mtState.evalResult);
    setMtView('result');
  };

  /* Helper: Get Supabase auth token */
  async function getAuthToken() {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      try {
        const { data } = await supabaseClient.auth.getSession();
        if (data && data.session && data.session.access_token) {
          return data.session.access_token;
        }
      } catch (e) {}
    }
    return '';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Keyboard shortcut listener for options (1,2,3,4 or A,B,C,D)
  window.addEventListener('keydown', (e) => {
    if (mtState.view !== 'player') return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    if (e.key === '1' || e.key === 'a' || e.key === 'A') selectOption('A');
    if (e.key === '2' || e.key === 'b' || e.key === 'B') selectOption('B');
    if (e.key === '3' || e.key === 'c' || e.key === 'C') selectOption('C');
    if (e.key === '4' || e.key === 'd' || e.key === 'D') selectOption('D');
    if (e.key === 'ArrowRight' || e.key === 'Enter') mtNext();
    if (e.key === 'ArrowLeft') mtPrev();
  });

})();
