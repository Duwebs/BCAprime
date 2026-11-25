/**
 * BCAPrime Code Lab (codelab.js)
 * Multi-Language Compiler (C, C++, Java, Python), Web Dev Playground & SQLite Sandbox
 * Mobile-First Responsive Architecture with Tabbed Mobile View & Desktop Split-Screen
 */

(function () {
  'use strict';

  // ---- Starter Templates ----
  const STARTERS = {
    c: `#include <stdio.h>

int main() {
    printf("Welcome to BCAPrime Code Lab! 🚀\\n");
    printf("BCA C Programming Sandbox\\n\\n");
    
    // Sample calculation
    int a = 15, b = 27;
    int sum = a + b;
    printf("Sum of %d and %d is: %d\\n", a, b, sum);
    
    return 0;
}`,
    cpp: `#include <iostream>
#include <vector>
#include <numeric>

using namespace std;

int main() {
    cout << "Welcome to BCAPrime C++ Lab! ⚡\\n";
    
    vector<int> marks = {85, 92, 78, 88, 95};
    int total = accumulate(marks.begin(), marks.end(), 0);
    double avg = (double)total / marks.size();
    
    cout << "Total Marks: " << total << endl;
    cout << "Semester Average: " << avg << "%" << endl;
    
    return 0;
}`,
    java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        System.out.println("Welcome to BCAPrime Java Lab! ☕");
        System.out.println("Object-Oriented Programming for BCA");
        
        String[] subjects = {"Data Structures", "DBMS", "Java OOP", "Computer Networks"};
        System.out.println("\\nCore BCA Subjects:");
        for (int i = 0; i < subjects.length; i++) {
            System.out.println((i + 1) + ". " + subjects[i]);
        }
    }
}`,
    python: `# BCAPrime Python Lab 🐍
def bca_grade_calc(marks):
    avg = sum(marks) / len(marks)
    return avg, "First Class with Distinction" if avg >= 75 else "First Class"

scores = [88, 92, 79, 85, 91]
average, grade = bca_grade_calc(scores)

print("BCAPrime Academic Evaluation:")
print(f"Scores: {scores}")
print(f"Semester Average: {average:.1f}%")
print(f"Award: {grade} 🏆")
`,
    php: `<?php
// BCAPrime PHP Lab 🐘
echo "Welcome to BCAPrime PHP Lab! 🚀\\n";
echo "Server-Side Scripting & Logic for BCA\\n\\n";

$students = [
    ["name" => "Aarav Sharma", "semester" => 3, "score" => 92],
    ["name" => "Priya Patel", "semester" => 3, "score" => 95],
    ["name" => "Rohan Verma", "semester" => 3, "score" => 84]
];

echo "BCA Top Performers:\\n";
foreach ($students as $index => $s) {
    echo ($index + 1) . ". " . $s["name"] . " - Sem " . $s["semester"] . " (" . $s["score"] . "%)\\n";
}
?>`,
    javascript: `// BCAPrime JavaScript & Node.js Lab ⚡
console.log("Welcome to BCAPrime JavaScript Lab! 🚀");
console.log("Modern ES6+ & Node.js Runtime for BCA\\n");

const subjects = [
  { code: 'BCA-301', name: 'Data Structures', credits: 4 },
  { code: 'BCA-302', name: 'Database Management', credits: 4 },
  { code: 'BCA-303', name: 'Web Technology', credits: 3 },
  { code: 'BCA-304', name: 'Python Programming', credits: 3 }
];

console.log("Registered Semester Courses:");
subjects.forEach((subj, idx) => {
  console.log(\`\${idx + 1}. [\${subj.code}] \${subj.name} (\${subj.credits} Credits)\`);
});

const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0);
console.log(\`\\nTotal Semester Credits: \${totalCredits}\`);
`,
    html: `<div class="card">
  <h2>BCAPrime Web Lab 🚀</h2>
  <p>Interactive client-side sandbox for HTML5, CSS3 &amp; JavaScript.</p>
  <button id="counterBtn" class="btn">Clicks: <span id="count">0</span></button>
</div>`,
    css: `body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #0f172a;
  color: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  margin: 0;
  padding: 16px;
  box-sizing: border-box;
}
.card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 16px;
  padding: 24px;
  max-width: 360px;
  width: 100%;
  text-align: center;
  box-shadow: 0 10px 25px rgba(0,0,0,0.3);
}
h2 {
  margin: 0 0 8px;
  font-size: 20px;
  color: #38bdf8;
}
p {
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.5;
  margin: 0 0 20px;
}
.btn {
  background: #2563eb;
  color: #fff;
  border: 0;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 9999px;
  cursor: pointer;
  transition: transform 0.15s, background 0.15s;
}
.btn:hover { background: #1d4ed8; }
.btn:active { transform: scale(0.96); }`,
    js: `let count = 0;
const btn = document.getElementById('counterBtn');
const countSpan = document.getElementById('count');
if (btn && countSpan) {
  btn.addEventListener('click', () => {
    count++;
    countSpan.textContent = count;
  });
}`,
    sql: `-- BCA DBMS Lab: Query all Semester 3 students with high CGPA
SELECT id, name, semester, email, cgpa 
FROM students 
WHERE semester = 3 
ORDER BY cgpa DESC;`
  };

  // SQLite Schema Seed
  const SQL_SEED = `
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  semester INTEGER,
  email TEXT,
  cgpa REAL
);
INSERT INTO students VALUES
  (101, 'Aarav Sharma', 3, 'aarav@bcaprime.edu', 8.9),
  (102, 'Priya Patel', 3, 'priya@bcaprime.edu', 9.2),
  (103, 'Rohan Verma', 2, 'rohan@bcaprime.edu', 7.8),
  (104, 'Sneha Rao', 4, 'sneha@bcaprime.edu', 9.5),
  (105, 'Vikram Singh', 3, 'vikram@bcaprime.edu', 8.1);

CREATE TABLE courses (
  course_code TEXT PRIMARY KEY,
  course_name TEXT,
  semester INTEGER,
  credits INTEGER
);
INSERT INTO courses VALUES
  ('BCA-301', 'Data Structures & Algorithms', 3, 4),
  ('BCA-302', 'Database Management Systems', 3, 4),
  ('BCA-303', 'Computer Networks', 3, 3),
  ('BCA-304', 'Python Programming', 3, 3);
`;

  // Code Lab State
  const state = {
    screen: 'splash', // 'splash' | 'picker' | 'workspace'
    showParentBrand: true, // prop/flag for "from BCAPrime" signature
    splashTimer: null,
    mode: 'compiler', // 'compiler' | 'webdev' | 'sqllab'
    compilerLang: 'python', // 'python' | 'java' | 'c' | 'cpp' | 'php' | 'javascript'
    compilerMobileView: 'editor', // 'editor' | 'console'
    webFile: 'html', // 'html' | 'css' | 'js'
    webMobileView: 'editor', // 'editor' | 'preview'
    sqlMobileView: 'editor', // 'editor' | 'results'
    isExecuting: false,
    stdinOpen: false,
    stdinWarnedOnce: false,
    sqlDb: null,
    sqlJsLoading: false
  };

  // Safe Haptic feedback
  function triggerHaptic(duration = 12) {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(duration);
      }
    } catch (e) {}
  }

  // Toast feedback
  function notify(msg, type = 'info') {
    if (window.BCA_UI && window.BCA_UI.Toast) {
      if (type === 'success') window.BCA_UI.Toast.success(msg);
      else if (type === 'error') window.BCA_UI.Toast.error(msg);
      else window.BCA_UI.Toast.show(msg);
    } else if (typeof window.toast === 'function') {
      window.toast(msg);
    } else {
      console.log('[CodeLab]', msg);
    }
  }

  // LocalStorage keys
  function storageKey(id) {
    return `bcaprime_codelab_${id}`;
  }

  function getSavedCode(lang) {
    try {
      const saved = localStorage.getItem(storageKey(lang));
      if (saved !== null && saved !== undefined) return saved;
    } catch (e) {}
    return STARTERS[lang] || '';
  }

  function saveCode(lang, code) {
    try {
      localStorage.setItem(storageKey(lang), code);
    } catch (e) {}
  }

  // Brand Endorsement Signature Controller
  function setShowParentBrand(val) {
    state.showParentBrand = Boolean(val);
    const endorsement = document.getElementById('primecodeBrandEndorsement');
    if (endorsement) {
      endorsement.style.display = state.showParentBrand ? 'flex' : 'none';
    }
  }

  // PrimeBuddy Mascot Visibility Controller (hides mascot during PrimeCode splash/modal)
  function setPrimeBuddyVisible(visible) {
    const buddyEl = document.querySelector('.prime-buddy-wrap') || document.getElementById('primeBuddy');
    if (buddyEl) {
      if (visible) {
        buddyEl.style.removeProperty('display');
        buddyEl.style.removeProperty('visibility');
        buddyEl.style.removeProperty('opacity');
      } else {
        buddyEl.style.setProperty('display', 'none', 'important');
        buddyEl.style.setProperty('visibility', 'hidden', 'important');
        buddyEl.style.setProperty('opacity', '0', 'important');
      }
    }
  }

  // ---- Screen Transition (Splash -> Picker -> Workspace) ----
  function switchScreen(screen) {
    state.screen = screen;
    const splashEl = document.getElementById('primecodeSplash');
    const pickerEl = document.getElementById('primecodePicker');
    const workspaceEl = document.getElementById('primecodeWorkspace');

    if (state.splashTimer) {
      clearTimeout(state.splashTimer);
      state.splashTimer = null;
    }

    setShowParentBrand(state.showParentBrand);

    if (screen === 'splash') {
      document.body.classList.add('primecode-splash-active');
      setPrimeBuddyVisible(false);
      if (splashEl) {
        splashEl.hidden = false;
        splashEl.classList.remove('fade-out');
        splashEl.style.display = 'flex';
        splashEl.style.opacity = '1';
        splashEl.style.visibility = 'visible';
        splashEl.style.pointerEvents = 'auto';
      }
      if (pickerEl) pickerEl.hidden = true;
      if (workspaceEl) workspaceEl.hidden = true;

      // Automatically transition after ~1.2s (1200ms) with smooth fade
      state.splashTimer = setTimeout(() => {
        if (state.screen === 'splash') {
          if (splashEl) {
            splashEl.classList.add('fade-out');
            setTimeout(() => {
              if (state.screen === 'splash') {
                document.body.classList.remove('primecode-splash-active');
                setPrimeBuddyVisible(true);
                switchScreen('picker');
              }
            }, 240);
          } else {
            document.body.classList.remove('primecode-splash-active');
            setPrimeBuddyVisible(true);
            switchScreen('picker');
          }
        }
      }, 1200);
    } else if (screen === 'picker') {
      document.body.classList.remove('primecode-splash-active');
      setPrimeBuddyVisible(true);
      if (splashEl) {
        splashEl.classList.add('fade-out');
        splashEl.hidden = true;
        splashEl.style.display = 'none';
      }
      if (pickerEl) {
        pickerEl.hidden = false;
        const scrollArea = pickerEl.querySelector('.primecode-picker-scroll');
        if (scrollArea) scrollArea.scrollTop = 0;
      }
      if (workspaceEl) workspaceEl.hidden = true;
    } else if (screen === 'workspace') {
      document.body.classList.remove('primecode-splash-active');
      setPrimeBuddyVisible(true);
      if (splashEl) {
        splashEl.classList.add('fade-out');
        splashEl.hidden = true;
        splashEl.style.display = 'none';
      }
      if (pickerEl) pickerEl.hidden = true;
      if (workspaceEl) workspaceEl.hidden = false;

      // Synchronize current mode & views
      switchMode(state.mode);
    }
  }

  // ---- Open & Close PrimeCode Modal ----
  function openCodeLab(directScreen = 'splash') {
    triggerHaptic(14);
    const modal = document.getElementById('codeLabModal');
    if (!modal) return;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setPrimeBuddyVisible(false);

    switchScreen(directScreen || 'splash');
  }

  function closeCodeLab(syncHistory = true) {
    triggerHaptic(10);
    document.body.classList.remove('primecode-splash-active');
    setPrimeBuddyVisible(true);
    if (state.splashTimer) {
      clearTimeout(state.splashTimer);
      state.splashTimer = null;
    }
    const modal = document.getElementById('codeLabModal');
    if (!modal) return;

    modal.classList.remove('open');
    document.body.style.overflow = '';

    if (syncHistory && (location.hash === '#primecode' || location.hash === '#codelab')) {
      try {
        history.back();
      } catch (e) {
        location.hash = '';
      }
    }
  }

  function openCodeLabRoute() {
    try {
      if (location.hash !== '#primecode') {
        history.pushState(null, '', '#primecode');
      }
    } catch (e) {
      location.hash = '#primecode';
    }
    openCodeLab('splash');
  }

  // Listen to hash changes for browser/Android back button
  window.addEventListener('hashchange', () => {
    if (location.hash === '#primecode' || location.hash === '#codelab') {
      openCodeLab('splash');
    } else {
      const modal = document.getElementById('codeLabModal');
      if (modal && modal.classList.contains('open')) {
        closeCodeLab(false);
      }
    }
  });

  // ---- Mode Switcher ----
  function switchMode(newMode) {
    triggerHaptic(10);
    state.mode = newMode;

    document.querySelectorAll('.codelab-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === newMode);
    });

    const compilerView = document.getElementById('codelabCompilerView');
    const webdevView = document.getElementById('codelabWebdevView');
    const sqlView = document.getElementById('codelabSqlView');

    if (compilerView) compilerView.hidden = newMode !== 'compiler';
    if (webdevView) webdevView.hidden = newMode !== 'webdev';
    if (sqlView) sqlView.hidden = newMode !== 'sqllab';

    if (newMode === 'compiler') {
      renderCompilerCode();
      switchCompilerMobileView(state.compilerMobileView);
    } else if (newMode === 'webdev') {
      renderWebdevCode();
      switchWebMobileView(state.webMobileView);
    } else if (newMode === 'sqllab') {
      renderSqlCode();
      switchSqlMobileView(state.sqlMobileView);
      initSqlDatabase();
    }
  }

  // ---- Line Number Generator ----
  function updateLineNumbers(textareaEl, lineNumbersEl) {
    if (!textareaEl || !lineNumbersEl) return;
    const lines = (textareaEl.value || '').split('\n').length;
    let numbersText = '';
    for (let i = 1; i <= lines; i++) {
      numbersText += i + '\n';
    }
    lineNumbersEl.textContent = numbersText;
    lineNumbersEl.scrollTop = textareaEl.scrollTop;
  }

  // ---- Insert Symbol at Cursor ----
  function insertSymbolAtCursor(textareaEl, symbol) {
    if (!textareaEl) return;
    textareaEl.focus();

    const start = textareaEl.selectionStart || 0;
    const end = textareaEl.selectionEnd || 0;
    const val = textareaEl.value;

    let insertText = symbol;
    let cursorOffset = symbol.length;

    if (symbol === '{ }') {
      insertText = '{\n  \n}';
      cursorOffset = 4;
    } else if (symbol === '( )') {
      insertText = '()';
      cursorOffset = 1;
    } else if (symbol === '[ ]') {
      insertText = '[]';
      cursorOffset = 1;
    } else if (symbol === '" "') {
      insertText = '""';
      cursorOffset = 1;
    } else if (symbol === "' '") {
      insertText = "''";
      cursorOffset = 1;
    } else if (symbol === 'Tab') {
      insertText = '  ';
      cursorOffset = 2;
    }

    textareaEl.value = val.substring(0, start) + insertText + val.substring(end);
    textareaEl.selectionStart = textareaEl.selectionEnd = start + cursorOffset;

    // Trigger input event to update line numbers and auto-save
    textareaEl.dispatchEvent(new Event('input', { bubbles: true }));
    triggerHaptic(10);
  }

  // ---- Mode A: Compiler Logic ----
  function switchCompilerLang(lang) {
    triggerHaptic(10);
    // Save current before switching
    const currentEditor = document.getElementById('codelabCompilerEditor');
    if (currentEditor) {
      saveCode(state.compilerLang, currentEditor.value);
    }

    state.compilerLang = lang;
    document.querySelectorAll('.codelab-lang-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.lang === lang);
    });

    renderCompilerCode();
  }

  function renderCompilerCode() {
    const editor = document.getElementById('codelabCompilerEditor');
    const lineNumbers = document.getElementById('codelabCompilerLines');
    if (!editor || !lineNumbers) return;

    editor.value = getSavedCode(state.compilerLang);
    updateLineNumbers(editor, lineNumbers);
    updateStdinUI(editor.value);
  }

  function switchCompilerMobileView(view) {
    state.compilerMobileView = view;
    triggerHaptic(10);

    const editorToggle = document.getElementById('codelabCompilerEditorToggle');
    const consoleToggle = document.getElementById('codelabCompilerConsoleToggle');
    const editorPane = document.getElementById('codelabCompilerEditorPane');
    const consolePane = document.getElementById('codelabCompilerConsolePane');
    const symbolBar = document.getElementById('codelabCompilerSymbolBar');
    const backToCodeBtn = document.getElementById('codelabBackToCodeBtn');

    if (editorToggle && consoleToggle) {
      editorToggle.classList.toggle('active', view === 'editor');
      consoleToggle.classList.toggle('active', view === 'console');
    }

    if (window.innerWidth < 900) {
      if (view === 'editor') {
        if (editorPane) editorPane.style.display = 'flex';
        if (consolePane) consolePane.style.display = 'none';
        if (symbolBar) symbolBar.style.display = 'flex';
        if (backToCodeBtn) backToCodeBtn.hidden = true;
      } else {
        if (editorPane) editorPane.style.display = 'none';
        if (consolePane) consolePane.style.display = 'flex';
        if (symbolBar) symbolBar.style.display = 'none';
        if (backToCodeBtn) backToCodeBtn.hidden = false;
      }
    } else {
      if (editorPane) editorPane.style.display = 'flex';
      if (consolePane) consolePane.style.display = 'flex';
      if (symbolBar) symbolBar.style.display = 'flex';
      if (backToCodeBtn) backToCodeBtn.hidden = true;
    }
  }

  function setStdinOpen(open, focus = false) {
    state.stdinOpen = open;
    const content = document.getElementById('codelabStdinContent');
    const toggle = document.getElementById('codelabStdinToggle');
    const chevron = document.getElementById('codelabStdinChevron');
    const stdinInput = document.getElementById('codelabCompilerStdin');
    if (content) content.hidden = !open;
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (chevron) {
      chevron.className = open ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
    }
    if (open && focus && stdinInput) {
      setTimeout(() => {
        stdinInput.focus();
        stdinInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }

  function toggleStdin() {
    triggerHaptic(10);
    setStdinOpen(!state.stdinOpen, !state.stdinOpen);
  }

  function detectInputCalls(code) {
    if (!code) return { needsInput: false, keyword: '' };
    const patterns = [
      { regex: /\bScanner\s+[A-Za-z0-9_$]+\s*=\s*new\s+Scanner\s*\(\s*System\.in\s*\)/i, keyword: 'Scanner (System.in)' },
      { regex: /\bScanner\b/, keyword: 'Scanner' },
      { regex: /\bBufferedReader\b/, keyword: 'BufferedReader' },
      { regex: /\bSystem\.in\b/, keyword: 'System.in' },
      { regex: /\bscanf\s*\(/, keyword: 'scanf()' },
      { regex: /\bcin\s*>>/, keyword: 'cin >>' },
      { regex: /\bcin\.get\b/, keyword: 'cin.get()' },
      { regex: /\bgetline\s*\(\s*cin\b/, keyword: 'getline(cin)' },
      { regex: /\binput\s*\(/, keyword: 'input()' },
      { regex: /\braw_input\s*\(/, keyword: 'raw_input()' },
      { regex: /\bgetchar\s*\(/, keyword: 'getchar()' },
      { regex: /\bfgets\s*\(/, keyword: 'fgets()' }
    ];
    for (const p of patterns) {
      if (p.regex.test(code)) {
        return { needsInput: true, keyword: p.keyword };
      }
    }
    return { needsInput: false, keyword: '' };
  }

  function updateStdinUI(code) {
    const wrap = document.getElementById('codelabStdinWrap');
    const badge = document.getElementById('codelabStdinBadge');
    const hint = document.getElementById('codelabStdinHint');
    const stdinInput = document.getElementById('codelabCompilerStdin');
    if (!stdinInput) return;

    const hasInputText = stdinInput.value.trim().length > 0;
    const { needsInput, keyword } = detectInputCalls(code);

    if (badge) {
      if (hasInputText) {
        badge.hidden = false;
        badge.textContent = 'Input Ready';
        badge.style.background = 'rgba(34, 197, 94, 0.2)';
        badge.style.color = '#22c55e';
        badge.style.borderColor = 'rgba(34, 197, 94, 0.4)';
      } else if (needsInput) {
        badge.hidden = false;
        badge.textContent = 'Input Needed';
        badge.style.background = 'rgba(245, 158, 11, 0.2)';
        badge.style.color = '#f59e0b';
        badge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      } else {
        badge.hidden = true;
      }
    }

    if (wrap) {
      wrap.classList.toggle('codelab-stdin-needed', needsInput && !hasInputText);
    }

    if (hint) {
      if (hasInputText) {
        hint.textContent = 'Stdin configured';
      } else if (needsInput) {
        hint.textContent = `${keyword} detected`;
      } else {
        hint.textContent = 'For Scanner, cin, scanf, input()';
      }
    }

    if (needsInput && !hasInputText) {
      stdinInput.placeholder = `Enter program inputs here (one per line, e.g. for ${keyword})...`;
    } else {
      stdinInput.placeholder = 'Enter program inputs here (one per line)...';
    }
  }

  // Compiler Execution Engine (Piston + Wandbox resilient fallback)
  async function runCompilerCode() {
    if (state.isExecuting) return;
    triggerHaptic(15);

    const editor = document.getElementById('codelabCompilerEditor');
    const consoleOutput = document.getElementById('codelabCompilerConsole');
    const statusText = document.getElementById('codelabCompilerStatus');
    const runBtn = document.getElementById('codelabCompilerRunBtn');
    const stdinInput = document.getElementById('codelabCompilerStdin');

    if (!editor || !consoleOutput || !runBtn) return;

    const code = editor.value;
    const stdin = stdinInput ? stdinInput.value : '';
    const hasStdin = stdin.trim().length > 0;
    const lang = state.compilerLang;

    // Save code to localStorage
    saveCode(lang, code);

    // Smart Input Prompt Detection:
    // If code contains input calls and stdin box is empty, automatically expand/focus stdin panel
    const inputCheck = detectInputCalls(code);
    if (inputCheck.needsInput && !hasStdin && !state.stdinWarnedOnce) {
      setStdinOpen(true, true);
      state.stdinWarnedOnce = true;
      triggerHaptic(20);

      if (statusText) {
        statusText.innerHTML = `<span style="color:#f59e0b"><i class="fa-solid fa-triangle-exclamation"></i> Input needed for ${inputCheck.keyword}</span>`;
      }

      consoleOutput.innerHTML = `
<div style="padding:14px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:8px;color:#f59e0b;font-size:13px;line-height:1.5;">
  <div style="font-weight:700;display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:13.5px;">
    <i class="fa-solid fa-triangle-exclamation"></i> Input Required: ${inputCheck.keyword} detected
  </div>
  Your program expects user input from standard input (stdin).<br>
  Please enter your input values (one per line) in the <strong>Custom Input (stdin)</strong> panel below and tap <strong>▶ Run Code</strong>.
</div>`;

      // On mobile, switch to console view so user immediately sees both the prompt and the stdin box right below it
      if (window.innerWidth < 900) {
        switchCompilerMobileView('console');
      }
      return;
    }

    state.stdinWarnedOnce = false;

    // On mobile, switch to console view so user immediately sees execution
    if (window.innerWidth < 900) {
      switchCompilerMobileView('console');
    }

    state.isExecuting = true;
    runBtn.disabled = true;
    runBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Running...</span>';
    if (statusText) statusText.textContent = 'Compiling & executing...';
    consoleOutput.innerHTML = '<span class="codelab-console-info">Connecting to execution engine...</span>\n';

    const startTime = performance.now();

    try {
      // Smart Java filename resolution (matches `public class <ClassName>`, defaults to Main.java)
      let javaFileName = 'Main.java';
      if (lang === 'java') {
        const javaClassMatch = code.match(/public\s+class\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
        if (javaClassMatch && javaClassMatch[1]) {
          javaFileName = `${javaClassMatch[1]}.java`;
        }
      }

      // 1. First attempt: Piston Execution API
      let executionResult = null;

      try {
        const pistonLangs = {
          c: { language: 'c', version: '10.2.0', file: 'main.c' },
          cpp: { language: 'c++', version: '10.2.0', file: 'main.cpp' },
          java: { language: 'java', version: '15.0.2', file: javaFileName },
          python: { language: 'python', version: '3.10.0', file: 'main.py' },
          php: { language: 'php', version: '8.2.3', file: 'main.php' },
          javascript: { language: 'javascript', version: '18.15.0', file: 'main.js' }
        };

        const pistonConfig = pistonLangs[lang] || pistonLangs.c;

        const response = await fetch('https://emkc.org/api/v2/piston/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: pistonConfig.language,
            version: pistonConfig.version,
            files: [{ name: pistonConfig.file, content: code }],
            stdin: stdin
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.run) {
            executionResult = {
              stdout: data.run.stdout || '',
              stderr: (data.compile && data.compile.stderr) || data.run.stderr || '',
              exitCode: data.run.code
            };
          }
        }
      } catch (err) {
        console.warn('[CodeLab] Piston API unavailable, trying Wandbox runner:', err);
      }

      // 2. Resilient Fallback: Wandbox Engine (Free, open & robust for C, C++, Java, Python)
      if (!executionResult) {
        if (statusText) statusText.textContent = 'Executing via live compiler...';
        
        const wandboxCompilers = {
          c: 'gcc-13.2.0-c',
          cpp: 'gcc-13.2.0',
          java: 'openjdk-jdk-21+35',
          python: 'cpython-3.8.20',
          php: 'php-8.3.12',
          javascript: 'nodejs-20.17.0'
        };

        const compilerName = wandboxCompilers[lang] || wandboxCompilers.c;

        const wandboxPayload = {
          compiler: compilerName,
          code: lang === 'java' ? '// BCA Java Runner' : code,
          stdin: stdin
        };

        // For Java on Wandbox: Wandbox default file is prog.java, which causes javac to throw:
        // "class Main is public, should be declared in a file named Main.java".
        // Providing the Java file via `codes` and specifying it in `compiler-option-raw`
        // instructs javac to compile `${javaFileName}` correctly.
        if (lang === 'java') {
          wandboxPayload.codes = [
            {
              file: javaFileName,
              code: code
            }
          ];
          wandboxPayload['compiler-option-raw'] = javaFileName;
        }

        const wandboxRes = await fetch('https://wandbox.org/api/compile.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(wandboxPayload)
        });

        if (wandboxRes.ok) {
          const wData = await wandboxRes.json();
          executionResult = {
            stdout: wData.program_output || '',
            stderr: wData.compiler_error || wData.program_error || '',
            exitCode: parseInt(wData.status || '0', 10)
          };
        } else {
          throw new Error(`Compiler service returned status: ${wandboxRes.status}`);
        }
      }

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

      // Render Console Output
      let html = '';
      if (executionResult.stdout) {
        html += `<span>${escapeHtml(executionResult.stdout)}</span>`;
      }

      if (executionResult.stderr) {
        html += `<span class="codelab-console-error">\n--- Compiler Error / Stderr ---\n${escapeHtml(executionResult.stderr)}</span>`;
        if (
          executionResult.stderr.includes('NoSuchElementException') ||
          executionResult.stderr.includes('EOFError') ||
          (executionResult.stderr.includes('Scanner') && executionResult.stderr.includes('Exception'))
        ) {
          html += `\n<div style="margin-top:10px;padding:10px 12px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);border-radius:6px;color:#f59e0b;font-size:12px;line-height:1.45;">💡 <strong>Input Tip:</strong> Program stopped because it expected user input from <code>Scanner</code> / <code>stdin</code>.<br>Enter your values (e.g. <code>1</code>, <code>2</code>, <code>5</code> on separate lines) in <strong>Custom Input (stdin)</strong> below and tap <strong>Run Code</strong>.</div>`;
          setStdinOpen(true);
        }
      }

      if (!executionResult.stdout && !executionResult.stderr) {
        html += '<span class="codelab-console-info">Program finished with no output. (Exit Code ' + executionResult.exitCode + ')</span>';
      }

      consoleOutput.innerHTML = html;
      if (statusText) {
        const exitColor = executionResult.exitCode === 0 ? '#4ade80' : '#f87171';
        statusText.innerHTML = `Finished in <strong>${elapsed}s</strong> &middot; <span style="color:${exitColor}">Exit code ${executionResult.exitCode}</span>`;
      }

      if (executionResult.exitCode === 0) {
        notify('Program executed successfully! ⚡', 'success');
        // Context-Aware PrimeBuddy celebration reaction for clean code run
        try {
          window.dispatchEvent(new CustomEvent('primebuddy:react', {
            detail: { type: 'celebrate', message: 'Clean code run! ⚡' }
          }));
        } catch (_e) {}
      } else {
        notify('Execution finished with error', 'error');
      }

      // Track Code Lab execution event in analytics
      try {
        if (typeof trackEvent === 'function') {
          trackEvent('codelab_run', {
            title: currentLang,
            type: 'code_execution',
            seconds: parseFloat(elapsed) || 0,
            results: executionResult.exitCode === 0 ? 1 : 0
          });
        }
      } catch (_e) {}

    } catch (error) {
      console.error('[CodeLab] Execution error:', error);
      consoleOutput.innerHTML = `<span class="codelab-console-error">Execution Failed:\n${escapeHtml(error.message || String(error))}</span>`;
      if (statusText) statusText.textContent = 'Execution failed';
      notify('Execution failed: check connection', 'error');
    } finally {
      state.isExecuting = false;
      runBtn.disabled = false;
      runBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span>Run Code</span>';
    }
  }

  // ---- Mode B: Web Dev Logic ----
  function switchWebFile(file) {
    triggerHaptic(10);
    // Save current
    const editor = document.getElementById('codelabWebEditor');
    if (editor) {
      saveCode(state.webFile, editor.value);
    }

    state.webFile = file;
    document.querySelectorAll('.codelab-file-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.file === file);
    });

    renderWebdevCode();
  }

  function renderWebdevCode() {
    const editor = document.getElementById('codelabWebEditor');
    const lineNumbers = document.getElementById('codelabWebLines');
    if (!editor || !lineNumbers) return;

    editor.value = getSavedCode(state.webFile);
    updateLineNumbers(editor, lineNumbers);
  }

  function switchWebMobileView(view) {
    state.webMobileView = view;
    triggerHaptic(10);

    const editorToggle = document.getElementById('codelabWebEditorToggle');
    const previewToggle = document.getElementById('codelabWebPreviewToggle');
    const editorPane = document.getElementById('codelabWebEditorPane');
    const previewPane = document.getElementById('codelabWebPreviewPane');
    const symbolBar = document.getElementById('codelabWebSymbolBar');

    if (editorToggle && previewToggle) {
      editorToggle.classList.toggle('active', view === 'editor');
      previewToggle.classList.toggle('active', view === 'preview');
    }

    if (window.innerWidth < 900) {
      if (view === 'editor') {
        if (editorPane) editorPane.style.display = 'flex';
        if (previewPane) previewPane.style.display = 'none';
        if (symbolBar) symbolBar.style.display = 'flex';
      } else {
        if (editorPane) editorPane.style.display = 'none';
        if (previewPane) previewPane.style.display = 'flex';
        if (symbolBar) symbolBar.style.display = 'none';
        updateWebLivePreview();
      }
    } else {
      if (editorPane) editorPane.style.display = 'flex';
      if (previewPane) previewPane.style.display = 'flex';
      if (symbolBar) symbolBar.style.display = 'flex';
    }
  }

  function updateWebLivePreview() {
    const iframe = document.getElementById('codelabWebPreviewFrame');
    if (!iframe) return;

    // Save current active tab first
    const activeEditor = document.getElementById('codelabWebEditor');
    if (activeEditor) {
      saveCode(state.webFile, activeEditor.value);
    }

    const html = getSavedCode('html');
    const css = getSavedCode('css');
    const js = getSavedCode('js');

    const combinedDoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${css}</style>
        </head>
        <body>
          ${html}
          <script>${js}<\/script>
        </body>
      </html>
    `;

    iframe.srcdoc = combinedDoc;
  }

  // ---- Mode C: SQL Lab Logic ----
  async function initSqlDatabase() {
    const statusEl = document.getElementById('codelabSqlStatus');
    if (state.sqlDb) {
      if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-database" style="color:#4ade80"></i> SQLite 3 Ready';
      return;
    }

    if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Initializing SQLite WASM...';

    try {
      if (typeof window.initSqlJs === 'function') {
        const SQL = await window.initSqlJs({
          locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
        });
        state.sqlDb = new SQL.Database();
        state.sqlDb.run(SQL_SEED);
        if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-database" style="color:#4ade80"></i> SQLite 3 WASM Ready';
        notify('SQLite database pre-seeded with Students & Courses!', 'success');
      } else {
        if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-database" style="color:#38bdf8"></i> SQL Lab Ready';
      }
    } catch (err) {
      console.warn('[CodeLab] sql.js initialization warning:', err);
      if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b"></i> SQL Lab (Offline Mode)';
    }
  }

  function renderSqlCode() {
    const editor = document.getElementById('codelabSqlEditor');
    const lineNumbers = document.getElementById('codelabSqlLines');
    if (!editor || !lineNumbers) return;

    editor.value = getSavedCode('sql');
    updateLineNumbers(editor, lineNumbers);
  }

  function switchSqlMobileView(view) {
    state.sqlMobileView = view;
    triggerHaptic(10);

    const editorToggle = document.getElementById('codelabSqlEditorToggle');
    const resultsToggle = document.getElementById('codelabSqlResultsToggle');
    const editorPane = document.getElementById('codelabSqlEditorPane');
    const resultsPane = document.getElementById('codelabSqlResultsPane');
    const symbolBar = document.getElementById('codelabSqlSymbolBar');
    const backToCodeBtn = document.getElementById('codelabSqlBackToCodeBtn');

    if (editorToggle && resultsToggle) {
      editorToggle.classList.toggle('active', view === 'editor');
      resultsToggle.classList.toggle('active', view === 'results');
    }

    if (window.innerWidth < 900) {
      if (view === 'editor') {
        if (editorPane) editorPane.style.display = 'flex';
        if (resultsPane) resultsPane.style.display = 'none';
        if (symbolBar) symbolBar.style.display = 'flex';
        if (backToCodeBtn) backToCodeBtn.hidden = true;
      } else {
        if (editorPane) editorPane.style.display = 'none';
        if (resultsPane) resultsPane.style.display = 'flex';
        if (symbolBar) symbolBar.style.display = 'none';
        if (backToCodeBtn) backToCodeBtn.hidden = false;
      }
    } else {
      if (editorPane) editorPane.style.display = 'flex';
      if (resultsPane) resultsPane.style.display = 'flex';
      if (symbolBar) symbolBar.style.display = 'flex';
      if (backToCodeBtn) backToCodeBtn.hidden = true;
    }
  }

  function insertSqlQuery(query) {
    triggerHaptic(10);
    const editor = document.getElementById('codelabSqlEditor');
    if (!editor) return;

    editor.value = query;
    saveCode('sql', query);
    updateLineNumbers(editor, document.getElementById('codelabSqlLines'));
    runSqlQuery();
  }

  function resetSqlDb() {
    triggerHaptic(14);
    if (state.sqlDb) {
      try {
        state.sqlDb.close();
      } catch (e) {}
      state.sqlDb = null;
    }
    initSqlDatabase();
    notify('Database reset to fresh sample state!', 'success');
  }

  async function runSqlQuery() {
    triggerHaptic(15);
    const editor = document.getElementById('codelabSqlEditor');
    const resultWrap = document.getElementById('codelabSqlResultWrap');
    const statusText = document.getElementById('codelabSqlMeta');

    if (!editor || !resultWrap) return;

    const query = editor.value.trim();
    if (!query) {
      notify('Please enter a SQL query', 'info');
      return;
    }

    saveCode('sql', query);

    // On mobile, switch to results view
    if (window.innerWidth < 900) {
      switchSqlMobileView('results');
    }

    if (!state.sqlDb) {
      await initSqlDatabase();
    }

    const startTime = performance.now();

    try {
      if (state.sqlDb) {
        const results = state.sqlDb.exec(query);
        const elapsed = ((performance.now() - startTime)).toFixed(1);

        if (!results || results.length === 0) {
          resultWrap.innerHTML = `
            <div style="padding: 18px; color: #4ade80; text-align: center; font-family: 'JetBrains Mono', monospace;">
              <i class="fa-solid fa-circle-check"></i> Query executed successfully. (0 rows returned in ${elapsed}ms)
            </div>
          `;
          if (statusText) statusText.textContent = `Executed in ${elapsed}ms`;
          notify('SQL query executed successfully!', 'success');
          return;
        }

        const firstResult = results[0];
        const columns = firstResult.columns;
        const values = firstResult.values;

        let tableHtml = '<table class="codelab-data-table"><thead><tr>';
        columns.forEach(col => {
          tableHtml += `<th>${escapeHtml(col)}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        values.forEach(row => {
          tableHtml += '<tr>';
          row.forEach(cell => {
            tableHtml += `<td>${cell === null ? '<em style="color:#64748b">NULL</em>' : escapeHtml(String(cell))}</td>`;
          });
          tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';

        resultWrap.innerHTML = tableHtml;
        if (statusText) {
          statusText.innerHTML = `Returned <strong>${values.length} rows</strong> in ${elapsed}ms`;
        }
        notify(`Returned ${values.length} rows`, 'success');
      } else {
        resultWrap.innerHTML = `
          <div style="padding: 16px; color: #38bdf8; text-align: center;">
            <p><strong>Query received:</strong> <code>${escapeHtml(query)}</code></p>
            <p style="color:#94a3b8; font-size:12px;">SQLite engine is loading or running in offline mock mode.</p>
          </div>
        `;
      }
    } catch (err) {
      console.error('[CodeLab] SQL Query Error:', err);
      resultWrap.innerHTML = `
        <div style="padding: 16px; color: #f87171; font-family: 'JetBrains Mono', monospace;">
          <strong><i class="fa-solid fa-triangle-exclamation"></i> SQL Error:</strong><br>
          ${escapeHtml(err.message || String(err))}
        </div>
      `;
      if (statusText) statusText.textContent = 'Query failed';
      notify('SQL syntax error', 'error');
    }
  }

  // ---- Extra Actions: Copy Code & Reset ----
  async function copyCurrentCode() {
    triggerHaptic(12);
    let codeToCopy = '';

    if (state.mode === 'compiler') {
      const editor = document.getElementById('codelabCompilerEditor');
      codeToCopy = editor ? editor.value : '';
    } else if (state.mode === 'webdev') {
      const editor = document.getElementById('codelabWebEditor');
      codeToCopy = editor ? editor.value : '';
    } else if (state.mode === 'sqllab') {
      const editor = document.getElementById('codelabSqlEditor');
      codeToCopy = editor ? editor.value : '';
    }

    if (!codeToCopy) {
      notify('No code to copy', 'info');
      return;
    }

    try {
      await navigator.clipboard.writeText(codeToCopy);
      notify('Code copied to clipboard! 📋', 'success');
    } catch (e) {
      notify('Failed to copy code', 'error');
    }
  }

  function resetCurrentCode() {
    triggerHaptic(14);
    if (state.mode === 'compiler') {
      const lang = state.compilerLang;
      saveCode(lang, STARTERS[lang]);
      renderCompilerCode();
      notify(`Reset ${lang.toUpperCase()} starter template`, 'info');
    } else if (state.mode === 'webdev') {
      const file = state.webFile;
      saveCode(file, STARTERS[file]);
      renderWebdevCode();
      updateWebLivePreview();
      notify(`Reset ${file.toUpperCase()} file template`, 'info');
    } else if (state.mode === 'sqllab') {
      saveCode('sql', STARTERS.sql);
      renderSqlCode();
      notify('Reset sample SQL query', 'info');
    }
  }

  function clearConsoleOutput() {
    triggerHaptic(10);
    const consoleOutput = document.getElementById('codelabCompilerConsole');
    if (consoleOutput) {
      consoleOutput.innerHTML = '<span class="codelab-console-info">Console cleared. Ready to run code.</span>';
    }
    const statusText = document.getElementById('codelabCompilerStatus');
    if (statusText) statusText.textContent = 'Ready';
  }

  // Helper: HTML Escaping
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Debounced auto-save on input
  function setupEditorListeners(editorId, lineNumbersId, getLangKey, onChangeCallback) {
    const editor = document.getElementById(editorId);
    const lineNumbers = document.getElementById(lineNumbersId);
    if (!editor) return;

    let debounceTimer = null;

    editor.addEventListener('input', () => {
      updateLineNumbers(editor, lineNumbers);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        saveCode(getLangKey(), editor.value);
        if (typeof onChangeCallback === 'function') onChangeCallback();
      }, 300);
    });

    editor.addEventListener('scroll', () => {
      if (lineNumbers) lineNumbers.scrollTop = editor.scrollTop;
    });

    // Support Tab indentation
    editor.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        insertSymbolAtCursor(editor, '  ');
      }
    });
  }

  // ---- Initialize Event Handlers ----
  function initCodeLab() {
    // Mode switcher buttons
    document.querySelectorAll('.codelab-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });

    // Compiler language pills
    document.querySelectorAll('.codelab-lang-pill').forEach(pill => {
      pill.addEventListener('click', () => switchCompilerLang(pill.dataset.lang));
    });

    // Compiler mobile view toggle buttons
    const compEditorToggle = document.getElementById('codelabCompilerEditorToggle');
    if (compEditorToggle) compEditorToggle.addEventListener('click', () => switchCompilerMobileView('editor'));

    const compConsoleToggle = document.getElementById('codelabCompilerConsoleToggle');
    if (compConsoleToggle) compConsoleToggle.addEventListener('click', () => switchCompilerMobileView('console'));

    const backToCodeBtn = document.getElementById('codelabBackToCodeBtn');
    if (backToCodeBtn) backToCodeBtn.addEventListener('click', () => switchCompilerMobileView('editor'));

    // Web dev file tabs
    document.querySelectorAll('.codelab-file-tab').forEach(tab => {
      tab.addEventListener('click', () => switchWebFile(tab.dataset.file));
    });

    // Web dev mobile view buttons
    const webEditorToggle = document.getElementById('codelabWebEditorToggle');
    if (webEditorToggle) webEditorToggle.addEventListener('click', () => switchWebMobileView('editor'));

    const webPreviewToggle = document.getElementById('codelabWebPreviewToggle');
    if (webPreviewToggle) webPreviewToggle.addEventListener('click', () => switchWebMobileView('preview'));

    // SQL mobile view toggle buttons
    const sqlEditorToggle = document.getElementById('codelabSqlEditorToggle');
    if (sqlEditorToggle) sqlEditorToggle.addEventListener('click', () => switchSqlMobileView('editor'));

    const sqlResultsToggle = document.getElementById('codelabSqlResultsToggle');
    if (sqlResultsToggle) sqlResultsToggle.addEventListener('click', () => switchSqlMobileView('results'));

    const sqlBackToCodeBtn = document.getElementById('codelabSqlBackToCodeBtn');
    if (sqlBackToCodeBtn) sqlBackToCodeBtn.addEventListener('click', () => switchSqlMobileView('editor'));

    // Quick symbol toolbars
    document.querySelectorAll('.codelab-sym-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const symbol = btn.dataset.sym || btn.textContent.trim();
        let targetTextarea = null;

        if (state.mode === 'compiler') {
          targetTextarea = document.getElementById('codelabCompilerEditor');
        } else if (state.mode === 'webdev') {
          targetTextarea = document.getElementById('codelabWebEditor');
        } else if (state.mode === 'sqllab') {
          targetTextarea = document.getElementById('codelabSqlEditor');
        }

        if (symbol === 'Clear') {
          if (targetTextarea) {
            targetTextarea.value = '';
            targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } else if (symbol === 'Reset') {
          resetCurrentCode();
        } else {
          insertSymbolAtCursor(targetTextarea, symbol);
        }
      });
    });

    // Setup input listeners for auto-save & line numbers
    setupEditorListeners('codelabCompilerEditor', 'codelabCompilerLines', () => state.compilerLang, () => {
      const ed = document.getElementById('codelabCompilerEditor');
      if (ed) updateStdinUI(ed.value);
    });
    setupEditorListeners('codelabWebEditor', 'codelabWebLines', () => state.webFile, () => updateWebLivePreview());
    setupEditorListeners('codelabSqlEditor', 'codelabSqlLines', () => 'sql');

    // Stdin live detection listener
    const stdinInput = document.getElementById('codelabCompilerStdin');
    if (stdinInput) {
      stdinInput.addEventListener('input', () => {
        state.stdinWarnedOnce = false;
        const ed = document.getElementById('codelabCompilerEditor');
        if (ed) updateStdinUI(ed.value);
      });
    }

    // Action buttons
    const runBtn = document.getElementById('codelabCompilerRunBtn');
    if (runBtn) runBtn.addEventListener('click', runCompilerCode);

    const webRunBtn = document.getElementById('codelabWebRunBtn');
    if (webRunBtn) webRunBtn.addEventListener('click', () => {
      triggerHaptic(12);
      updateWebLivePreview();
      notify('Live preview refreshed! ⚡', 'success');
    });

    const sqlRunBtn = document.getElementById('codelabSqlRunBtn');
    if (sqlRunBtn) sqlRunBtn.addEventListener('click', runSqlQuery);

    const stdinToggle = document.getElementById('codelabStdinToggle');
    if (stdinToggle) stdinToggle.addEventListener('click', toggleStdin);

    const clearConsoleBtn = document.getElementById('codelabClearConsoleBtn');
    if (clearConsoleBtn) clearConsoleBtn.addEventListener('click', clearConsoleOutput);

    const copyBtn = document.getElementById('codelabCopyBtn');
    if (copyBtn) copyBtn.addEventListener('click', copyCurrentCode);

    const resetBtn = document.getElementById('codelabResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetCurrentCode);

    // Workspace Back Button: returns to PrimeCode Language Picker
    const backBtn = document.getElementById('codelabBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        triggerHaptic(10);
        switchScreen('picker');
      });
    }

    // Step 1: PrimeCode Splash Tap to Skip
    const splashEl = document.getElementById('primecodeSplash');
    if (splashEl) {
      splashEl.addEventListener('click', () => {
        triggerHaptic(10);
        switchScreen('picker');
      });
    }

    // Step 2: Language Picker Back Button (returns to Study Desk)
    const pickerBackBtn = document.getElementById('primecodePickerBackBtn');
    if (pickerBackBtn) {
      pickerBackBtn.addEventListener('click', () => {
        triggerHaptic(10);
        closeCodeLab(true);
      });
    }

    // Step 2: Language Picker Cards (1 per row)
    document.querySelectorAll('.primecode-lang-card').forEach(card => {
      card.addEventListener('click', () => {
        triggerHaptic(12);
        const target = card.dataset.cardLang;
        if (target === 'sqllab') {
          switchMode('sqllab');
        } else if (target === 'webdev') {
          switchMode('webdev');
        } else {
          // target is c, cpp, java, python, php, or javascript
          state.mode = 'compiler';
          switchCompilerLang(target);
          switchMode('compiler');
        }
        switchScreen('workspace');
      });
    });

    // Step 2: Request a language footer button
    const reqLangBtn = document.getElementById('primecodeRequestLangBtn');
    if (reqLangBtn) {
      reqLangBtn.addEventListener('click', () => {
        triggerHaptic(12);
        if (typeof window.openFeedback === 'function') {
          window.openFeedback();
        } else {
          notify('Request a language: Share what language you need in Feedback!', 'info');
        }
      });
    }

    // Step 2: Open Full Compiler (All Languages) ↗
    const openAllLangsBtn = document.getElementById('primecodeOpenAllLangsBtn');
    if (openAllLangsBtn) {
      openAllLangsBtn.addEventListener('click', () => {
        triggerHaptic(12);
        switchMode('compiler');
        switchScreen('workspace');
      });
    }

    // Handle window resize for mobile vs desktop layout
    window.addEventListener('resize', () => {
      if (state.mode === 'compiler') {
        switchCompilerMobileView(state.compilerMobileView);
      } else if (state.mode === 'webdev') {
        switchWebMobileView(state.webMobileView);
      } else if (state.mode === 'sqllab') {
        switchSqlMobileView(state.sqlMobileView);
      }
    });

    // Check if initial hash is #primecode or #codelab
    if (location.hash === '#primecode' || location.hash === '#codelab') {
      openCodeLab('splash');
    }
  }

  // Export functions to window
  window.openCodeLab = openCodeLab;
  window.closeCodeLab = closeCodeLab;
  window.openCodeLabRoute = openCodeLabRoute;
  window.switchPrimeCodeScreen = switchScreen;
  window.setShowParentBrand = setShowParentBrand;
  window.switchCodeLabMode = switchMode;
  window.switchCompilerMobileView = switchCompilerMobileView;
  window.switchWebMobileView = switchWebMobileView;
  window.switchSqlMobileView = switchSqlMobileView;
  window.insertSqlQuery = insertSqlQuery;
  window.resetSqlDb = resetSqlDb;

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCodeLab);
  } else {
    initCodeLab();
  }

})();
