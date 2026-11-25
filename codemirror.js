/**
 * PrimeCode CodeMirror 6 Editor Engine
 * Full-featured VS Code-style syntax highlighting & code assistance
 * Multi-language support: Python, Java, C/C++, PHP, MySQL, HTML, CSS, JavaScript
 */

import { EditorView, basicSetup } from 'https://esm.sh/codemirror@6.0.1';
import { EditorState, Compartment } from 'https://esm.sh/@codemirror/state@6.5.2';
import { HighlightStyle, syntaxHighlighting, indentUnit, foldGutter, bracketMatching } from 'https://esm.sh/@codemirror/language@6.10.8';
import { tags } from 'https://esm.sh/@lezer/highlight@1.2.1';
import { keymap } from 'https://esm.sh/@codemirror/view@6.36.4';
import { defaultKeymap, indentWithTab } from 'https://esm.sh/@codemirror/commands@6.8.0';
import { closeBrackets } from 'https://esm.sh/@codemirror/autocomplete@6.18.4';
import { python } from 'https://esm.sh/@codemirror/lang-python@6.1.6';
import { java } from 'https://esm.sh/@codemirror/lang-java@6.0.1';
import { cpp } from 'https://esm.sh/@codemirror/lang-cpp@6.0.2';
import { php } from 'https://esm.sh/@codemirror/lang-php@6.0.1';
import { sql, MySQL } from 'https://esm.sh/@codemirror/lang-sql@6.8.0';
import { html } from 'https://esm.sh/@codemirror/lang-html@6.4.9';
import { css } from 'https://esm.sh/@codemirror/lang-css@6.3.1';
import { javascript } from 'https://esm.sh/@codemirror/lang-javascript@6.2.2';

// 1. Language Extension Loader
function getLanguageExtension(langKey) {
  const k = (langKey || '').toLowerCase();
  switch (k) {
    case 'python':
    case 'py':
      return python();
    case 'java':
      return java();
    case 'c':
    case 'cpp':
    case 'c++':
      return cpp();
    case 'php':
      return php();
    case 'sql':
    case 'mysql':
      return sql({ dialect: MySQL });
    case 'html':
      return html();
    case 'css':
      return css();
    case 'javascript':
    case 'js':
      return javascript();
    default:
      return python();
  }
}

// 2. Rich VS Code-Style Syntax Highlighting (Dark & Light)
const darkHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword, tags.definitionKeyword, tags.moduleKeyword], color: '#60a5fa', fontWeight: '500' },
  { tag: [tags.string, tags.character, tags.special(tags.string)], color: '#34d399' },
  { tag: [tags.typeName, tags.className, tags.standard(tags.typeName)], color: '#22d3ee', fontWeight: '500' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.definition(tags.function(tags.variableName))], color: '#38bdf8' },
  { tag: [tags.number, tags.integer, tags.float, tags.bool, tags.null], color: '#fb923c' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: '#64748b', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#f8fafc' },
  { tag: tags.propertyName, color: '#93c5fd' },
  { tag: [tags.operator, tags.punctuation], color: '#94a3b8' },
  { tag: tags.bracket, color: '#cbd5e1' },
  { tag: tags.invalid, color: '#ef4444', textDecoration: 'underline wavy #ef4444' }
]);

const lightHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword, tags.definitionKeyword, tags.moduleKeyword], color: '#2563eb', fontWeight: '500' },
  { tag: [tags.string, tags.character, tags.special(tags.string)], color: '#059669' },
  { tag: [tags.typeName, tags.className, tags.standard(tags.typeName)], color: '#0891b2', fontWeight: '500' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.definition(tags.function(tags.variableName))], color: '#0284c7' },
  { tag: [tags.number, tags.integer, tags.float, tags.bool, tags.null], color: '#ea580c' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: '#64748b', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#0f172a' },
  { tag: tags.propertyName, color: '#2563eb' },
  { tag: [tags.operator, tags.punctuation], color: '#64748b' },
  { tag: tags.bracket, color: '#475569' },
  { tag: tags.invalid, color: '#dc2626', textDecoration: 'underline wavy #dc2626' }
]);

// 3. Editor Surface Themes (Dark & Light)
const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#080b12',
    color: '#f8fafc',
    height: '100%',
    fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace"
  },
  '.cm-content': {
    paddingBottom: '96px',
    caretColor: '#3b82f6'
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#3b82f6',
    borderLeftWidth: '2px'
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#3b82f6'
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.04)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: '#93c5fd'
  },
  '.cm-gutters': {
    backgroundColor: '#080b12',
    color: '#475569',
    borderRight: '1px solid rgba(255, 255, 255, 0.06)',
    fontFamily: "'Geist Mono', monospace"
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 12px',
    minWidth: '32px'
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    outline: '1px solid #3b82f6',
    color: '#ffffff !important'
  },
  '.cm-nonmatchingBracket': {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    outline: '1px solid #ef4444',
    color: '#f87171 !important'
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(37, 99, 235, 0.35) !important'
  },
  '.cm-scroller': {
    fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace",
    lineHeight: '1.6',
    overflow: 'auto',
    paddingBottom: '96px'
  }
}, { dark: true });

const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    height: '100%',
    fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace"
  },
  '.cm-content': {
    paddingBottom: '96px',
    caretColor: '#2563eb'
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#2563eb',
    borderLeftWidth: '2px'
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#2563eb'
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(0, 0, 0, 0.035)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(0, 0, 0, 0.035)',
    color: '#2563eb'
  },
  '.cm-gutters': {
    backgroundColor: '#f8fafc',
    color: '#94a3b8',
    borderRight: '1px solid #e2e8f0',
    fontFamily: "'Geist Mono', monospace"
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 12px',
    minWidth: '32px'
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    outline: '1px solid #2563eb',
    color: '#1d4ed8 !important'
  },
  '.cm-nonmatchingBracket': {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    outline: '1px solid #dc2626',
    color: '#dc2626 !important'
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(37, 99, 235, 0.18) !important'
  },
  '.cm-scroller': {
    fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace",
    lineHeight: '1.6',
    overflow: 'auto',
    paddingBottom: '96px'
  }
}, { dark: false });

// 4. Compartments for Dynamic Reconfiguration
const languageCompartment = new Compartment();
const themeCompartment = new Compartment();
const highlightCompartment = new Compartment();
const fontSizeCompartment = new Compartment();

let activeView = null;
let currentLanguage = 'python';
let currentFontSize = '13.5px';
let onCodeChangeCallback = null;

function isDarkMode() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ||
         (!document.documentElement.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function createEditor(mountEl, initialCode = '', initialLang = 'python', fontSize = '13.5px', onChange = null) {
  if (activeView) {
    try {
      activeView.destroy();
    } catch (e) {}
    activeView = null;
  }

  currentLanguage = initialLang;
  currentFontSize = fontSize;
  onCodeChangeCallback = onChange;
  const dark = isDarkMode();

  const state = EditorState.create({
    doc: initialCode,
    extensions: [
      basicSetup,
      keymap.of([indentWithTab, ...defaultKeymap]),
      indentUnit.of('    '),
      bracketMatching(),
      closeBrackets(),
      languageCompartment.of(getLanguageExtension(initialLang)),
      themeCompartment.of(dark ? darkTheme : lightTheme),
      highlightCompartment.of(syntaxHighlighting(dark ? darkHighlightStyle : lightHighlightStyle)),
      fontSizeCompartment.of(EditorView.theme({
        '&': { fontSize: currentFontSize }
      })),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newCode = update.state.doc.toString();
          if (typeof onCodeChangeCallback === 'function') {
            onCodeChangeCallback(newCode);
          }
        }
      })
    ]
  });

  activeView = new EditorView({
    state,
    parent: mountEl
  });

  return activeView;
}

function setCode(code) {
  if (!activeView) return;
  const current = activeView.state.doc.toString();
  if (current === code) return;
  activeView.dispatch({
    changes: { from: 0, to: activeView.state.doc.length, insert: code }
  });
}

function getCode() {
  if (!activeView) return '';
  return activeView.state.doc.toString();
}

function setLanguage(langKey) {
  currentLanguage = langKey;
  if (!activeView) return;
  activeView.dispatch({
    effects: languageCompartment.reconfigure(getLanguageExtension(langKey))
  });
}

function setTheme(isDark) {
  if (!activeView) return;
  activeView.dispatch({
    effects: [
      themeCompartment.reconfigure(isDark ? darkTheme : lightTheme),
      highlightCompartment.reconfigure(syntaxHighlighting(isDark ? darkHighlightStyle : lightHighlightStyle))
    ]
  });
}

function setFontSize(fontSize) {
  currentFontSize = fontSize;
  if (!activeView) return;
  activeView.dispatch({
    effects: fontSizeCompartment.reconfigure(EditorView.theme({
      '&': { fontSize: currentFontSize }
    }))
  });
}

function insertSymbolAtCursor(symbol) {
  if (!activeView) return;
  const state = activeView.state;
  const range = state.selection.main;
  let text = symbol;
  let cursorOffset = symbol.length;

  if (symbol === '{ }') {
    text = '{}';
    cursorOffset = 1;
  } else if (symbol === '( )') {
    text = '()';
    cursorOffset = 1;
  } else if (symbol === '[ ]') {
    text = '[]';
    cursorOffset = 1;
  } else if (symbol === '" "') {
    text = '""';
    cursorOffset = 1;
  } else if (symbol === "' '" || symbol === "' ") {
    text = "''";
    cursorOffset = 1;
  } else if (symbol === 'Tab') {
    text = '    ';
    cursorOffset = 4;
  }

  activeView.dispatch({
    changes: { from: range.from, to: range.to, insert: text },
    selection: { anchor: range.from + cursorOffset }
  });
  activeView.focus();
}

function focus() {
  if (activeView) activeView.focus();
}

// Global Export Object
window.PrimeCodeMirror = {
  isReady: true,
  createEditor,
  setCode,
  getCode,
  setLanguage,
  setTheme,
  setFontSize,
  insertSymbolAtCursor,
  focus,
  getView: () => activeView
};

// Listen for system or app theme changes
const themeObserver = new MutationObserver(() => {
  setTheme(isDarkMode());
});
themeObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme']
});

// Dispatch ready event for codelab.js
window.dispatchEvent(new CustomEvent('primecodemirror:ready'));
console.log('[PrimeCode] CodeMirror 6 engine loaded successfully.');
