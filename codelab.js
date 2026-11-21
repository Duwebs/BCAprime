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
    mode: 'compiler', // 'compiler' | 'webdev' | 'sqllab'
    compilerLang: 'c', // 'c' | 'cpp' | 'java' | 'python'
    compilerMobileView: 'editor', // 'editor' | 'console'
    webFile: 'html', // 'html' | 'css' | 'js'
    webMobileView: 'editor', // 'editor' | 'preview'
    sqlMobileView: 'editor', // 'editor' | 'results'
    isExecuting: false,
    stdinOpen: false,
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

  // ---- Open & Close Code Lab ----
  function openCodeLab() {
    triggerHaptic(14);
    const modal = document.getElementById('codeLabModal');
    if (!modal) return;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Synchronize current mode & views
    switchMode(state.mode);
  }

  function closeCodeLab(syncHistory = true) {
    triggerHaptic(10);
    const modal = document.getElementById('codeLabModal');
    if (!modal) return;

    modal.classList.remove('open');
    document.body.style.overflow = '';

    if (syncHistory && location.hash === '#codelab') {
      try {
        history.back();
      } catch (e) {
        location.hash = '';
      }
    }
  }

  function openCodeLabRoute() {
    try {
      if (location.hash !== '#codelab') {
        history.pushState(null, '', '#codelab');
      }
    } catch (e) {
      location.hash = '#codelab';
    }
    openCodeLab();
  }

  // Listen to hash changes for browser/Android back button
  window.addEventListener('hashchange', () => {
    if (location.hash === '#codelab') {
      openCodeLab();
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

  function toggleStdin() {
    triggerHaptic(10);
    state.stdinOpen = !state.stdinOpen;
    const content = document.getElementById('codelabStdinContent');
    const chevron = document.getElementById('codelabStdinChevron');
    if (content) content.hidden = !state.stdinOpen;
    if (chevron) {
      chevron.className = state.stdinOpen ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
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
    const lang = state.compilerLang;

    // Save code to localStorage
    saveCode(lang, code);

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
      // 1. First attempt: Piston Execution API
      let executionResult = null;

      try {
        const pistonLangs = {
          c: { language: 'c', version: '10.2.0', file: 'main.c' },
          cpp: { language: 'c++', version: '10.2.0', file: 'main.cpp' },
          java: { language: 'java', version: '15.0.2', file: 'Main.java' },
          python: { language: 'python', version: '3.10.0', file: 'main.py' }
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
          python: 'cpython-3.12.7'
        };

        const compilerName = wandboxCompilers[lang] || wandboxCompilers.c;

        const wandboxRes = await fetch('https://wandbox.org/api/compile.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            compiler: compilerName,
            code: code,
            stdin: stdin
          })
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
      } else {
        notify('Execution finished with error', 'error');
      }

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
    setupEditorListeners('codelabCompilerEditor', 'codelabCompilerLines', () => state.compilerLang);
    setupEditorListeners('codelabWebEditor', 'codelabWebLines', () => state.webFile, () => updateWebLivePreview());
    setupEditorListeners('codelabSqlEditor', 'codelabSqlLines', () => 'sql');

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

    const backBtn = document.getElementById('codelabBackBtn');
    if (backBtn) backBtn.addEventListener('click', () => closeCodeLab(true));

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

    // Check if initial hash is #codelab
    if (location.hash === '#codelab') {
      openCodeLab();
    }
  }

  // Export functions to window
  window.openCodeLab = openCodeLab;
  window.closeCodeLab = closeCodeLab;
  window.openCodeLabRoute = openCodeLabRoute;
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
