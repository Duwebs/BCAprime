/* ============================================================
   BCAPrime — chat.js (Community Chat hub)
   WhatsApp-style community chat: subject channels, real-time
   sync via Supabase Realtime, code highlighting (C++/JS),
   image sharing, pinned announcements, emoji reactions +
   edit/delete (long-press on mobile, hover ⋮ + right-click
   on desktop — DB side: supabase-chat-reactions-edits.sql).

   ACCESS MODEL (phone verification REMOVED):
   - Community chat needs Firebase LOGIN only. No SMS/OTP gate.
   - Server RLS insert policy checks length only (see
     supabase-chat-no-phone-gate.sql). Client checks are UX only.
   - All rendered text is escaped via textContent — no XSS.

   Exposed globals: BCAChat, BCAFab
   ============================================================ */
(function () {
  'use strict';

  var SUPA = (typeof supabaseClient !== 'undefined') ? supabaseClient : null;
  var CHANNELS = [
    { slug: 'dsa-coding',       label: 'DSA & Coding', icon: 'fa-code' },
    { slug: 'web-development',  label: 'Web Dev',      icon: 'fa-globe' },
    { slug: 'exam-updates',     label: 'Exam Updates', icon: 'fa-bullhorn' },
    { slug: 'general-chat',     label: 'General',      icon: 'fa-comment' }
  ];

  var MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  var state = {
    open: false, channel: 'general-chat',
    messages: [], profiles: {}, lastSent: 0, sending: false,
    imageFile: null, pendingCode: null, min: false,
    rtChannel: null, profileRt: null, seenIds: {},
    /* reactions + edit/delete (supabase-chat-reactions-edits.sql) */
    reactions: {}, reactRt: null, reactionsSupported: true, reactionsNotified: false,
    opsSupported: true, opsNotified: false,
    hiddenIds: {}, editingId: null, savingEdit: false,
    actionMsg: null, deleteCtx: null, sheetOpenedAt: 0,
    /* WhatsApp-style deletion + admin moderation
       (supabase-chat-deletion-moderation.sql):
       isAdmin = user_profiles.is_admin (Firebase-uid row). Admins get
       "Delete for everyone" on ANY message + ban controls via panel. */
    isAdmin: false, isBanned: false, hidesSyncedFor: '',
    /* college+semester room isolation + WhatsApp-style unread */
    room: { college: 'all', semester: null, label: '' },
    roomSupported: true, /* false = isolation SQL abhi DB par run nahi hua (legacy mode) */
    unread: 0, unreadByChannel: {}, baseTitle: ''
  };

  /* ---------- tiny helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) { var d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }
  function time(t) { try { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function toast(msg) {
    var root = $('toastRoot');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  }
  function myUser() { try { return window.firebase && firebase.auth().currentUser; } catch (e) { return null; } }
  /* "Delete for me" hides — restored once at boot (fn is hoisted). */
  loadHiddenIds();

  /* ============================================================
     College & Semester room mapping.
     Room = (collegeName, semester) taken from the verified user's
     profile (user_profiles.college/semester), falling back to the
     onboarding picks in localStorage. Every history query + the
     realtime transport is scoped to this room — other colleges /
     semesters are never requested and never rendered.
     ============================================================ */
  function normRoomStr(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
  function myCollege() {
    try { return normRoomStr(localStorage.getItem('bca-college')) || 'all'; }
    catch (e) { return 'all'; }
  }
  function mySemester() {
    try {
      var v = localStorage.getItem('bca-sem');
      var n = Number(v);
      return (v && v !== 'all' && n >= 1 && n <= 6) ? n : null;
    } catch (e) { return null; }
  }
  function roomKey(college, sem) { return normRoomStr(college) + '::' + (sem == null ? 'all' : sem); }
  function myRoomKey() { return roomKey(state.room.college, state.room.semester); }
  function collegeDisplayName(key) {
    try {
      var list = (typeof colleges !== 'undefined') ? colleges : (window.colleges || []);
      for (var i = 0; i < list.length; i++) {
        if (String(list[i][0]).toLowerCase() === normRoomStr(key)) return list[i][1];
      }
    } catch (e) {}
    return key === 'all' ? 'All Colleges' : String(key || 'Community');
  }
  function roomLabel(college, sem) {
    return collegeDisplayName(college) + (sem == null ? '' : ' · Sem ' + sem);
  }
  /* Detect whether the isolation migration is live on the DB.
     First room-scoped query that returns "column college/semester
     does not exist" (or code 42703) flips us into legacy mode so
     sending/reading keeps working until you run the SQL. */
  function markRoomUnsupported(err) {
    try {
      var msg = String((err && (err.message || err.details || err.hint || err.reason)) || '');
      var code = String((err && err.code) || '');
      if (code === '42703' || /college|semester/i.test(msg)) {
        if (state.roomSupported) {
          state.roomSupported = false;
          toast('Chat room upgrade pending — running in compatibility mode. Run supabase-chat-isolation.sql to enable college & semester rooms.');
        }
        return true;
      }
    } catch (e) {}
    return false;
  }
  /* Server truth wins: the verified profile row decides the room. */
  async function resolveRoom() {
    var college = myCollege(), sem = mySemester();
    try {
      var u = myUser();
      if (u && SUPA) {
        var res = await SUPA.from('user_profiles').select('college,semester').eq('uid', u.uid).maybeSingle();
        if (res.data) {
          if (res.data.college) college = normRoomStr(res.data.college) || college;
          var s = Number(res.data.semester);
          if (s >= 1 && s <= 6) sem = s;
        }
      }
    } catch (e) { /* offline-safe: local picks stand in */ }
    state.room.college = college || 'all';
    state.room.semester = sem;
    state.room.label = roomLabel(state.room.college, sem);
    try { document.dispatchEvent(new CustomEvent('bca-room-changed', { detail: { college: state.room.college, semester: sem } })); } catch (e) {}
    return state.room;
  }
  function inMyRoom(m) {
    if (!m) return false;
    if (normRoomStr(m.college) !== normRoomStr(state.room.college)) return false;
    if (state.room.semester == null) return m.semester == null;
    return Number(m.semester) === Number(state.room.semester);
  }

  /* ---------- profile linking (live, NO phone badge) ---------- */
  async function loadProfiles(uids) {
    if (!SUPA || !uids.length) return;
    try {
      var res = await SUPA.from('user_profiles').select('uid,name,username,avatar_url').in('uid', uids);
      (res.data || []).forEach(function (p) { state.profiles[p.uid] = p; });
      document.querySelectorAll('#communityMessages .msg[data-uid]').forEach(function (el) {
        var p = state.profiles[el.getAttribute('data-uid')]; if (!p) return;
        var nameEl = el.querySelector('.msg-name'); var avEl = el.querySelector('.msg-avatar');
        if (nameEl) nameEl.textContent = p.name || p.username || 'Student';
        if (avEl && p.avatar_url) avEl.src = p.avatar_url;
      });
    } catch (e) { /* offline-safe */ }
  }
  function subscribeProfileRealtime() {
    if (!SUPA || state.profileRt) return;
    state.profileRt = SUPA.channel('chat-profiles').on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'user_profiles' },
      function (payload) {
        if (payload.new && payload.new.uid) {
          state.profiles[payload.new.uid] = payload.new;
          loadProfiles([payload.new.uid]);
        }
      }).subscribe();
  }

  /* ============================================================
     WhatsApp-style unread counters + notifications for MY room.
     - Per-channel "floors" (last seen id) persist in localStorage.
     - paintUnreadBadges() renders the badge on the Community
       bottom-tab, per-channel chips (99+ capped) + title ping.
     - notifyIncoming() fires a browser alert when a room message
       arrives while the chat is closed/hidden.
     - notifyRoomPush() triggers the server push (same-room only).
     ============================================================ */
  function floorKey(channel) { return 'bca-chat-lastseen-' + myRoomKey() + '-' + channel; }
  function storedNum(k) { try { return Number(localStorage.getItem(k) || '0') || 0; } catch (e) { return 0; } }
  function storeNum(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }
  function communityTabBtn() {
    var tabs = document.querySelectorAll('.bottom-tab');
    for (var i = 0; i < tabs.length; i++) {
      var fn = tabs[i].getAttribute('onclick') || '';
      if (fn.indexOf('community') !== -1) return tabs[i];
    }
    return null;
  }
  function fmtCount(n) { return n > 99 ? '99+' : String(n); }
  function paintUnreadBadges() {
    try {
      var btn = communityTabBtn();
      if (btn) {
        var badge = btn.querySelector('.chat-unread-badge');
        if (state.unread > 0) {
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'chat-unread-badge';
            btn.appendChild(badge);
          }
          badge.textContent = fmtCount(state.unread);
          badge.hidden = false;
        } else if (badge) { badge.hidden = true; }
      }
      var chips = document.querySelectorAll('#communityChips .community-chip');
      for (var i = 0; i < chips.length; i++) {
        var slug = chips[i].getAttribute('data-channel') || '';
        var n = state.unreadByChannel[slug] || 0;
        var dot = chips[i].querySelector('.chip-unread');
        if (n > 0) {
          if (!dot) { dot = document.createElement('span'); dot.className = 'chip-unread'; chips[i].appendChild(dot); }
          dot.textContent = fmtCount(n);
          dot.hidden = false;
        } else if (dot) { dot.hidden = true; }
      }
      if (!state.baseTitle) state.baseTitle = document.title || 'BCAPrime';
      var clean = state.baseTitle.replace(/^\(\d+\+?\)\s*/, '');
      document.title = state.unread > 0 ? '(' + fmtCount(state.unread) + ') ' + clean : clean;
    } catch (e) { /* badges are cosmetic */ }
  }
  /* Browser alert for room messages arriving while chat is hidden. */
  function notifyIncoming(m) {
    try {
      if (!m || state.open) return;
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      var u = myUser();
      if (u && m.uid === u.uid) return; /* never alert for own messages */
      var title = '💬 ' + (m.author_name || 'Student') + ' · ' + state.room.label;
      var text = String(m.body || '').slice(0, 120) || 'Sent a photo 📷';
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(function (reg) {
          if (reg && reg.showNotification) reg.showNotification(title, { body: text, icon: './assets/logo.png', badge: './assets/logo.png', tag: 'chat-' + myRoomKey(), data: { url: './index.html#community' } });
          else if (window.Notification) new Notification(title, { body: text });
        }).catch(function () { try { new Notification(title, { body: text }); } catch (e) {} });
      } else { new Notification(title, { body: text }); }
    } catch (e) { /* alerts are best-effort */ }
  }
  /* Server push (Web-Push via notify-chat fn, same-room only). Fire-and-forget. */
  function notifyRoomPush(messageId) {
    try {
      var base = (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) ? SUPABASE_URL : 'https://kjesjaakjddfxykisssh.supabase.co';
      var key = (typeof SUPABASE_PUBLISHABLE_KEY !== 'undefined' && SUPABASE_PUBLISHABLE_KEY) ? SUPABASE_PUBLISHABLE_KEY : '';
      fetch(base + '/functions/v1/notify-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key },
        body: JSON.stringify({ message_id: messageId })
      }).catch(function () {});
    } catch (e) { /* offline-safe */ }
  }

  /* ---------- message rendering ----------
     Deleted tombstones: WhatsApp-style placeholder bubble
     ("This message was deleted" / "…deleted by an admin") — no body,
     no image/code, no edit/react affordances. */
  function isDeleted(m) { return !!(m && m.is_deleted); }
  function deletedLabel(m) {
    if (m && m.deleted_by === 'admin') return 'This message was deleted by an admin';
    return 'This message was deleted';
  }
  function renderBody(m) {
    var el = document.createElement('div');
    var sx = String(m.body || '');
    var parts = splitFenced(sx);
    var fenced = false, qi;
    for (qi=0;qi<parts.length;qi++){ if(parts[qi].kind==='code'){fenced=true;break;} }
    if (fenced && window.hljs) {
      parts.forEach(function(p){
        if(p.kind==='code'){ el.appendChild(buildCodeBlock(p.text,p.lang)); }
        else if(p.text){ var d=document.createElement('div');d.className='msg-text';d.textContent=p.text;el.appendChild(d); }
      });
    } else if ((m.code_lang && window.hljs) || (window.hljs && looksLikeCode(sx))) {
      el.appendChild(buildCodeBlock(sx, m.code_lang || autoLangFor(sx)));
    } else {
      var p=document.createElement('div');p.className='msg-text';p.textContent=sx;el.appendChild(p);
    }
    if (m.image_url) {
      var img=document.createElement('img');
      img.className='msg-image';img.loading='lazy';img.alt='shared screenshot';img.src=m.image_url;
      img.onclick=function(ev){ if(Date.now()<suppressClickUntil){ if(ev&&ev.stopPropagation)ev.stopPropagation(); return; } openLightbox(m.image_url); };
      el.appendChild(img);
    }
    return el;
  }
  function buildMsg(m) {
    var mine = myUser() && m.uid === myUser().uid;
    var wrap = document.createElement('div');
    wrap.className = 'msg' + (mine ? ' mine' : '') + (isDeleted(m) ? ' msg-deleted' : '');
    wrap.setAttribute('data-uid', m.uid || '');
    if (m.id) wrap.setAttribute('data-mid', m.id);
    var p = state.profiles[m.uid] || {};
    wrap.innerHTML =
      '<img class="msg-avatar" alt="" src="' + esc(p.avatar_url || m.author_avatar || '') + '" onerror="this.style.visibility=\'hidden\'">' +
      '<div class="msg-bubble">' +
      '<div class="msg-head"><span class="msg-name">' + esc(p.name || p.username || m.author_name || 'Student') + '</span>' +
      '<span class="msg-time">' + time(m.created_at) + '</span>' +
      ((m.edited_at && !isDeleted(m)) ? '<span class="msg-edited" title="Edited">(edited)</span>' : '') +
      (isDeleted(m)
        ? '<span class="msg-edited" title="Deleted">🚫</span>'
        : '<button class="msg-menu" type="button" aria-label="Message options" title="React, edit or delete"><i class="fa-solid fa-ellipsis"></i></button>') +
      '</div>' +
      '</div>';
    var bubble = wrap.querySelector('.msg-bubble');
    if (isDeleted(m)) {
      var ph = document.createElement('div');
      ph.className = 'msg-text msg-deleted-text';
      var ico = document.createElement('i');
      ico.className = 'fa-solid fa-ban';
      ico.setAttribute('aria-hidden', 'true');
      ph.appendChild(ico);
      ph.appendChild(document.createTextNode(' ' + deletedLabel(m)));
      bubble.appendChild(ph);
    } else {
      bubble.appendChild(renderBody(m));
      var rr = renderReactions(m);
      if (rr) bubble.appendChild(rr);
    }
    return wrap;
  }
  /* ---------- message DOM helpers (reactions / edit / live updates) ---------- */
  function getMsgEl(id) { return document.querySelector('#communityMessages .msg[data-mid="' + Number(id) + '"]'); }
  function findLoaded(id) {
    id = Number(id);
    for (var i = 0; i < state.messages.length; i++) if (state.messages[i].id === id) return state.messages[i];
    return null;
  }
  function filterHidden(rows) {
    return (rows || []).filter(function (m) { return m && !state.hiddenIds[m.id]; });
  }
  /* Rebuild ONE bubble in place (edited tag, reaction pills, live text). */
  function refreshMsgDom(m) {
    if (!m || !m.id) return;
    if (state.editingId === m.id) return; /* never clobber an open editor */
    var old = getMsgEl(m.id);
    if (!old || !old.parentNode) return;
    old.parentNode.replaceChild(buildMsg(m), old);
  }
  function reactionSummary(mid) {
    var list = state.reactions[mid] || [];
    var u = myUser(), map = {}, order = [];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (!map[r.emoji]) { map[r.emoji] = { emoji: r.emoji, count: 0, mine: false }; order.push(r.emoji); }
      map[r.emoji].count++;
      if (u && r.uid === u.uid) map[r.emoji].mine = true;
    }
    return order.map(function (e) { return map[e]; });
  }
  function renderReactions(m) {
    var sums = m && m.id ? reactionSummary(m.id) : [];
    if (!sums.length) return null;
    var row = document.createElement('div');
    row.className = 'msg-reactions';
    sums.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'msg-react' + (s.mine ? ' mine' : '');
      b.setAttribute('data-emoji', s.emoji);
      var label = (s.mine ? 'Remove your reaction' : 'React with ' + s.emoji) + ' — ' + s.count + ' reacted';
      b.title = label; b.setAttribute('aria-label', label);
      var e = document.createElement('span'); e.className = 'msg-react-emoji'; e.textContent = s.emoji;
      var c = document.createElement('span'); c.className = 'msg-react-count'; c.textContent = String(s.count);
      b.appendChild(e); b.appendChild(c);
      row.appendChild(b);
    });
    return row;
  }
  function appendMsg(m, opts) {
    opts = opts || {};
    if (m.id && (state.seenIds[m.id] || state.hiddenIds[m.id])) return;
    if (m.id) state.seenIds[m.id] = true;
    var box = $('communityMessages');
    if (!box) return;
    var atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    box.appendChild(buildMsg(m));
    if (atBottom || opts.forceScroll) box.scrollTop = box.scrollHeight;
  }
  function renderAll() {
    var box = $('communityMessages');
    box.innerHTML = '';
    state.seenIds = {};
    state.messages.forEach(function (m) { appendMsg(m); });
    box.scrollTop = box.scrollHeight;
  }

  /* ---------- realtime sync (STRICTLY room-scoped) ----------
     One subscription per ROOM that SURVIVES topic-channel switches.
     The transport filter rides on BOTH room columns:
       college  -> college=eq.<college>
       semester -> semester=eq.<n>  (or semester=is.null for the
                   'all'/unset room)  — rows from other colleges /
                   semesters never even reach this socket.
     Anything that slips past the filter is still dropped by
     inMyRoom() before it touches state or the DOM.
     A status callback catches missing-column filters (isolation SQL
     not applied), auto-falls back to legacy mode and re-connects
     with backoff. A 1s SILENT merge-poll (15s when chat closed) is the
     guarantee: even with the socket down, new messages appear in the
     open chat on their own — nobody ever has to reload the page. */
  var refreshTimer = null;
  var rtClock = { roomKey: '', generation: 0, healthy: false };
  var reconnectTimer = null, reconnectAttempts = 0;
  var ROOM_POLL_MS = 15000;
  var OPEN_POLL_MS = 1000;

  function roomChangedSinceSubscribed() { return rtClock.roomKey && rtClock.roomKey !== myRoomKey(); }

  /* Transport filter for the realtime socket: my college AND my semester. */
  function roomFilter() {
    var f = 'college=eq.' + encodeURIComponent(normRoomStr(state.room.college) || 'all');
    f += state.room.semester == null ? ',semester=is.null' : ',semester=eq.' + state.room.semester;
    return f;
  }
  /* Single funnel for every incoming row (realtime OR poll merge):
     dedupe, room guard, push into state, render instantly, advance
     the read floor — the UI never waits on a reload. */
  function handleIncoming(m) {
    if (!m || state.seenIds[m.id] || (m.id && state.hiddenIds[m.id])) return;
    if (!inMyRoom(m)) return; /* filter-leakage guard: other room — drop */
    state.seenIds[m.id] = true;
    if (m.channel === state.channel && state.open) {
      state.messages.push(m);
      appendMsg(m);
      if (m.uid) loadProfiles([m.uid]);
      storeNum(floorKey(m.channel), m.id);
      scheduleRefresh(); /* recount the rest of the badges */
    } else {
      scheduleRefresh(); /* counts as unread + browser alert path */
    }
  }
  /* If the realtime channel fails (e.g. unmigrated DB) fall back to the
     legacy per-channel transport or retry with backoff; polling keeps
     working either way. */
  function channelByStatus(status, err) {
    if (!SUPA) return;
    if (status === 'SUBSCRIBED') { rtClock.healthy = true; reconnectAttempts = 0; return; }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      rtClock.healthy = false;
      if (state.roomSupported && markRoomUnsupported(err)) {
        state.roomSupported = false; /* isolation SQL pending → legacy mode */
        subscribe();
        return;
      }
      if (reconnectAttempts < 6) {
        reconnectAttempts += 1;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(subscribe, 3000 * reconnectAttempts);
      }
    }
  }
  function unsubscribe() {
    if (state.rtChannel) { try { SUPA.removeChannel(state.rtChannel); } catch (e) {} state.rtChannel = null; }
    if (state.reactRt) { try { SUPA.removeChannel(state.reactRt); } catch (e) {} state.reactRt = null; }
    rtClock.healthy = false;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  }
  /* Create/re-create the ROOM channel. No-op when a healthy channel for
     the current room already exists, so switching topic channels never
     tears the realtime socket down. */
  function ensureRoomChannel(force) {
    if (!SUPA) return;
    if (!force && state.rtChannel && rtClock.roomKey === myRoomKey() && rtClock.healthy) return;
    subscribe();
  }
  function subscribe() {
    if (!SUPA) return;
    unsubscribe();
    reconnectAttempts = 0;
    rtClock.roomKey = myRoomKey();
    rtClock.generation += 1;
    var topic = 'room:' + rtClock.roomKey + '#gen' + rtClock.generation;
    /* INSERT + UPDATE carry the full row → room/channel filter works
       (legacy mode falls back to a channel-level filter). DELETE events
       ship only the primary key (replica identity default), so they are
       subscribed unfiltered and guarded client-side by loaded-id lookup.
       UPDATE = edited text, DELETE = "deleted for everyone". */
    var msgFilter = state.roomSupported ? roomFilter() : ('channel=eq.' + state.channel);
    state.rtChannel = SUPA.channel(topic)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: msgFilter },
        function (payload) { handleIncoming(payload.new); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: msgFilter },
        function (payload) { handleRemoteUpdate(payload.new); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' },
        function (payload) { handleRemoteDelete(payload.old); })
      .subscribe(channelByStatus);
    subscribeReactions();
  }

  /* ---------- realtime: edits / deletes / reactions (instant sync) ----------
     Soft-delete model (supabase-chat-deletion-moderation.sql):
     "Delete for Everyone" = UPDATE -> tombstone row (is_deleted=true),
     delivered here as UPDATE (no reload, no history gap). Hard DELETE
     events are still honored (legacy rows) via handleRemoteDelete. */
  function handleRemoteUpdate(row) {
    if (!row || !row.id) return;
    var m = findLoaded(row.id);
    if (!m) return; /* other channel / not on screen — history covers it */
    var changed = (m.body !== row.body) || (m.edited_at !== row.edited_at) ||
      (m.code_lang !== row.code_lang) || (m.image_url !== row.image_url) ||
      (!!m.is_deleted !== !!row.is_deleted) || (m.deleted_by !== row.deleted_by);
    m.body = row.body; m.edited_at = row.edited_at;
    m.code_lang = row.code_lang; m.image_url = row.image_url;
    m.is_deleted = row.is_deleted; m.deleted_by = row.deleted_by;
    m.deleted_at = row.deleted_at; m.deleted_by_uid = row.deleted_by_uid;
    if (changed) refreshMsgDom(m);
  }
  function handleRemoteDelete(oldRow) {
    var id = oldRow && Number(oldRow.id);
    if (id) removeMessageLocal(id);
  }
  /* Drop a message everywhere locally (remote delete / delete-for-me). */
  function removeMessageLocal(id) {
    id = Number(id);
    if (!id) return;
    if (state.editingId === id) state.editingId = null;
    if (state.actionMsg && state.actionMsg.id === id) closeActions();
    for (var i = 0; i < state.messages.length; i++) {
      if (state.messages[i].id === id) { state.messages.splice(i, 1); break; }
    }
    delete state.reactions[id];
    state.seenIds[id] = true; /* a late in-flight INSERT can't resurrect it */
    var el = getMsgEl(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  function handleReactionInsert(row) {
    if (!row || !row.message_id) return;
    var mid = Number(row.message_id);
    var m = findLoaded(mid);
    if (!m) return; /* not loaded here — history/poll picks it up later */
    var list = state.reactions[mid] || (state.reactions[mid] = []);
    for (var i = 0; i < list.length; i++) {
      if (list[i].uid === row.uid && list[i].emoji === row.emoji) {
        list[i].id = row.id; /* backfill our optimistic entry */
        return;
      }
    }
    list.push({ id: row.id, uid: row.uid, emoji: row.emoji });
    refreshMsgDom(m);
  }
  function handleReactionDelete(row) {
    var rid = row && Number(row.id);
    if (!rid) return;
    for (var mid in state.reactions) {
      var list = state.reactions[mid];
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === rid) {
          list.splice(i, 1);
          if (!list.length) delete state.reactions[mid];
          var m = findLoaded(mid);
          if (m) refreshMsgDom(m);
          return;
        }
      }
    }
  }
  /* SEPARATE transport for reactions: agar chat_reactions table abhi
     migrate nahi hai to iska failure main message socket ko kabhi nahi
     todta (bilkul alag Supabase channel). */
  function subscribeReactions() {
    if (!SUPA || state.reactRt || !state.reactionsSupported) return;
    state.reactRt = SUPA.channel('chat-reacts:' + rtClock.roomKey + '#gen' + rtClock.generation)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_reactions' },
        function (payload) { handleReactionInsert(payload.new); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_reactions' },
        function (payload) { handleReactionDelete(payload.old); })
      .subscribe(function (status) {
        if (status === 'SUBSCRIBED') return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          /* teardown so the next subscribe() retries; the missing-table
             toast comes from the loadReactions() select path. */
          try { if (state.reactRt) SUPA.removeChannel(state.reactRt); } catch (e) {}
          state.reactRt = null;
        }
      });
  }
  function scheduleRefresh() {
    if (refreshTimer) return;
    refreshTimer = setTimeout(function () { refreshTimer = null; refreshUnread(); }, 250);
  }
  async function loadHistory(channel) {
    if (!SUPA) return;
    try {
      /* Room-scoped query: my college AND my semester AND this topic. */
      var q = SUPA.from('chat_messages').select('*')
        .eq('channel', channel);
      if (state.roomSupported) {
        q = q.eq('college', state.room.college);
        if (state.room.semester == null) q = q.is('semester', null);
        else q = q.eq('semester', state.room.semester);
      }
      q = q.order('id', { ascending: false }).limit(50);
      var res = await q;
      if (res.error && state.roomSupported && markRoomUnsupported(res.error)) {
        var retry = await SUPA.from('chat_messages').select('*')
          .eq('channel', channel).order('id', { ascending: false }).limit(50);
        state.messages = filterHidden((retry.data || []).reverse());
        return;
      }
      if (res.error) throw res.error;
      state.messages = filterHidden((res.data || []).reverse());
    } catch (e) {
      if (state.roomSupported && markRoomUnsupported(e)) {
        try {
          var retry2 = await SUPA.from('chat_messages').select('*')
            .eq('channel', channel).order('id', { ascending: false }).limit(50);
          state.messages = filterHidden((retry2.data || []).reverse());
          return;
        } catch (e2) {}
      }
      state.messages = [];
    }
  }
  async function loadAnnouncement() {
    var box = $('communityAnnounce'); var txt = $('communityAnnounceText');
    if (!box || !SUPA) return;
    try {
      var res = await SUPA.from('chat_channels').select('slug,announcement').eq('slug', state.channel).maybeSingle();
      var a = res.data && res.data.announcement;
      if (a) { txt.textContent = a; box.hidden = false; } else { box.hidden = true; }
    } catch (e) { box.hidden = true; }
  }

  /* ---------- channel UI ---------- */
  function renderChips() {
    var wrap = $('communityChips');
    wrap.innerHTML = '';
    CHANNELS.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'community-chip' + (c.slug === state.channel ? ' active' : '');
      b.setAttribute('data-channel', c.slug);
      b.innerHTML = '<i class="fa-solid ' + c.icon + '"></i> ' + esc(c.label);
      b.onclick = function () { switchChannel(c.slug); };
      wrap.appendChild(b);
    });
    /* Re-apply unread dots after rebuilding the chips. */
    paintUnreadBadges();
  }
  async function switchChannel(slug) {
    state.channel = slug;
    $('communityActiveChannel').textContent = '#' + slug + ' · ' + state.room.label;
    try {
      var pill = $('communityRoomPill');
      if (pill) {
        pill.textContent = '🏫 ' + state.room.label;
        pill.hidden = false;
        pill.title = 'Only students from ' + state.room.label + ' can read & write here';
      }
    } catch (e) {}
    renderChips();
    await loadHistory(slug);
    await loadReactions();
    renderAll();
    loadAnnouncement();
    ensureRoomChannel();
    loadProfiles(uniqueUids());
    markChannelSeen(slug);
  }
  /* The open channel is "read": its floor jumps to the newest id. */
  function markChannelSeen(slug) {
    try {
      var top = 0;
      if (slug === state.channel) {
        for (var i = 0; i < state.messages.length; i++) {
          if (state.messages[i] && state.messages[i].id > top) top = state.messages[i].id;
        }
      }
      var prev = storedNum(floorKey(slug));
      storeNum(floorKey(slug), Math.max(prev, top));
    } catch (e) {}
    scheduleRefresh();
  }
  /* WhatsApp-style recount: for every topic, unread = rows above my
     floor inside MY room only. Unknown ids also surface the newest
     room message as a browser alert. */
  async function refreshUnread() {
    if (!SUPA) { state.unread = 0; state.unreadByChannel = {}; paintUnreadBadges(); return; }
    try {
      await resolveRoomQuiet();
      if (roomChangedSinceSubscribed()) ensureRoomChannel(true);
      var floors = {}, total = 0, byCh = {};
      var alerts = [];
      for (var i = 0; i < CHANNELS.length; i++) {
        var slug = CHANNELS[i].slug;
        floors[slug] = storedNum(floorKey(slug));
        var q = SUPA.from('chat_messages').select('id,uid,author_name,body,channel');
        if (state.roomSupported) {
          q = q.eq('college', state.room.college);
          if (state.room.semester == null) q = q.is('semester', null);
          else q = q.eq('semester', state.room.semester);
        }
        q = q.eq('channel', slug)
          .gt('id', floors[slug])
          .order('id', { ascending: true }).limit(100);
        var res = await q;
        if (res.error && state.roomSupported && markRoomUnsupported(res.error)) {
          state.roomSupported = false;
          return refreshUnread(); /* retry once in legacy mode */
        }
        if (res.error) throw res.error;
        var rows = res.data || [];
        var u = myUser();
        var mine = u ? u.uid : null;
        var others = rows.filter(function (r) { return (!mine || r.uid !== mine) && !state.hiddenIds[r.id]; });
        /* The open channel self-clears — its rows were just rendered. */
        if (slug === state.channel && state.open) {
          if (rows.length) storeNum(floorKey(slug), rows[rows.length - 1].id);
        } else {
          byCh[slug] = others.length;
          total += others.length;
          if (others.length && !state.open) alerts.push(others[others.length - 1]);
        }
      }
      state.unreadByChannel = byCh;
      state.unread = total;
      paintUnreadBadges();
      for (var a = 0; a < alerts.length; a++) notifyIncoming(alerts[a]);
    } catch (e) { /* keep old badge on failure */ }
  }
  /* Room resolution without re-painting the label (cheap path). */
  async function resolveRoomQuiet() {
    try {
      var u = myUser();
      if (u && SUPA) {
        var res = await SUPA.from('user_profiles').select('college,semester').eq('uid', u.uid).maybeSingle();
        if (res.data) {
          if (res.data.college) state.room.college = normRoomStr(res.data.college) || state.room.college;
          var s = Number(res.data.semester);
          if (s >= 1 && s <= 6) state.room.semester = s;
          state.room.label = roomLabel(state.room.college, state.room.semester);
        }
      }
    } catch (e) {}
    return state.room;
  }
  function uniqueUids() {
    var set = {}; var out = [];
    state.messages.forEach(function (m) { if (m.uid && !set[m.uid]) { set[m.uid] = 1; out.push(m.uid); } });
    return out;
  }

  /* ---------- profile cache (NO phone gate) ----------
     Sirf display-name/avatar cache karta hai. Koi verification
     check nahi — login user seedha chat me aata hai. */
  async function fetchVerified() {
    var u = myUser();
    if (!u || !SUPA) return { ok: true };
    try {
      var res = await SUPA.from('user_profiles').select('name,username,avatar_url,is_admin').eq('uid', u.uid).maybeSingle();
      if (res.data) {
        state.profiles[u.uid] = res.data;
        if (res.data.is_admin === true) state.isAdmin = true;
      }
      return { ok: true };
    } catch (e) { return { ok: true, error: true }; }
  }
  /* Phone verification REMOVED — ye saare entry points seedha chat
     kholte hain (login check open() ke andar hota hai). Purane
     modal/OTP references ke liye no-op aliases rakhe hain. */
  function openVerifyModal() { try { open(); } catch (e) {} }
  function fullPhone() { return ''; }
  async function startVerify(event) {
    if (event && event.preventDefault) event.preventDefault();
    try { await open(); } catch (e) {}
    return false;
  }
  function smsErrorText() { return ''; }
  /* Confirm the SMS code (DISABLED — phone gate hata diya; no-op). */
  async function confirmOtp() {
    try { await finishVerified(myUser() && myUser().uid); } catch (e) {}
  }
  /* Path A result handler (DISABLED — direct entry, no verification). */
  async function unlockCommunity(uid) {
    try { await finishVerified(uid); } catch (e) {}
    return true;
  }
  /* Path B re-check (DISABLED — hamesha verified). */
  async function recheckVerified() {
    try { await finishVerified(myUser() && myUser().uid); } catch (e) {}
  }
  async function finishVerified() {
    /* Phone gate removed — seedha chat me entry. */
    if (!state.open) { try { await open(); } catch (e) {} }
  }
  function editNumber() {}

  /* ---------- open / close (room-resolved) ---------- */
  async function open() {
    var u = myUser();
    if (!u) {
      var gate = $('accessAuthModal');
      if (gate) { gate.classList.add('open'); toast('Login to join the community chat'); }
      return;
    }
    await fetchVerified(); // profile/name cache only — no extra gate here
    try { await syncModerationRole(); } catch (e) {}
    try { await syncHiddenFromServer(); } catch (e) {}
    if (state.isBanned) toast('You are restricted from community chat');
    await resolveRoom(); /* verified profile decides the room */
    await probeRoomSupport(); /* realtime transport mode = DB truth, probe first */
    state.open = true;
    state.min = false;
    schedulePoll();
    try { $('communitySection').classList.remove('min'); resetMinBtn(); } catch (e) {}
    $('communitySection').hidden = false;
    document.body.classList.add('community-open');
    renderChips();
    subscribeProfileRealtime();
    await switchChannel(state.channel);
    await refreshUnread(); /* clear the open topic, count the rest */
    var input = $('communityInput');
    if (input) input.focus();
  }
  function close() {
    state.open = false;
    state.min = false;
    closeActions();
    schedulePoll();
    try { $('communitySection').classList.remove('min'); resetMinBtn(); } catch (e) {}
    $('communitySection').hidden = true;
    document.body.classList.remove('community-open');
    /* Keep the room subscription alive so background messages still
       raise the badge + browser alert (WhatsApp-style). */
    markChannelSeen(state.channel);
  }
  /* Reset every cached community-chat value so the next open starts clean.
     Unread floors stay — they are per-room read receipts, not session. */
  function resetSession() {
    if (state.rtChannel) { try { SUPA.removeChannel(state.rtChannel); } catch (e) {} state.rtChannel = null; }
    if (state.profileRt) { try { SUPA.removeChannel(state.profileRt); } catch (e) {} state.profileRt = null; }
    if (state.reactRt) { try { SUPA.removeChannel(state.reactRt); } catch (e) {} state.reactRt = null; }
    state.channel = 'general-chat';
    state.messages = [];
    state.profiles = {};
    state.seenIds = {};
    state.reactions = {};
    state.editingId = null;
    state.savingEdit = false;
    closeActions();
    state.imageFile = null;
    state.lastSent = 0;
    state.sending = false;
    state.pendingCode = null;
    try {
      var box = $('communityMessages'); if (box) box.innerHTML = '';
      var input = $('communityInput'); if (input) { input.value = ''; input.placeholder = 'Message community…'; }
      var lang = $('communityCodeLang'); if (lang) lang.value = '';
      var prev = $('communityImagePreview'); if (prev) prev.hidden = true;
      var pimg = $('communityPreviewImg'); if (pimg) pimg.src = '';
      var chips = $('communityChips'); if (chips) chips.innerHTML = '';
    } catch (e) { /* keep logout resilient */ }
  }
  /* Community logout (phone gate REMOVED): sirf local chat session
     band hota hai. Main BCAPrime login + library session untouched.
     Koi verification revoke nahi — dobara open seedha khulega. */
  async function revokeCommunityAccess() { return true; }
  async function logout() {
    close();
    resetSession();
    toast('Logged out of the community');
  }

  /* ---------- sending ---------- */
  function inputKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }
  function markCode(lang) {
    var t = $('communityInput');
    if (lang) t.placeholder = 'Paste your ' + (lang === 'cpp' ? 'C++' : 'JavaScript') + ' code here…';
    else t.placeholder = 'Message community…';
  }
  async function pickImage(input) {
    var f=input.files&&input.files[0];
    input.value='';
    if(!f)return;
    if(!/^image\//.test(f.type)){toast('Images only, please.');return;}
    if(f.size>MAX_IMAGE_BYTES){toast('Image too large \u2014 max 5 MB.');return;}
    toast('Checking image\u2026');
    var scan=null;
    try{scan=await scanImageSafety(f);}catch(e){scan={ok:true};}
    if(!scan||!scan.ok){toast((scan&&scan.reason)||'Blocked image.');return;}
    compress(f,function(blob){
      state.imageFile=blob;
      var pv=$('communityPreviewImg');
      if(pv){try{if(pv.src&&pv.src.indexOf('blob:')===0)URL.revokeObjectURL(pv.src);}catch(e){}pv.src=URL.createObjectURL(blob);pv.onclick=function(){openLightbox(pv.src);};}
      var wrap=$('communityImagePreview');
      if(wrap)wrap.hidden=false;
    });
  }
  /* Req1: code-block helpers */
  var CODE_LANG_ALIASES={c:'c',cpp:'cpp',js:'javascript',javascript:'javascript',py:'python',python:'python',java:'java',html:'xml',xml:'xml',sh:'bash',bash:'bash',txt:'plaintext',text:'plaintext','':'plaintext'};
  function normCodeLang(l){l=String(l||'').trim().toLowerCase();if(CODE_LANG_ALIASES[l])return CODE_LANG_ALIASES[l];if(/^[a-z0-9+#-]+$/.test(l))return l;return 'plaintext';}
  function autoLangFor(code){var t=String(code||'');
    if(/^\s*#(include|define)|std::|cout\s*<<|int\s+main\s*\(/.test(t))return 'cpp';
    if(/public\s+(static\s+)?(void|class)|System\.out\.println|import\s+java\./m.test(t))return 'java';
    if(/^\s*(def\s+\w+\s*\(|import\s+\w+|print\s*\()/.test(t))return 'python';
    if(/<\/?[a-z][^>]*>/i.test(t)&&/<\/(div|p|span|html|body)>|<!doctype/i.test(t))return 'xml';
    if(/function\s+\w+\s*\(|=>|console\.log|const\s+\w+\s*=|let\s+\w+\s*=/.test(t))return 'javascript';
    return 'plaintext';}
  function splitFenced(text){var parts=[],re=/```(\w*)\n?([\s\S]*?)```/g,last=0,m;
    while((m=re.exec(text))!==null){if(m.index>last)parts.push({kind:'text',text:text.slice(last,m.index)});
      parts.push({kind:'code',lang:m[1]||'',text:(m[2]||'').replace(/\n$/,'')});last=m.index+m[0].length;if(parts.length>24)break;}
    if(last<text.length)parts.push({kind:'text',text:text.slice(last)});return parts;}
  function looksLikeCode(t){var x=String(t||'');if(!x||x.length>4000)return false;if(/```/.test(x))return false;
    var lines=x.split('\n');if(lines.length<2&&x.length<60)return false;var sc=0;
    if(/[{};]\s*$/.test(x)||(/[{}]/.test(x)&&/;/.test(x)))sc+=2;
    if(/^\s*(public|private|class|void|int|function|const|let|var|def|import|#include|package|func)\b/m.test(x))sc+=2;
    if(/=>|console\.log|System\.out|printf\s*\(|cout\s*<</.test(x))sc+=2;
    if((x.match(/;/g)||[]).length>=2&&/[{}()]/.test(x))sc+=1;
    if(/^\s{2,}\S/m.test(x)&&/[(){}:]/.test(x))sc+=1;return sc>=3;}
  function copyText(txt,btn){
    function done(ok){if(btn){var o=btn.innerHTML;btn.innerHTML=ok?'<i>Copied</i>':'<i>Failed</i>';setTimeout(function(){btn.innerHTML=o;},1400);}else toast(ok?'Code copied to clipboard':'Copy failed');}
    function fb(){try{var ta=document.createElement('textarea');ta.value=txt;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand('copy');}catch(e){}document.body.removeChild(ta);done(!!ok);}catch(e){done(false);}}
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(function(){done(true);},fb);else fb();}
  function buildCodeBlock(codeText,langTag){var pre=document.createElement('pre');pre.className='msg-code';
    var bar=document.createElement('div');bar.className='msg-code-bar';
    var tag=document.createElement('span');tag.className='msg-code-lang';tag.textContent=String(langTag||autoLangFor(codeText)||'code');
    var btn=document.createElement('button');btn.type='button';btn.className='msg-code-copy';btn.textContent='Copy Code';btn.setAttribute('aria-label','Copy code to clipboard');
    btn.onclick=function(ev){ev.stopPropagation();copyText(codeText,btn);};
    bar.appendChild(tag);bar.appendChild(btn);pre.appendChild(bar);
    var code=document.createElement('code');code.className='language-'+normCodeLang(langTag||autoLangFor(codeText));code.textContent=codeText;pre.appendChild(code);
    try{if(window.hljs)window.hljs.highlightElement(code);}catch(e){}return pre;}
  /* Req3: in-app image lightbox (no new tab) */
  /* Req4: client-side image validation (size+decode+skin check, fail-open) */
  function scanImageSafety(file){
    return new Promise(function(resolve){
      function fail(reason){resolve({ok:false,reason:reason});}
      function pass(){resolve({ok:true});}
      if(!/^image\//.test(file.type||'')){fail('Images only, please.');return;}
      if(file.size>MAX_IMAGE_BYTES){fail('Image too large.');return;}
      var url='';
      try{url=URL.createObjectURL(file);}catch(e){pass();return;}
      var done=false;
      function fin(fn){if(done)return;done=true;try{URL.revokeObjectURL(url);}catch(e){}fn();}
      var img=new Image();
      img.onload=function(){try{
        var w=img.naturalWidth||0,h=img.naturalHeight||0;
        if(!w||!h){fin(pass);return;}
        if(w>8000||h>8000){fin(function(){fail('Image dimensions too large.');});return;}
        var S=48,cw=S,ch=Math.max(1,Math.round(S*h/w));
        if(ch>S*4){fin(pass);return;}
        var cv=document.createElement('canvas');cv.width=cw;cv.height=ch;
        var ctx=cv.getContext('2d',{willReadFrequently:true});
        if(!ctx){fin(pass);return;}
        ctx.drawImage(img,0,0,cw,ch);
        var d=ctx.getImageData(0,0,cw,ch).data;
        var skin=0,n=0,i,r,g,b;
        for(i=0;i<d.length;i+=4){r=d[i];g=d[i+1];b=d[i+2];n++;
          if(r>95&&g>40&&b>20&&(r-b)>15&&(r-g)>5&&r>g&&r>b)skin++;}
        if(n>0&&skin/n>0.5){fin(function(){fail('This image looks unsafe to share here.');});return;}
        fin(pass);
      }catch(e){fin(pass);}};
      img.onerror=function(){fin(function(){fail('Could not read that image.');});};
      img.src=url;
      setTimeout(function(){fin(pass);},8000);
    });
  }
  function openLightbox(url){
    if(!url)return;
    var lb=$('communityLightbox');
    if(!lb){try{window.open(url,'_blank','noopener');}catch(e){}return;}
    var img=$('communityLightboxImg');
    if(img)img.src=url;
    lb.hidden=false;lb.classList.add('open');
    try{document.body.style.overflow='hidden';}catch(e){}
  }
  function closeLightbox(){
    var lb=$('communityLightbox');
    if(lb){lb.classList.remove('open');lb.hidden=true;}
    var img=$('communityLightboxImg');
    if(img)img.src='';
    try{document.body.style.overflow='';}catch(e){}
  }
  document.addEventListener('keydown',function(e){
    if((e.key==='Escape'||e.key==='Esc')&&state.open){
      var lb=document.getElementById('communityLightbox');
      if(lb&&!lb.hidden){e.stopPropagation();closeLightbox();return;}
      var sheet=document.getElementById('chatActionSheet');
      var conf=document.getElementById('chatDeleteConfirm');
      if((sheet&&!sheet.hidden)||(conf&&!conf.hidden)){e.stopPropagation();closeActions();return;}
    }
  },true);
  /* Req2: desktop minimize/expand */
  function isDesktopChat(){try{return !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'')&&window.innerWidth>767;}catch(e){return true;}}
  function resetMinBtn(){try{var b=$('communityMinBtn');if(b){b.innerHTML='-';b.setAttribute('aria-label','Minimize chat');b.title='Minimize chat';}}catch(e){}}
  function toggleMinimize(){
    var sec=$('communitySection');
    if(!sec||!state.open)return;
    if(!isDesktopChat()){toast('Full-screen chat on mobile');return;}
    state.min=!state.min;
    sec.classList.toggle('min',state.min);
    try{var b=$('communityMinBtn');if(b){b.textContent=state.min?'+':'-';b.setAttribute('aria-label',state.min?'Expand chat':'Minimize chat');b.title=state.min?'Expand chat':'Minimize chat';}}catch(e){}
  }
  function clearImage() {
    state.imageFile = null;
    $('communityImagePreview').hidden = true;
    $('communityPreviewImg').src = '';
  }
  function compress(file, done) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      var scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function (b) { done(b || file); URL.revokeObjectURL(url); }, 'image/jpeg', 0.82);
    };
    img.onerror = function () { done(file); URL.revokeObjectURL(url); };
    img.src = url;
  }
  async function send() {
    var u = myUser();
    if (!u || state.sending) return;
    if (state.isBanned) { toast('You are restricted from community chat'); return; }
    var t = $('communityInput');
    var body = (t.value || '').trim();
    var lang = $('communityCodeLang').value || '';
    if (!body && !state.imageFile) return;
    var now = Date.now();
    if (now - state.lastSent < 1500) { toast('Slow down a little 🙂'); return; }
    state.sending = true; state.lastSent = now;
    var sendIcon = document.querySelector('.composer-send i');
    if (sendIcon) sendIcon.className = 'fa-solid fa-spinner fa-spin';
    try {
      var imageUrl = '';
      if (state.imageFile) {
        if (state.imageFile.size > MAX_IMAGE_BYTES) { toast('Image too large.'); clearImage(); return; }
        var path = 'chat/' + u.uid + '/' + now + '.jpg';
        var up = await SUPA.storage.from('chat-images').upload(path, state.imageFile, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw up.error;
        imageUrl = SUPA.storage.from('chat-images').getPublicUrl(path).data.publicUrl;
        clearImage();
      }
      var p = state.profiles[u.uid] || {};
      var msg = {
        channel: state.channel, uid: u.uid,
        author_name: p.name || p.username || u.displayName || 'Student',
        author_avatar: p.avatar_url || '',
        body: body, code_lang: body && lang ? lang : '',
        image_url: imageUrl,
        /* Room stamp: server policy rejects anything outside my room. */
        college: state.room.college || 'all',
        semester: state.room.semester
      };
      /* No phone gate: bas room profile sync retry. */
      async function tryInsert(payload) {
        var r = await SUPA.from('chat_messages').insert(payload).select().single();
        if (r.error && state.roomSupported && markRoomUnsupported(r.error)) {
          state.roomSupported = false;
          delete payload.college; delete payload.semester;
          return SUPA.from('chat_messages').insert(payload).select().single();
        }
        return r;
      }
      var sendRoomSynced = false;
      var res = await tryInsert(msg);
      if (res.error && state.roomSupported && !sendRoomSynced &&
          (res.error.code === '42501' || /policy/i.test(res.error.message || ''))) {
        /* Profile abhi purane room par hai → isi room par sync, ek retry. */
        sendRoomSynced = true;
        try {
          await SUPA.from('user_profiles').upsert({
            uid: u.uid, college: state.room.college || 'all', semester: state.room.semester
          }, { onConflict: 'uid' });
          try { await resolveRoomQuiet(); } catch (e2) {}
          msg.college = state.room.college || 'all';
          msg.semester = state.room.semester;
          res = await tryInsert(msg);
        } catch (e2) { /* fall through to the error toast below */ }
      }
      if (res.error) {
        if (/banned from community chat/i.test(res.error.message || '')) {
          state.isBanned = true;
          toast('You are restricted from community chat');
        } else if (markRoomUnsupported(res.error)) {
          /* handled above — legacy retry already attempted */
        }
        if (res.error.code === '42501' || /policy|permission|row-level/i.test(res.error.message || '')) {
          toast('Could not send — please login again and retry. (' + (res.error.message || 'policy') + ')');
        } else if (String(res.error.code) === '42703' || /column .*college|column .*semester/i.test(res.error.message || '')) {
          toast('Chat room upgrade pending — run supabase-chat-isolation.sql in Supabase, then retry.');
        } else { toast('Could not send: ' + (res.error.message || 'unknown error')); }
      } else {
        t.value = '';
        $('communityCodeLang').value = '';
        markCode('');
        if (inMyRoom(res.data)) {
          state.messages.push(res.data);
          appendMsg(res.data, { forceScroll: true });
        }
        storeNum(floorKey(state.channel), res.data && res.data.id ? res.data.id : storedNum(floorKey(state.channel)));
        scheduleRefresh();
        /* Cross-tab wake-up: other open tabs re-poll instantly. */
        try { localStorage.setItem('bca-chat-ping', String(Date.now())); } catch (e) {}
        /* Fan-out: the notify-chat fn pushes ONLY to same-room devices. */
        if (res.data && res.data.id) notifyRoomPush(res.data.id);
      }
    } catch (e) {
      toast('Network error — try again.');
    } finally {
      state.sending = false;
      if (sendIcon) sendIcon.className = 'fa-solid fa-paper-plane';
    }
  }

  /* ============================================================
     MESSAGE ACTIONS — emoji reactions, edit, delete
     · Mobile: long-press (hold ~480ms) → action sheet
     · Desktop: hover ⋮ button OR right-click → same sheet
     · Sync: RPC + Supabase Realtime
       (DB: supabase-chat-reactions-edits.sql — RUN IT FIRST)
     ============================================================ */
  var REACT_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'];
  var press = { timer: null, mid: null, x0: 0, y0: 0, fired: false };
  var suppressClickUntil = 0;

  /* ---------- "delete for me" hidden ids (localStorage + server sync) ----------
     Local hides instant hain; server (chat_hides) cross-device sync
     karta hai — dusra phone/tablet bhi wahi hide dekhega. */
  function hiddenIdsKey() { return 'bca-chat-hidden-msgs'; }
  function loadHiddenIds() {
    try {
      state.hiddenIds = {};
      var arr = JSON.parse(localStorage.getItem(hiddenIdsKey()) || '[]');
      if (Array.isArray(arr)) arr.forEach(function (id) { state.hiddenIds[Number(id)] = true; });
    } catch (e) { state.hiddenIds = {}; }
  }
  function persistHiddenIds() {
    try {
      var ids = Object.keys(state.hiddenIds);
      if (ids.length > 500) {
        ids = ids.slice(-500);
        state.hiddenIds = {};
        ids.forEach(function (k) { state.hiddenIds[k] = true; });
      }
      localStorage.setItem(hiddenIdsKey(), JSON.stringify(ids.map(Number)));
    } catch (e) { /* storage full / private mode */ }
  }
  function hideMessageForMe(id) {
    id = Number(id);
    if (!id) return;
    state.hiddenIds[id] = true;
    persistHiddenIds();
    removeMessageLocal(id);
    /* Server record (best-effort): dusre devices par bhi hidden. */
    try {
      var u = myUser();
      if (u && SUPA && SUPA.rpc) {
        SUPA.rpc('bca_hide_for_me', { p_message_id: id, p_uid: u.uid })
          .then(function () {}, function () {});
      }
    } catch (e) { /* offline-safe */ }
  }
  /* Login ke baad server hides pull karo (cross-device Delete-for-Me). */
  async function syncHiddenFromServer() {
    var u = myUser();
    if (!u || !SUPA) return;
    if (state.hidesSyncedFor === u.uid) return;
    try {
      var res = await SUPA.from('chat_hides').select('message_id').eq('uid', u.uid).limit(500);
      if (res.error) return; /* table abhi migrate nahi — local hides kaafi */
      (res.data || []).forEach(function (r) {
        var id = Number(r.message_id);
        if (id && !state.hiddenIds[id]) {
          state.hiddenIds[id] = true;
          removeMessageLocal(id);
        }
      });
      persistHiddenIds();
      state.hidesSyncedFor = u.uid;
    } catch (e) { /* offline-safe */ }
  }
  /* Admin flag + ban status: open() par resolve hota hai (UI gating). */
  async function syncModerationRole() {
    state.isAdmin = false; state.isBanned = false;
    var u = myUser();
    if (!u || !SUPA) return;
    try {
      var prof = await SUPA.from('user_profiles').select('is_admin').eq('uid', u.uid).maybeSingle();
      if (prof.data && prof.data.is_admin === true) state.isAdmin = true;
    } catch (e) { /* column abhi migrate nahi — admin off */ }
    try {
      var ban = await SUPA.from('chat_bans').select('uid,expires_at').eq('uid', u.uid).maybeSingle();
      if (ban.data && ban.data.uid) {
        var exp = ban.data.expires_at ? new Date(ban.data.expires_at).getTime() : 0;
        state.isBanned = (!exp || exp > Date.now());
      }
    } catch (e) { /* table abhi migrate nahi — banned off */ }
  }

  /* ---------- action sheet: open / close / build ---------- */
  function openActions(m) {
    if (!m) return;
    closeActions();
    var u = myUser();
    state.actionMsg = m;
    /* preview line (author + snippet) */
    var pv = $('chatSheetPreview');
    if (pv) {
      var name = (state.profiles[m.uid] || {}).name || m.author_name || 'Student';
      var snip = String(m.body || '').replace(/\s+/g, ' ').trim();
      pv.textContent = (m.uid && u && m.uid === u.uid ? 'You' : name) + ': ' + (snip || '📷 Photo');
      pv.hidden = false;
    }
    /* emoji row (highlights the emojis YOU already used) */
    var rw = $('chatSheetReactions');
    if (!rw) return;
    rw.innerHTML = '';
    var mineMap = {};
    (state.reactions[m.id] || []).forEach(function (r) { if (u && r.uid === u.uid) mineMap[r.emoji] = true; });
    REACT_EMOJIS.forEach(function (em) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sheet-emoji' + (mineMap[em] ? ' mine' : '');
      b.textContent = em;
      b.setAttribute('aria-label', 'React with ' + em);
      b.onclick = function (ev) { ev.stopPropagation(); closeActions(); toggleReaction(m, em); };
      rw.appendChild(b);
    });
    /* Edit / Delete rows (owner-only where it matters; admins moderate any) */
    var aw = $('chatSheetActions');
    if (!aw) return;
    aw.innerHTML = '';
    var isMine = !!(u && m.uid && m.uid === u.uid);
    var isAdm = !!state.isAdmin;
    var gone = isDeleted(m);
    if (!gone && isMine && String(m.body || '').trim()) {
      addSheetAction(aw, 'fa-pen', 'Edit', function () { startEdit(m); });
    }
    if (!gone && (isMine || isAdm)) {
      addSheetAction(aw, 'fa-trash',
        isAdm && !isMine ? 'Delete (admin)…' : 'Delete for everyone…',
        function () { askDelete(m, 'all'); }, true);
    }
    if (!gone) {
      addSheetAction(aw, 'fa-user-slash', 'Delete for me…', function () { askDelete(m, 'me'); });
    }
    var sheet = $('chatActionSheet');
    if (!sheet) return;
    sheet.hidden = false;
    state.sheetOpenedAt = Date.now();
  }
  function addSheetAction(wrap, icon, label, fn, danger) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sheet-action' + (danger ? ' danger' : '');
    b.innerHTML = '<i class="fa-solid ' + icon + '"></i>';
    b.appendChild(document.createTextNode(label));
    b.onclick = function (ev) { ev.stopPropagation(); fn(); };
    wrap.appendChild(b);
  }
  function closeActions() {
    state.actionMsg = null;
    state.deleteCtx = null;
    ['chatActionSheet', 'chatDeleteConfirm'].forEach(function (id) {
      var el = $(id);
      if (el) { el.classList.remove('open'); el.hidden = true; }
    });
  }
  function sheetBackdrop(ev) {
    /* ignore the click synthesized right when a long-press is released */
    if (Date.now() - (state.sheetOpenedAt || 0) < 450) return;
    if (ev && ev.target && ev.target === ev.currentTarget) closeActions();
  }

  /* ---------- reactions: optimistic UI + realtime + RPC ---------- */
  async function toggleReaction(m, emoji) {
    if (!m || !m.id || !emoji) return;
    var u = myUser();
    if (!u) { toast('Login to react'); return; }
    if (!state.reactionsSupported) {
      if (!state.reactionsNotified) toast('Reactions upgrade pending — run supabase-chat-reactions-edits.sql in Supabase SQL Editor.');
      return;
    }
    var list = state.reactions[m.id] || (state.reactions[m.id] = []);
    var mineIdx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].uid === u.uid && list[i].emoji === emoji) { mineIdx = i; break; }
    }
    var add = mineIdx < 0;
    /* optimistic update — the tap feels instant, the RPC confirms after */
    if (add) list.push({ id: 0, uid: u.uid, emoji: emoji });
    else list.splice(mineIdx, 1);
    if (!list.length) delete state.reactions[m.id];
    refreshMsgDom(m);
    try {
      var res = await SUPA.rpc('bca_toggle_reaction', { p_message_id: m.id, p_uid: u.uid, p_emoji: emoji, p_add: add });
      if (res.error) {
        /* roll the optimistic change back */
        var l2 = state.reactions[m.id] || [];
        if (add) {
          for (var j = l2.length - 1; j >= 0; j--) {
            if (l2[j].uid === u.uid && l2[j].emoji === emoji && !l2[j].id) { l2.splice(j, 1); break; }
          }
        } else {
          l2.push({ id: 0, uid: u.uid, emoji: emoji });
        }
        if (!l2.length) delete state.reactions[m.id];
        refreshMsgDom(m);
        if (!markOpsUnsupported(res.error)) toast('Reaction failed: ' + (res.error.message || 'error'));
      }
    } catch (e) { /* network hiccup — the 5s reaction sync reconciles */ }
  }

  /* ---------- inline edit (Edit action) ---------- */
  function startEdit(m) {
    closeActions();
    if (!m || !m.id) return;
    if (isDeleted(m)) { toast('Deleted messages cannot be edited'); return; }
    var u = myUser();
    if (!u || m.uid !== u.uid) { toast('Only the author can edit'); return; }
    /* close any OTHER open inline editor first */
    if (state.editingId && state.editingId !== m.id) {
      var prev = findLoaded(state.editingId);
      state.editingId = null;
      if (prev) refreshMsgDom(prev);
    }
    refreshMsgDom(m); /* clean base state */
    var wrap = getMsgEl(m.id);
    var bubble = wrap && wrap.querySelector('.msg-bubble');
    if (!bubble) return;
    state.editingId = m.id;
    Array.prototype.forEach.call(bubble.children, function (ch) {
      if (!ch.classList.contains('msg-head')) ch.style.display = 'none';
    });
    var ed = document.createElement('div');
    ed.className = 'msg-edit';
    var ta = document.createElement('textarea');
    ta.value = String(m.body || '');
    ta.maxLength = 4000;
    ta.rows = 3;
    ta.setAttribute('aria-label', 'Edit message');
    var btns = document.createElement('div');
    btns.className = 'msg-edit-btns';
    var cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'cancel'; cancel.textContent = 'Cancel';
    var save = document.createElement('button');
    save.type = 'button'; save.className = 'save'; save.textContent = 'Save';
    var hint = document.createElement('div');
    hint.className = 'msg-edit-hint';
    hint.textContent = 'Esc to cancel · Ctrl+Enter to save';
    btns.appendChild(cancel); btns.appendChild(save);
    ed.appendChild(ta); ed.appendChild(btns); ed.appendChild(hint);
    bubble.appendChild(ed);
    cancel.onclick = function () { cancelEdit(m); };
    save.onclick = function () { saveEdit(m, ta); };
    ta.onkeydown = function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Escape') { ev.preventDefault(); cancelEdit(m); }
      else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); saveEdit(m, ta); }
    };
    ta.focus();
    try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {}
  }
  function cancelEdit(m) {
    state.editingId = null;
    if (m) refreshMsgDom(m);
  }
  async function saveEdit(m, ta) {
    var u = myUser();
    if (!u || !m || m.uid !== u.uid) { toast('Not allowed'); return; }
    var text = String(ta.value == null ? '' : ta.value);
    if (!text.trim()) { toast('Message cannot be empty'); return; }
    if (text.length > 4000) { toast('Too long — max 4000 characters'); return; }
    if (text === String(m.body || '')) { cancelEdit(m); return; }
    if (state.savingEdit) return;
    state.savingEdit = true;
    try {
      var res = await SUPA.rpc('bca_edit_message', { p_id: m.id, p_uid: u.uid, p_body: text });
      if (res.error) {
        if (!markOpsUnsupported(res.error)) toast('Could not edit: ' + (res.error.message || 'error'));
        return; /* stay in edit mode so the typed text isn't lost */
      }
      m.body = text;
      var row = (Array.isArray(res.data) && res.data[0]) ? res.data[0] : null;
      m.edited_at = (row && row.edited_at) || new Date().toISOString();
      state.editingId = null;
      refreshMsgDom(m);
      toast('Message edited');
    } catch (e) {
      toast('Network error — try again.');
    } finally {
      state.savingEdit = false;
    }
  }

  /* ---------- delete: for everyone (server tombstone) / for me (hide) ----------
     Server contract (supabase-chat-deletion-moderation.sql):
     - bca_soft_delete_message(p_id, p_uid) -> {ok, error?}
       sender-only, 48h time window, tombstone "This message was deleted".
     - bca_admin_delete_message(p_id, p_uid, p_reason?) -> {ok, error?}
       admin-only, kisi ka bhi message, tombstone "…deleted by an admin".
     Dono UPDATE events hain -> sab clients realtime sync (no reload). */
  function deleteWindowLeft(m) {
    try {
      if (!m || !m.created_at) return '';
      var ageMs = Date.now() - new Date(m.created_at).getTime();
      var leftMs = (48 * 3600 * 1000) - ageMs;
      if (leftMs <= 0) return 'expired';
      var h = Math.floor(leftMs / 3600000);
      if (h >= 1) return 'about ' + h + 'h left';
      var min = Math.max(1, Math.floor(leftMs / 60000));
      return 'about ' + min + 'm left';
    } catch (e) { return ''; }
  }
  function askDelete(m, scope) {
    if (!m) return;
    var t = $('chatDeleteTitle'), x = $('chatDeleteText');
    if (!t || !x) return;
    state.deleteCtx = { m: m, scope: scope };
    if (scope === 'all') {
      var u = myUser();
      var mine = !!(u && m.uid && u.uid === m.uid);
      if (state.isAdmin && !mine) {
        t.textContent = 'Delete this message (admin)?';
        x.textContent = 'It will show "This message was deleted by an admin" for everyone. This is logged for moderation.';
      } else {
        var left = deleteWindowLeft(m);
        t.textContent = 'Delete for everyone?';
        x.textContent = left === 'expired'
          ? 'The 48-hour delete window has expired — ask an admin to remove it.'
          : 'This message will show "This message was deleted" for everyone in this room.' +
            (left ? ' (' + left + ' to delete.)' : '');
      }
    } else {
      t.textContent = 'Delete for me?';
      x.textContent = 'The message will be hidden on your devices. Others will still see it.';
    }
    var sheet = $('chatActionSheet');
    if (sheet) { sheet.classList.remove('open'); sheet.hidden = true; }
    var conf = $('chatDeleteConfirm');
    if (conf) { conf.hidden = false; state.sheetOpenedAt = Date.now(); }
  }
  function confirmDelete() {
    var ctx = state.deleteCtx;
    closeActions();
    if (!ctx || !ctx.m) return;
    if (ctx.scope === 'me') {
      hideMessageForMe(ctx.m.id);
      toast('Message hidden for you');
    } else {
      deleteForEveryone(ctx.m);
    }
  }
  async function deleteForEveryone(m) {
    var u = myUser();
    if (!u) { toast('Login required'); return; }
    var mine = !!(m.uid && u.uid === m.uid);
    var fn = (state.isAdmin && !mine) ? 'bca_admin_delete_message' : 'bca_soft_delete_message';
    try {
      var res = await SUPA.rpc(fn, { p_id: m.id, p_uid: u.uid });
      if (res.error) {
        if (!markOpsUnsupported(res.error)) toast('Could not delete: ' + (res.error.message || 'error'));
        return;
      }
      var payload = res.data;
      if (payload && typeof payload === 'object' && payload.ok === false) {
        var err = String(payload.error || 'error');
        if (err === 'time-window-expired') toast('Delete window expired (48h) — ask an admin');
        else if (err === 'not-your-message') toast('You can only delete your own messages');
        else if (err === 'admin-only') toast('Admin only');
        else toast('Could not delete: ' + err);
        return;
      }
      if (payload === false) { toast('You can only delete your own messages'); return; }
      /* Optimistic tombstone — realtime UPDATE event final state dega. */
      m.is_deleted = true;
      m.deleted_by = (fn === 'bca_admin_delete_message') ? 'admin' : 'self';
      m.body = (fn === 'bca_admin_delete_message')
        ? 'This message was deleted by an admin'
        : 'This message was deleted';
      m.image_url = ''; m.code_lang = ''; m.edited_at = null;
      refreshMsgDom(m);
      toast(fn === 'bca_admin_delete_message' ? 'Deleted by admin' : 'Message deleted for everyone');
    } catch (e) {
      toast('Network error — try again.');
    }
  }

  /* ============================================================
     INPUT TRIGGERS
     · touch long-press (mobile)  → sheet after ~480ms hold
     · contextmenu (right-click)  → same sheet (desktop)
     · click on the hover ⋮       → same sheet (desktop)
     · click on a reaction pill   → toggle that reaction
     ============================================================ */
  function msgFromTarget(t) {
    var el = t && t.closest ? t.closest('.msg') : null;
    if (!el) return null;
    var id = Number(el.getAttribute('data-mid'));
    return id ? findLoaded(id) : null;
  }
  function fireLongPress() {
    press.fired = true;
    suppressClickUntil = Date.now() + 700;
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
    var m = press.mid ? findLoaded(press.mid) : null;
    if (m && state.editingId !== m.id) openActions(m);
  }
  function endPress() {
    if (press.timer) { clearTimeout(press.timer); press.timer = null; }
    press.mid = null;
    var box = $('communityMessages');
    if (box) box.classList.remove('holding');
  }

  try {
    var msgBox = $('communityMessages');
    if (msgBox) {
      /* --- MOBILE: long-press (hold) opens the action sheet --- */
      msgBox.addEventListener('touchstart', function (e) {
        if (!e.touches || e.touches.length !== 1) return;
        if (e.target.closest && e.target.closest('.msg-menu,.msg-react,.msg-edit,.msg-code-copy')) return;
        var wrap = e.target.closest && e.target.closest('.msg');
        if (!wrap) return;
        var id = Number(wrap.getAttribute('data-mid'));
        if (!id || !findLoaded(id)) return;
        var t = e.touches[0];
        press.mid = id;
        press.fired = false;
        press.x0 = t.clientX; press.y0 = t.clientY;
        msgBox.classList.add('holding'); /* blocks text selection during hold */
        if (press.timer) clearTimeout(press.timer);
        press.timer = setTimeout(fireLongPress, 480);
      }, { passive: true });
      msgBox.addEventListener('touchmove', function (e) {
        if (!press.timer) return;
        var t = e.touches && e.touches[0];
        if (!t) return;
        /* finger scrolled away → this is a scroll, not a hold */
        if (Math.abs(t.clientX - press.x0) > 12 || Math.abs(t.clientY - press.y0) > 12) endPress();
      }, { passive: true });
      msgBox.addEventListener('touchend', function (e) {
        var fired = press.fired;
        endPress();
        if (fired) {
          /* swallow the synthesized click so it can't close the sheet
             (or zoom into the image underneath) */
          suppressClickUntil = Date.now() + 500;
          if (e.cancelable) e.preventDefault();
        }
      }, { passive: false });
      msgBox.addEventListener('touchcancel', function () { endPress(); });

      /* --- DESKTOP: right-click opens the same sheet --- */
      msgBox.addEventListener('contextmenu', function (e) {
        var m = msgFromTarget(e.target);
        if (!m) return;
        e.preventDefault();
        openActions(m);
      });

      /* --- DESKTOP hover ⋮ + reaction pill taps (capture: wins first) --- */
      msgBox.addEventListener('click', function (e) {
        if (Date.now() < suppressClickUntil) { e.stopPropagation(); return; }
        var pill = e.target.closest && e.target.closest('.msg-react');
        if (pill) {
          var mp = msgFromTarget(pill);
          if (mp) toggleReaction(mp, pill.getAttribute('data-emoji') || '');
          return;
        }
        var menu = e.target.closest && e.target.closest('.msg-menu');
        if (menu) {
          e.stopPropagation();
          var mm = msgFromTarget(menu);
          if (mm) openActions(mm);
        }
      }, true);
    }
  } catch (e) { /* interaction wiring is best-effort */ }

  /* ---------- Floating Action Button ---------- */
  window.BCAFab = {
    toggle: function () {
      var m = $('fabMenu');
      m.hidden = !m.hidden;
      $('mainFab').classList.toggle('open', !m.hidden);
    },
    action: function (kind) {
      $('fabMenu').hidden = true;
      $('mainFab').classList.remove('open');
      if (kind === 'upload') { try { openUpload(); } catch (e) { toast('Login to upload material'); } }
      if (kind === 'community') { window.BCAChat.open(); }
      if (kind === 'senior') { try { openSeniorRequest(); } catch (e) { toast('Login to ask seniors'); } }
    }
  };
  /* close the FAB menu on outside click */
  document.addEventListener('click', function (e) {
    var menu = $('fabMenu');
    if (menu && !menu.hidden && !e.target.closest('.fab-wrap')) {
      menu.hidden = true; $('mainFab').classList.remove('open');
    }
  });

  /* Enter-key handler for the composer (OTP box hata diya gaya). */

  /* ---------- public API ---------- */
  /* Room-schema probe: check whether the isolation SQL is live BEFORE
     creating the realtime transport, so the watcher never builds a
     room-filtered channel against an unmigrated table. */
  async function probeRoomSupport() {
    if (!SUPA || !state.roomSupported) return;
    try {
      var res = await SUPA.from('chat_messages').select('id,college,semester').limit(1);
      if (res.error) markRoomUnsupported(res.error);
    } catch (e) { markRoomUnsupported(e); }
  }
  /* In-flight guard so back-to-back 1s polls never overlap. */
  var openPollBusy = false;

  /* ---------- reactions: initial load + schema guard ---------- */
  async function loadReactions() {
    state.reactions = {};
    if (!SUPA || !state.reactionsSupported) return;
    var ids = [];
    for (var i = 0; i < state.messages.length; i++) if (state.messages[i].id) ids.push(state.messages[i].id);
    if (!ids.length) return;
    try {
      var res = await SUPA.from('chat_reactions').select('id,message_id,uid,emoji').in('message_id', ids).limit(1000);
      if (res.error) { markReactionsUnsupported(res.error); return; }
      (res.data || []).forEach(function (r) {
        (state.reactions[r.message_id] = state.reactions[r.message_id] || [])
          .push({ id: r.id, uid: r.uid, emoji: r.emoji });
      });
    } catch (e) { /* offline-safe */ }
  }
  /* Is the reactions/edit/delete DB upgrade (supabase-chat-
     reactions-edits.sql) still missing on this project? */
  function isMissingFeature(err) {
    var code = String((err && err.code) || '');
    var msg = String((err && (err.message || err.details || err.hint)) || '');
    return code === '42883' || code === 'PGRST202' || code === '42P01' || code === '42703' ||
      /does not exist|schema cache|could not find the table/i.test(msg);
  }
  function markReactionsUnsupported(err) {
    if (!isMissingFeature(err) || !state.reactionsSupported) return;
    state.reactionsSupported = false;
    if (!state.reactionsNotified) {
      state.reactionsNotified = true;
      toast('Reactions upgrade pending — run supabase-chat-reactions-edits.sql in Supabase SQL Editor.');
    }
  }
  function markOpsUnsupported(err) {
    if (!isMissingFeature(err)) return false;
    state.opsSupported = false;
    if (!state.opsNotified) {
      state.opsNotified = true;
      toast('Edit/Delete upgrade pending — run supabase-chat-reactions-edits.sql in Supabase SQL Editor.');
    }
    return true;
  }
  function canonReactions(list) {
    return (list || []).map(function (r) { return r.uid + '|' + r.emoji; }).sort().join(',');
  }
  /* Reactions safety net every ~5s while chat is open (realtime is the
     fast path) — reconciles any missed reaction INSERT/DELETE events. */
  async function syncReactionsQuiet() {
    if (!SUPA || !state.reactionsSupported || !state.open) return;
    var ids = [];
    for (var i = 0; i < state.messages.length; i++) if (state.messages[i].id) ids.push(state.messages[i].id);
    if (!ids.length) return;
    try {
      var res = await SUPA.from('chat_reactions').select('id,message_id,uid,emoji').in('message_id', ids).limit(1000);
      if (res.error) { markReactionsUnsupported(res.error); return; }
      var fresh = {};
      (res.data || []).forEach(function (r) {
        (fresh[r.message_id] = fresh[r.message_id] || []).push({ id: r.id, uid: r.uid, emoji: r.emoji });
      });
      ids.forEach(function (mid) {
        if (canonReactions(state.reactions[mid]) === canonReactions(fresh[mid])) return;
        state.reactions[mid] = fresh[mid] || [];
        var m = findLoaded(mid);
        if (m) refreshMsgDom(m);
      });
    } catch (e) { /* best-effort */ }
  }

  /* Poll safety net: while the chat is OPEN, a silent 1-second merge-poll
     keeps the conversation perfectly fresh — new messages, remote EDITS
     and remote DELETES all appear with ZERO manual refresh (scroll is
     only auto-followed when already at the bottom, like WhatsApp).
     Realtime, when working, is additive on top of this. */
  var reactionSyncTicks = 0;
  async function refreshOpenView() {
    if (!SUPA || !state.open || openPollBusy) return;
    openPollBusy = true;
    try {
      var q = SUPA.from('chat_messages').select('*')
        .eq('channel', state.channel);
      if (state.roomSupported) {
        q = q.eq('college', state.room.college);
        if (state.room.semester == null) q = q.is('semester', null);
        else q = q.eq('semester', state.room.semester);
      }
      q = q.order('id', { ascending: false }).limit(100);
      var res = await q;
      if (res.error) { if (state.roomSupported && markRoomUnsupported(res.error)) state.roomSupported = false; return; }
      reconcileRows(res.data || []);
      if (++reactionSyncTicks >= 5) { reactionSyncTicks = 0; syncReactionsQuiet(); }
    } catch (e) { /* poll is best-effort */ }
    finally { openPollBusy = false; }
  }
  /* Single reconcile pass: append new rows, re-render edited + soft-deleted
     rows (delete-for-everyone tombstones), drop legacy hard-deleted rows. */
  function reconcileRows(descRows) {
    var box = $('communityMessages');
    if (!box) return;
    var rows = descRows.slice().reverse(); /* ascending by id */
    var atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    var added = 0, lastId = 0, changed = [];
    var i, m, r;
    if (!rows.length) {
      /* channel drained on the server — clear whatever we still show */
      for (i = state.messages.length - 1; i >= 0; i--) removeMessageLocal(state.messages[i].id);
      return;
    }
    var byId = {};
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      byId[r.id] = r;
      if (r.id > lastId) lastId = r.id;
    }
    var windowMin = rows[0].id; /* oldest row fetched */
    /* deletions: loaded ids INSIDE the window that vanished (legacy hard delete) */
    for (i = state.messages.length - 1; i >= 0; i--) {
      m = state.messages[i];
      if (m.id >= windowMin && !byId[m.id]) removeMessageLocal(m.id);
    }
    /* edits + soft-delete tombstones + additions */
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      m = findLoaded(r.id);
      if (m) {
        if (m.body !== r.body || m.edited_at !== r.edited_at ||
            m.code_lang !== r.code_lang || m.image_url !== r.image_url ||
            (!!m.is_deleted !== !!r.is_deleted) || m.deleted_by !== r.deleted_by) {
          m.body = r.body; m.edited_at = r.edited_at;
          m.code_lang = r.code_lang; m.image_url = r.image_url;
          m.is_deleted = r.is_deleted; m.deleted_by = r.deleted_by;
          m.deleted_at = r.deleted_at; m.deleted_by_uid = r.deleted_by_uid;
          changed.push(m);
        }
        continue;
      }
      if (state.seenIds[r.id] || state.hiddenIds[r.id]) continue;
      if (!inMyRoom(r)) continue;
      state.seenIds[r.id] = true;
      state.messages.push(r);
      box.appendChild(buildMsg(r));
      if (r.uid) loadProfiles([r.uid]);
      added++;
    }
    if (added) {
      if (atBottom) box.scrollTop = box.scrollHeight;
      if (lastId) storeNum(floorKey(state.channel), Math.max(storedNum(floorKey(state.channel)), lastId));
      scheduleRefresh();
    }
    for (i = 0; i < changed.length; i++) refreshMsgDom(changed[i]);
  }
  /* College/semester changed (profile, onboarding, another tab): rebuild
     the room socket + reload history — works open OR closed. */
  function onRoomMaybeChanged() {
    var oldKey = myRoomKey();
    state.room.college = myCollege();
    state.room.semester = mySemester();
    state.room.label = roomLabel(state.room.college, state.room.semester);
    var newKey = myRoomKey();
    if (oldKey === newKey && rtClock.roomKey === newKey) return;
    if (!state.open) {
      ensureRoomChannel(true);
      refreshUnread();
    } else {
      state.messages = [];
      state.seenIds = {};
      var box = $('communityMessages'); if (box) box.innerHTML = '';
      switchChannel(state.channel);
    }
  }
  /* Background watcher: while the chat is closed, keep ONE room-scoped
     subscription + a lightweight poll so the Community badge stays
     WhatsApp-fresh. Started once on page boot (SUPA may arrive late). */
  var bgStarted = false, bgPoll = null, bootTimer = null;
  /* Re-arm the poll timer at the right cadence for the chat state. */
  function schedulePoll() {
    if (bgPoll) { clearInterval(bgPoll); bgPoll = null; }
    var ms = state.open ? OPEN_POLL_MS : ROOM_POLL_MS;
    bgPoll = setInterval(function () {
      try {
        if (document.visibilityState !== 'visible') return;
        if (state.open) refreshOpenView(); else refreshUnread();
      } catch (e) {}
    }, ms);
  }
  function startBackgroundWatcher() {
    if (bgStarted) return;
    if (typeof SUPA === 'undefined' || !SUPA) {
      if (!bootTimer) bootTimer = setTimeout(function () { bootTimer = null; startBackgroundWatcher(); }, 1500);
      return;
    }
    bgStarted = true;
    resolveRoom().then(function () {
      return probeRoomSupport();
    }).then(function () {
      subscribe(); /* room-filtered, profile-independent */
      refreshUnread();
    }).catch(function () {});
    /* Poll cadence changes with chat state: fast merge-polls while the
       chat is OPEN, light unread polls while it is closed. */
    schedulePoll();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        if (state.open) refreshOpenView(); else refreshUnread();
      }
    });
    /* College/semester changed elsewhere (profile/onboarding) → new room.
       bca-chat-ping is a cross-tab wake-up so the OTHER tab re-polls the
       moment a message is sent — near-instant without realtime. */
    window.addEventListener('storage', function (e) {
      if (!e) return;
      if (e.key === 'bca-college' || e.key === 'bca-sem') {
        onRoomMaybeChanged();
        return;
      }
      if (e.key === 'bca-chat-ping') {
        if (state.open) refreshOpenView(); else refreshUnread();
      }
    });
    try {
      document.addEventListener('bca-room-changed', function () {
        try { resolveRoomQuiet().then(function () { onRoomMaybeChanged(); }); } catch (e) {}
      });
    } catch (e) {}
  }
  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startBackgroundWatcher);
    else startBackgroundWatcher();
  } catch (e) {}
  window.BCAChat = {
    open: open, close: close,
    send: send, inputKey: inputKey, markCode: markCode,
    pickImage: pickImage, clearImage: clearImage,
    toggleMinimize: toggleMinimize, openLightbox: openLightbox, closeLightbox: closeLightbox,
    closeActions: closeActions, sheetBackdrop: sheetBackdrop, confirmDelete: confirmDelete,
    refreshUnread: refreshUnread, unreadCount: function () { return state.unread; },
    roomInfo: function () { return { college: state.room.college, semester: state.room.semester, label: state.room.label }; },
    /* Admin moderation (supabase-chat-deletion-moderation.sql RPCs). */
    isAdmin: function () { return !!state.isAdmin; },
    adminDelete: function (id) {
      var m = Number(id) ? findLoaded(Number(id)) : null;
      if (m) { askDelete(m, 'all'); return true; }
      return false;
    },
    banUser: async function (uid, reason, days) {
      var me = myUser();
      if (!me) { toast('Login required'); return { ok: false }; }
      try {
        var res = await SUPA.rpc('bca_ban_user',
          { p_uid: me.uid, p_target_uid: String(uid || ''), p_reason: String(reason || ''), p_days: days || null });
        if (res.error) { toast('Ban failed: ' + res.error.message); return { ok: false, error: res.error.message }; }
        return res.data || { ok: true };
      } catch (e) { toast('Network error — try again.'); return { ok: false }; }
    },
    unbanUser: async function (uid) {
      var me = myUser();
      if (!me) { toast('Login required'); return { ok: false }; }
      try {
        var res = await SUPA.rpc('bca_unban_user', { p_uid: me.uid, p_target_uid: String(uid || '') });
        if (res.error) { toast('Unban failed: ' + res.error.message); return { ok: false }; }
        return res.data || { ok: true };
      } catch (e) { toast('Network error — try again.'); return { ok: false }; }
    }
  };
})();
