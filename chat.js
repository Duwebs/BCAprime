/* ============================================================
   BCAPrime — chat.js (Community Chat hub)
   WhatsApp-style community chat: subject channels, real-time
   sync via Supabase Realtime, phone-verification gate, code
   highlighting (C++/JS), image sharing, pinned announcements.

   SECURITY MODEL:
   - The phone-verification gate is enforced SERVER-SIDE by RLS
     (chat_messages insert policy -> is_phone_verified_student).
   - Client checks here are UX only (fast feedback + modal).
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

  /* ---------- country codes (flag + dial) - auto-detected below ----------
     The Community Chat mobile verification gate supports these 8 countries ONLY. */
  var COUNTRIES = {
    IN:{dial:'91',name:'India'},        NP:{dial:'977',name:'Nepal'},
    BD:{dial:'880',name:'Bangladesh'},  UZ:{dial:'998',name:'Uzbekistan'},
    AF:{dial:'93',name:'Afghanistan'},  PK:{dial:'92',name:'Pakistan'},
    BT:{dial:'975',name:'Bhutan'},      LK:{dial:'94',name:'Sri Lanka'}
  };
  function flagOf(cc) {
    try {
      return cc.toUpperCase().replace(/[A-Z]/g, function (c) {
        return String.fromCodePoint(127397 + c.charCodeAt(0));
      });
    } catch (e) { return ''; }
  }
  /* Auto-detect: browser locale region (en-IN -> IN), fallback India */
  function detectCountry() {
    var regions = [];
    try { regions.push(Intl.DateTimeFormat().resolvedOptions().locale); } catch (e) {}
    try { regions = regions.concat(navigator.languages || []); } catch (e) {}
    try { if (navigator.language) regions.push(navigator.language); } catch (e) {}
    for (var i = 0; i < regions.length; i++) {
      var m = String(regions[i] || '').match(/[-_]([A-Za-z]{2})(?:$|[-_])/);
      if (m && COUNTRIES[m[1].toUpperCase()]) return m[1].toUpperCase();
    }
    return 'IN';
  }
  function populateCountries() {
    var sel = $('phoneCountry');
    if (!sel) return;
    var cc = detectCountry();
    var opts = [];
    Object.keys(COUNTRIES).forEach(function (code) {
      var c = COUNTRIES[code];
      opts.push('<option value="' + code + '"' + (code === cc ? ' selected' : '') + '>' + flagOf(code) + ' ' + c.name + ' (+' + c.dial + ')</option>');
    });
    sel.innerHTML = opts.join('');
  }
  var MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  var state = {
    open: false, channel: 'general-chat',
    messages: [], profiles: {}, lastSent: 0, sending: false,
    imageFile: null, pendingCode: null, min: false,
    rtChannel: null, profileRt: null, seenIds: {},
    pendingMobile: '', phoneCredResult: null, phoneAppVerifier: null,
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
      var msg = String((err && (err.message || err.details || err.hint)) || '');
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

  /* ---------- profile linking (live) ---------- */
  async function loadProfiles(uids) {
    if (!SUPA || !uids.length) return;
    try {
      var res = await SUPA.from('user_profiles').select('uid,name,username,avatar_url,is_phone_verified').in('uid', uids);
      (res.data || []).forEach(function (p) { state.profiles[p.uid] = p; });
      document.querySelectorAll('#communityMessages .msg[data-uid]').forEach(function (el) {
        var p = state.profiles[el.getAttribute('data-uid')]; if (!p) return;
        var nameEl = el.querySelector('.msg-name'); var avEl = el.querySelector('.msg-avatar');
        if (nameEl) nameEl.innerHTML = esc(p.name || p.username || 'Student') + ' ' + (p.is_phone_verified ? '<span class="verified-badge" title="Verified Student"><i class="fa-solid fa-circle-check"></i></span>' : '');
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

  /* ---------- message rendering ---------- */
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
      img.onclick=function(){ openLightbox(m.image_url); };
      el.appendChild(img);
    }
    return el;
  }
  function buildMsg(m) {
    var mine = myUser() && m.uid === myUser().uid;
    var wrap = document.createElement('div');
    wrap.className = 'msg' + (mine ? ' mine' : '');
    wrap.setAttribute('data-uid', m.uid || '');
    var p = state.profiles[m.uid] || {};
    wrap.innerHTML =
      '<img class="msg-avatar" alt="" src="' + esc(p.avatar_url || m.author_avatar || '') + '" onerror="this.style.visibility=\'hidden\'">' +
      '<div class="msg-bubble">' +
      '<div class="msg-head"><span class="msg-name">' + esc(p.name || p.username || m.author_name || 'Student') + '</span>' +
      (p.is_phone_verified ? '<span class="verified-badge" title="Verified Student"><i class="fa-solid fa-circle-check"></i></span>' : '') +
      '<span class="msg-time">' + time(m.created_at) + '</span></div>' +
      '</div>';
    wrap.querySelector('.msg-bubble').appendChild(renderBody(m));
    return wrap;
  }
  function appendMsg(m, opts) {
    opts = opts || {};
    if (m.id && state.seenIds[m.id]) return;
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
     One realtime subscription per ROOM: college rides on the wire as
     the transport filter, semester/channel are checked client-side.
     Rows from any other college/semester are dropped before render
     AND before unread — zero access, zero leakage. */
  var refreshTimer = null;
  function unsubscribe() {
    if (state.rtChannel) { try { SUPA.removeChannel(state.rtChannel); } catch (e) {} state.rtChannel = null; }
  }
  function subscribe() {
    if (!SUPA) return;
    unsubscribe();
    /* Legacy mode (columns missing): old per-channel subscription so
       realtime keeps working until the isolation SQL is run. */
    if (!state.roomSupported) {
      state.rtChannel = SUPA.channel('community:' + state.channel)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'channel=eq.' + state.channel },
          function (payload) {
            var m2 = payload.new;
            if (!m2 || state.seenIds[m2.id]) return;
            state.seenIds[m2.id] = true;
            if (m2.channel === state.channel && state.open) {
              state.messages.push(m2);
              appendMsg(m2);
              if (m2.uid) loadProfiles([m2.uid]);
              scheduleRefresh();
            } else { scheduleRefresh(); }
          })
        .subscribe();
      return;
    }
    var col = state.room.college || 'all';
    state.rtChannel = SUPA.channel('room:' + roomKey(col, state.room.semester))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'college=eq.' + col },
        function (payload) {
          var m = payload.new;
          if (!m || state.seenIds[m.id]) return;
          if (!inMyRoom(m)) return; /* another college/semester: ignore */
          state.seenIds[m.id] = true;
          if (m.channel === state.channel && state.open) {
            state.messages.push(m);
            appendMsg(m);
            if (m.uid) loadProfiles([m.uid]);
            storeNum(floorKey(m.channel), m.id);
            scheduleRefresh();
          } else {
            scheduleRefresh(); /* exact server recount + browser alert */
          }
        })
      .subscribe();
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
        state.messages = (retry.data || []).reverse();
        return;
      }
      if (res.error) throw res.error;
      state.messages = (res.data || []).reverse();
    } catch (e) {
      if (state.roomSupported && markRoomUnsupported(e)) {
        try {
          var retry2 = await SUPA.from('chat_messages').select('*')
            .eq('channel', channel).order('id', { ascending: false }).limit(50);
          state.messages = (retry2.data || []).reverse();
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
    renderAll();
    loadAnnouncement();
    subscribe();
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
        var others = rows.filter(function (r) { return !mine || r.uid !== mine; });
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

  /* ---------- phone verification gate ---------- */
  async function fetchVerified() {
    var u = myUser();
    if (!u || !SUPA) return { ok: false };
    try {
      var res = await SUPA.from('user_profiles').select('is_phone_verified,name,username,avatar_url').eq('uid', u.uid).maybeSingle();
      if (res.data) state.profiles[u.uid] = res.data;
      return { ok: !!(res.data && res.data.is_phone_verified) };
    } catch (e) { return { ok: false, error: true }; }
  }
  function openVerifyModal() {
    populateCountries();
    $('phoneVerifyOtpCard').hidden = true;
    $('phoneVerifyForm').hidden = false;
    $('phoneVerifyFormStatus').textContent = '';
    $('phoneVerifyModal').classList.add('open');
  }
  function fullPhone() {
    var cc = COUNTRIES[$('phoneCountry').value] || COUNTRIES.IN;
    var digits = ($('phoneVerifyMobile').value || '').replace(/\D/g, '');
    if (digits.charAt(0) === '0') digits = digits.slice(1);
    return '+' + cc.dial + digits;
  }
      /* Verify phone (Community Chat ONLY): a 6-digit code is sent by SMS to the
     student's mobile number through Firebase Phone Auth. There is NO email OTP
     and no email fallback here - chat access stays blocked until the mobile
     number itself is verified. */
  async function startVerify(event) {
    if (event && event.preventDefault) event.preventDefault();
    var u = myUser();
    var status = $('phoneVerifyFormStatus');
    if (!u) { status.textContent = 'Please login first.'; return false; }
    var digits = ($('phoneVerifyMobile').value || '').replace(/\D/g, '');
    if (digits.length < 7) { status.textContent = 'Enter a valid mobile number.'; return false; }
    var phone = fullPhone();
    state.pendingMobile = phone;
    status.textContent = 'Sending SMS code to ' + phone + '...';
    try {
      if (!(window.firebase && firebase.auth && firebase.auth.RecaptchaVerifier)) {
        throw new Error('Phone verification is unavailable right now.');
      }
      /* A reCAPTCHA container can hold only one verifier - clear the previous
         one so "Resend code" works without a page reload. */
      if (state.phoneAppVerifier && state.phoneAppVerifier.clear) {
        try { state.phoneAppVerifier.clear(); } catch (e) {}
      }
      state.phoneAppVerifier = null;
      state.phoneCredResult = null;

      var appVerifier = new firebase.auth.RecaptchaVerifier('phoneVerifyRecaptcha', {
        size: 'invisible',
        callback: function () {},
        'expired-callback': function () {}
      });
      var confirmationResult = await u.linkWithPhoneNumber(phone, appVerifier);
      state.phoneCredResult = confirmationResult;
      state.phoneAppVerifier = appVerifier;
      try {
        await SUPA.from('user_profiles').update({
          mobile: phone, updated_at: new Date().toISOString()
        }).eq('uid', u.uid);
      } catch (e) {}
      $('phoneVerifyForm').hidden = true;
      $('phoneVerifyOtpCard').hidden = false;
      $('phoneVerifyOtp').value = '';
      $('phoneVerifyStatus').textContent = 'SMS code sent to ' + phone + '. It expires in a few minutes.';
      var otp = $('phoneVerifyOtp');
      if (otp) otp.focus();
      status.textContent = '';
    } catch (e) {
      /* The number is already attached to a Firebase account. If it is THIS
         account, ownership was already proven for this exact number, so unlock
         instead of leaving the student stuck. */
      if (e && (e.code === 'auth/provider-already-linked' || e.code === 'auth/credential-already-in-use')) {
        var current = (firebase.auth().currentUser || {}).phoneNumber || '';
        if (current && current === phone) {
          status.textContent = 'This number is already verified on your account - unlocking...';
          await unlockCommunity(u.uid);
          return false;
        }
        status.textContent = 'That number is already linked to another BCAPrime account. Please use a different number.';
        return false;
      }
      status.textContent = smsErrorText(e);
    }
    return false;
  }
  /* Friendly messages for the Firebase phone-auth error codes. */
  function smsErrorText(e) {
    var code = (e && e.code) || '';
    if (code === 'auth/invalid-phone-number') return 'That mobile number looks invalid - check the country code and try again.';
    if (code === 'auth/missing-phone-number') return 'Please enter your mobile number.';
    if (code === 'auth/too-many-requests') return 'Too many attempts from this device. Please wait a few minutes and try again.';
    if (code === 'auth/quota-exceeded') return 'The SMS limit has been reached for now. Please try again later.';
    if (code === 'auth/captcha-check-failed') return 'The security check failed - reload the page and try again.';
    if (code === 'auth/requires-recent-login') return 'For security, please log out and log in again, then verify your number.';
    if (code === 'auth/operation-not-allowed') return 'Mobile verification is not enabled for this app yet. Please contact the BCAPrime team.';
    var msg = (e && e.message) ? e.message.replace('Firebase: ', '') : String(e);
    return 'Could not send the SMS code: ' + msg;
  }
  /* Confirm the SMS code typed by the student (mobile OTP only). */
  async function confirmOtp() {
    var status = $('phoneVerifyStatus');
    var u = myUser();
    if (!u) { openVerifyModal(); return; }
    var code = ($('phoneVerifyOtp').value || '').replace(/\D/g, '');
    if (code.length !== 6) { status.textContent = 'Enter the 6-digit code from your SMS.'; return; }
    if (!state.phoneCredResult) { status.textContent = 'Please request a new SMS code first.'; return; }
    status.textContent = 'Verifying...';
    try {
      await state.phoneCredResult.confirm(code);
    } catch (e) {
      status.textContent = 'That SMS code is wrong or has expired - tap "Resend code" and try again.';
      return;
    }
    await unlockCommunity(u.uid);
  }
  /* Open the community gate for this account. The server confirms that Firebase
     really holds a verified phoneNumber (it is only set after a genuine SMS
     verification), then the local profile is unlocked. */
  async function unlockCommunity(uid) {
    var status = $('phoneVerifyStatus');
    var u = myUser();
    try {
      if (!u) throw new Error('Please log in again.');
      var token = await u.getIdToken(true);
      var url = (typeof AUTH_API !== 'undefined' && AUTH_API && AUTH_API.markPhoneVerified) || '';
      if (!url) throw new Error('Verification service not configured.');
      var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token, phone: state.pendingMobile || '' }) });
      var d = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
    } catch (e) {
      if (status) status.textContent = 'Verified on your phone, but we could not unlock the chat: ' + (e && e.message ? e.message : e);
      return false;
    }
    if (state.phoneAppVerifier && state.phoneAppVerifier.clear) {
      try { state.phoneAppVerifier.clear(); } catch (e) {}
    }
    state.phoneCredResult = null;
    await finishVerified(uid || (myUser() && myUser().uid));
    return true;
  }
  /* Path B: student sent BCAVERIFY <code> to the Telegram bot — the
     webhook flips is_phone_verified server-side; we just re-check. */
  async function recheckVerified() {
    var status = $('phoneVerifyStatus');
    if (status) status.textContent = 'Checking…';
    var v = await fetchVerified();
    if (v.ok) { await finishVerified(myUser() && myUser().uid); }
    else if (status) status.textContent = 'Not verified yet. Send BCAVERIFY <code> to the bot from your phone, then check again.';
  }
  async function finishVerified(uid) {
    try {
      await SUPA.from('user_profiles').update({
        mobile: state.pendingMobile || '',
        is_phone_verified: true,
        phone_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('uid', uid);
    } catch (e) {}
    $('phoneVerifyModal').classList.remove('open');
    $('phoneVerifyOtp').value = '';
    toast('Verified! Welcome to the community 🎉');
    open();
  }
  function editNumber() {
    $('phoneVerifyOtpCard').hidden = true;
    $('phoneVerifyForm').hidden = false;
    $('phoneVerifyStatus').textContent = '';
  }

  /* ---------- open / close (room-resolved) ---------- */
  async function open() {
    var u = myUser();
    if (!u) {
      var gate = $('accessAuthModal');
      if (gate) { gate.classList.add('open'); toast('Login to join the community chat'); }
      return;
    }
    await fetchVerified(); // profile/name cache only — no extra gate here
    await resolveRoom(); /* verified profile decides the room */
    state.open = true;
    state.min = false;
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
    state.channel = 'general-chat';
    state.messages = [];
    state.profiles = {};
    state.seenIds = {};
    state.imageFile = null;
    state.lastSent = 0;
    state.sending = false;
    state.pendingCode = null;
    state.pendingMobile = '';
    state.phoneCredResult = null;
    state.phoneAppVerifier = null;
    try {
      var box = $('communityMessages'); if (box) box.innerHTML = '';
      var input = $('communityInput'); if (input) { input.value = ''; input.placeholder = 'Message community…'; }
      var lang = $('communityCodeLang'); if (lang) lang.value = '';
      var prev = $('communityImagePreview'); if (prev) prev.hidden = true;
      var pimg = $('communityPreviewImg'); if (pimg) pimg.src = '';
      var otp = $('phoneVerifyOtp'); if (otp) otp.value = '';
      var chips = $('communityChips'); if (chips) chips.innerHTML = '';
    } catch (e) { /* keep logout resilient */ }
  }
  /* Revoke community membership server-side: flips is_phone_verified back to
     false and unlinks the phone from the Firebase account, so the student must
     run verification again (same number or a new one) before rejoining. If the
     endpoint is unreachable we still close the gate with a direct profile write
     (user_profiles allows it) so logout keeps working. */
  async function revokeCommunityAccess() {
    var u = myUser();
    if (!u) return true;
    var url = (typeof AUTH_API !== 'undefined' && AUTH_API && AUTH_API.communityLogout) || '';
    if (url) {
      try {
        var token = await u.getIdToken(true);
        if (token) {
          var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) });
          if (r.ok) return true;
        }
      } catch (e) { /* network / endpoint issue -> use the fallback below */ }
    }
    try {
      var res = await SUPA.from('user_profiles').update({
        is_phone_verified: false,
        phone_verified_at: null,
        updated_at: new Date().toISOString()
      }).eq('uid', u.uid);
      return !res.error;
    } catch (e) { return false; }
  }
  /* Log out of the COMMUNITY CHAT ONLY. The main BCAPrime login and the library
     session are never touched - this ends the community session and revokes
     membership, so the student has to verify their number again to rejoin.
     Use the profile-menu logout to end the whole account session. */
  async function logout() {
    var u = myUser();
    if (!u) { close(); resetSession(); return; }
    var btn = document.querySelector('.community-logout');
    if (btn) btn.disabled = true;
    var ok = await revokeCommunityAccess();
    if (btn) btn.disabled = false;
    if (!ok) {
      toast('Could not log out of the community - check your connection and try again.');
      return;
    }
    close();
    resetSession();
    toast('Logged out of the community - verify again to rejoin');
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
      if(lb&&!lb.hidden){e.stopPropagation();closeLightbox();}
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
      /* Room mismatch? Auto-sync profile to THIS room once, then retry.
         nahi, toh phone-gate fail hai. */
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
        /* Profile abhi purane room par hai (ya phone unverified nahi, room
           mismatch hai) → profile ko isi room par sync karke ek retry. */
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
        if (markRoomUnsupported(res.error)) {
          /* handled above — legacy retry already attempted */
        }
        if (res.error.code === '42501' || /policy|permission|row-level/i.test(res.error.message || '')) {
          toast('Could not send — this device is not verified for ' + state.room.label + '. Re-verify your phone (profile icon → Verify), then retry.');
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

  /* Enter key on the OTP box confirms */
  try {
    var otpBox = $('phoneVerifyOtp');
    if (otpBox) otpBox.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); confirmOtp(); } });
  } catch (e) {}

  /* ---------- public API ---------- */
  /* Background watcher: while the chat is closed, keep ONE room-scoped
     subscription + a lightweight poll so the Community badge stays
     WhatsApp-fresh. Started once on page boot (SUPA may arrive late). */
  var bgStarted = false, bgPoll = null, bootTimer = null;
  function startBackgroundWatcher() {
    if (bgStarted) return;
    if (typeof SUPA === 'undefined' || !SUPA) {
      if (!bootTimer) bootTimer = setTimeout(function () { bootTimer = null; startBackgroundWatcher(); }, 1500);
      return;
    }
    bgStarted = true;
    resolveRoom().then(function () {
      subscribe(); /* room-filtered, profile-independent */
      refreshUnread();
    }).catch(function () {});
    bgPoll = setInterval(function () {
      try {
        if (!state.open && document.visibilityState === 'visible') refreshUnread();
      } catch (e) {}
    }, 30000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && !state.open) refreshUnread();
    });
    /* College/semester changed elsewhere (profile/onboarding) → new room. */
    window.addEventListener('storage', function (e) {
      if (e && (e.key === 'bca-college' || e.key === 'bca-sem')) {
        state.room.college = myCollege();
        state.room.semester = mySemester();
        state.room.label = roomLabel(state.room.college, state.room.semester);
        if (!state.open) { subscribe(); refreshUnread(); }
      }
    });
    try {
      document.addEventListener('bca-room-changed', function () { if (!state.open) { subscribe(); refreshUnread(); } });
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
    refreshUnread: refreshUnread, unreadCount: function () { return state.unread; },
    roomInfo: function () { return { college: state.room.college, semester: state.room.semester, label: state.room.label }; }
  };
})();
