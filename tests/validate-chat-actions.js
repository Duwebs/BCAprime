/* One-off validation for the reactions/edit/delete feature. Safe to delete. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let fail = 0;
function ok(cond, label) {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label);
  if (!cond) fail++;
}

/* 1) chat.js syntax */
try {
  new (require('vm').Script)(fs.readFileSync(path.join(root, 'chat.js'), 'utf8'), { filename: 'chat.js' });
  ok(true, 'chat.js parses (syntax)');
} catch (e) {
  ok(false, 'chat.js parses — ' + e.message);
}

/* 2) chat.js required symbols */
const js = fs.readFileSync(path.join(root, 'chat.js'), 'utf8');
[
  'loadHiddenIds', 'openActions', 'closeActions', 'sheetBackdrop', 'confirmDelete',
  'toggleReaction', 'startEdit', 'saveEdit', 'cancelEdit', 'askDelete', 'deleteForEveryone',
  'fireLongPress', 'endPress', 'msgFromTarget', 'handleRemoteUpdate', 'handleRemoteDelete',
  'removeMessageLocal', 'handleReactionInsert', 'handleReactionDelete', 'subscribeReactions',
  'loadReactions', 'syncReactionsQuiet', 'reconcileRows', 'refreshMsgDom', 'renderReactions',
  'filterHidden', 'markOpsUnsupported', 'markReactionsUnsupported', 'isMissingFeature',
  'bca_edit_message', 'bca_delete_message', 'bca_toggle_reaction',
  "event: 'UPDATE'", "event: 'DELETE'", "table: 'chat_reactions'",
  'touchstart', 'touchmove', 'touchend', 'contextmenu', 'msg-menu', 'msg-react',
  'msg-edited', 'data-mid', 'suppressClickUntil', 'holding'
].forEach(s => ok(js.includes(s), 'chat.js contains ' + s));
ok((js.match(/function mergeIncoming/g) || []).length === 0, 'old mergeIncoming removed');

/* 3) styles.css: balance + required classes, no duplicated block */
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
let depth = 0, minDepth = 0;
for (const c of css) { if (c === '{') depth++; if (c === '}') depth--; if (depth < minDepth) minDepth = depth; }
ok(depth === 0 && minDepth === 0, 'styles.css braces balanced (depth=' + depth + ')');
ok((css.match(/COMMUNITY CHAT — reactions/g) || []).length === 1, 'reactions CSS block appears exactly once');
[
  '.msg-menu', '.msg-edited', '.msg-reactions', '.msg-react{', '.msg-edit{',
  '.chat-sheet{', '.chat-sheet-panel', '.sheet-emoji', '.sheet-action', '.chat-danger-btn',
  '#communityMessages.holding'
].forEach(s => ok(css.includes(s), 'styles.css contains ' + s));

/* 4) index.html: sheet markup + version bumps */
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
[
  'id="chatActionSheet"', 'id="chatDeleteConfirm"', 'id="chatSheetReactions"',
  'id="chatSheetActions"', 'id="chatDeleteTitle"', 'id="chatDeleteText"',
  'id="chatDeleteGo"', 'id="chatSheetPreview"', 'BCAChat.closeActions', 'BCAChat.sheetBackdrop',
  'BCAChat.confirmDelete', 'styles.css?v=52', 'chat.js?v=12'
].forEach(s => ok(html.includes(s), 'index.html contains ' + s));

/* 5) SQL migration: required objects */
const sql = fs.readFileSync(path.join(root, 'supabase-chat-reactions-edits.sql'), 'utf8');
[
  'edited_at', 'create table if not exists public.chat_reactions',
  'bca_edit_message', 'bca_delete_message', 'bca_toggle_reaction',
  'unique (message_id, uid, emoji)', 'supabase_realtime',
  'security definer', 'on delete cascade'
].forEach(s => ok(sql.toLowerCase().includes(s.toLowerCase()), 'SQL contains ' + s));

/* 6) exported API surface used by inline HTML handlers */
['closeActions: closeActions', 'sheetBackdrop: sheetBackdrop', 'confirmDelete: confirmDelete']
  .forEach(s => ok(js.includes(s), 'BCAChat exports ' + s.split(':')[0].trim()));

console.log(fail ? ('\n' + fail + ' check(s) FAILED') : '\nALL CHECKS PASSED');
process.exit(fail ? 1 : 0);
