/**
 * PrimeCode CodeMirror 6 Editor Engine
 * Full-featured VS Code-style syntax highlighting & code assistance
 * Multi-language support: Python, Java, C/C++, PHP, MySQL, HTML, CSS, JavaScript
 */

import {
  EditorView,
  keymap,
  highlightSpecialChars,
  drawSelection,
  highlightActiveLine,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  lineNumbers,
  highlightActiveLineGutter
} from 'https://esm.sh/@codemirror/view@6.36.4';

import {
  EditorState,
  Compartment
} from 'https://esm.sh/@codemirror/state@6.5.2';

import {
  syntaxHighlighting,
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentUnit,
  HighlightStyle
} from 'https://esm.sh/@codemirror/language@6.10.8';

import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab
} from 'https://esm.sh/@codemirror/commands@6.8.0';

import {
  searchKeymap,
  highlightSelectionMatches
} from 'https://esm.sh/@codemirror/search@6.5.8';

import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap
} from 'https://esm.sh/@codemirror/autocomplete@6.18.4';

import { tags } from 'https://esm.sh/@lezer/highlight@1.2.1';

// Pinned language extensions sharing single state/view/language instances
import { python } from 'https://esm.sh/@codemirror/lang-python@6.1.6?deps=@codemirror/state@6.5.2,@codemirror/view@6.36.4,@codemirror/language@6.10.8';
import { java } from 'https://esm.sh/@codemirror/lang-java@6.0.1?deps=@codemirror/state@6.5.2,@codemirror/view@6.36.4,@codemirror/language@6.10.8';
import { cpp } from 'https://esm.sh/@codemirror/lang-cpp@6.0.2?deps=@codemirror/state@6.5.2,@codemirror/view@6.36.4,@codemirror/language@6.10.8';
import { php } from 'https://esm.sh/@codemirror/lang-php@6.0.1?deps=@codemirror/state@6.5.2,@codemirror/view@6.36.4,@codemirror/language@6.10.8';
import { sql, MySQL } from 'https://esm.sh/@codemirror/lang-sql@6.8.0?deps=@codemirror/state@6.5.2,@codemirror/view@6.36.4,@codemirror/language@6.10.8';
import { html } from 'https://esm.sh/@codemirror/lang-html@6.4.9?deps=@codemirror/state@6.5.2,@codemirror/view@6.36.4,@codemirror/language@6.10.8';
import { css } from 'https://esm.sh/@codemirror/lang-css@6.3.1?deps=@codemirror/state@6.5.2,@codemirror/view@6.36.4,@codemirror/language@6.10.8';
import { javascript } from 'https://esm.sh/@codemirror/lang-javascript@6.2.2?deps=@codemirror/state@6.5.2,@codemirror/view@6.36.4,@codemirror/language@6.10.8';

// 1. Language Extension Loader (Maps all 8 BCA languages)
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

// 2. Vibrant VS Code-Style Syntax Highlighting (Dark & Light)
const darkHighlightStyle = HighlightStyle.define([
  // Keywords (royal/sky blue)
  { tag: [tags.keyword, tags.operatorKeyword, tags.definitionKeyword, tags.moduleKeyword], color: '#569cd6', fontWeight: '600' },
  // Control flow keywords (crisp purple)
  { tag: tags.controlKeyword, color: '#c586c0', fontWeight: '600' },
  // Strings & characters (warm amber / emerald)
  { tag: [tags.string, tags.character, tags.special(tags.string)], color: '#ce9178' },
  // Type names, class names, standard types (crisp cyan/teal)
  { tag: [tags.typeName, tags.className, tags.standard(tags.typeName)], color: '#4ec9b0', fontWeight: '500' },
  // Functions & methods (warm gold / sky blue)
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.definition(tags.function(tags.variableName))], color: '#dcdcaa' },
  // Numbers, integers, floats, booleans, null (soft green / orange)
  { tag: [tags.number, tags.integer, tags.float, tags.bool, tags.null], color: '#b5cea8' },
  // Comments (muted green-gray italics)
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: '#6a9955', fontStyle: 'italic' },
  // Variables & identifiers (light sky blue / clean white)
  { tag: [tags.variableName, tags.definition(tags.variableName)], color: '#9cdcfe' },
  // Properties & attributes (sky blue)
  { tag: [tags.propertyName, tags.attributeName], color: '#9cdcfe' },
  // HTML / XML tag names (royal blue)
  { tag: tags.tagName, color: '#569cd6', fontWeight: '500' },
  // Operators & punctuation (muted light gray)
  { tag: [tags.operator, tags.punctuation], color: '#d4d4d4' },
  // Brackets & delimiters
  { tag: tags.bracket, color: '#ffd700' },
  // Meta, preprocessor (#include, annotations)
  { tag: tags.meta, color: '#9b9b9b' },
  // Invalid / errors
  { tag: tags.invalid, color: '#f87171', textDecoration: 'underline wavy #ef4444' }
]);

const lightHighlightStyle = HighlightStyle.define([
  // Keywords (crisp royal blue)
  { tag: [tags.keyword, tags.operatorKeyword, tags.definitionKeyword, tags.moduleKeyword], color: '#0000ff', fontWeight: '600' },
  // Control flow keywords (crisp purple)
  { tag: tags.controlKeyword, color: '#af00db', fontWeight: '600' },
  // Strings & characters (warm dark red / emerald)
  { tag: [tags.string, tags.character, tags.special(tags.string)], color: '#a31515' },
  // Type names, class names, standard types (crisp cyan/teal)
  { tag: [tags.typeName, tags.className, tags.standard(tags.typeName)], color: '#267f99', fontWeight: '500' },
  // Functions & methods (warm brown / deep blue)
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.definition(tags.function(tags.variableName))], color: '#795e26' },
  // Numbers, integers, floats, booleans, null (deep green / orange)
  { tag: [tags.number, tags.integer, tags.float, tags.bool, tags.null], color: '#098658' },
  // Comments (muted olive green italics)
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: '#008000', fontStyle: 'italic' },
  // Variables & identifiers (dark slate)
  { tag: [tags.variableName, tags.definition(tags.variableName)], color: '#001080' },
  // Properties & attributes (deep red / blue)
  { tag: [tags.propertyName, tags.attributeName], color: '#e50000' },
  // HTML / XML tag names (royal blue)
  { tag: tags.tagName, color: '#800000', fontWeight: '500' },
  // Operators & punctuation (slate)
  { tag: [tags.operator, tags.punctuation], color: '#334155' },
  // Brackets & delimiters
  { tag: tags.bracket, color: '#0451a5' },
  // Meta, preprocessor
  { tag: tags.meta, color: '#666666' },
  // Invalid
  { tag: tags.invalid, color: '#dc2626', textDecoration: 'underline wavy #dc2626' }
]);

// 3. Editor Surface Themes (Dark & Light)
const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#0a0d14',
    color: '#f8fafc',
    height: '100%',
    fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace"
  },
  '.cm-content': {
    paddingBottom: '100px',
    caretColor: '#38bdf8'
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#38bdf8',
    borderLeftWidth: '2px'
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#38bdf8'
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.04)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: '#38bdf8'
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
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    outline: '1px solid #38bdf8',
    color: '#ffffff !important'
  },
  '.cm-nonmatchingBracket': {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    outline: '1px solid #ef4444',
    color: '#f87171 !important'
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(56, 189, 248, 0.3) !important'
  },
  '.cm-scroller': {
    fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace",
    lineHeight: '1.6',
    overflow: 'auto',
    paddingBottom: '100px'
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
    paddingBottom: '100px',
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
    paddingBottom: '100px'
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

  if (mountEl) {
    mountEl.innerHTML = '';
  }

  currentLanguage = initialLang;
  currentFontSize = fontSize;
  onCodeChangeCallback = onChange;
  const dark = isDarkMode();

  const customBasicSetup = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
      indentWithTab,
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap
    ])
  ];

  const state = EditorState.create({
    doc: initialCode,
    extensions: [
      customBasicSetup,
      indentUnit.of('    '),
      EditorView.editable.of(true),
      EditorState.readOnly.of(false),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        tabindex: '0',
        spellcheck: 'false',
        autocapitalize: 'off',
        autocomplete: 'off',
        autocorrect: 'off'
      }),
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

  // Tap anywhere in mount to focus
  if (mountEl) {
    mountEl.style.display = 'flex';
    mountEl.addEventListener('click', () => {
      if (activeView && !activeView.hasFocus) activeView.focus();
    });
  }

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
