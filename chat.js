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
    imageFile: null, pendingCode: null,
    rtChannel: null, profileRt: null, seenIds: {},
    pendingMobile: '', phoneCredResult: null, phoneAppVerifier: null
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

  /* ---------- message rendering ---------- */
  function renderBody(m) {
    var el = document.createElement('div');
    if (m.code_lang && window.hljs) {
      var pre = document.createElement('pre'); pre.className = 'msg-code';
      var code = document.createElement('code');
      code.className = 'language-' + (m.code_lang === 'cpp' ? 'cpp' : 'javascript');
      code.textContent = m.body || '';
      pre.appendChild(code); el.appendChild(pre);
      try { window.hljs.highlightElement(code); } catch (e) { /* lib not ready */ }
    } else {
      var p = document.createElement('div'); p.className = 'msg-text';
      p.textContent = m.body || '';
      el.appendChild(p);
    }
    if (m.image_url) {
      var img = document.createElement('img');
      img.className = 'msg-image'; img.loading = 'lazy'; img.alt = 'shared screenshot';
      img.src = m.image_url;
      img.onclick = function () { window.open(m.image_url, '_blank'); };
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

  /* ---------- realtime sync ---------- */
  function unsubscribe() {
    if (state.rtChannel) { try { SUPA.removeChannel(state.rtChannel); } catch (e) {} state.rtChannel = null; }
  }
  function subscribe(channel) {
    if (!SUPA) return;
    unsubscribe();
    state.rtChannel = SUPA.channel('community:' + channel)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'channel=eq.' + channel },
        function (payload) {
          var m = payload.new;
          state.messages.push(m);
          appendMsg(m);
          if (m.uid) loadProfiles([m.uid]);
        })
      .subscribe();
  }
  async function loadHistory(channel) {
    if (!SUPA) return;
    try {
      var res = await SUPA.from('chat_messages').select('*').eq('channel', channel).order('id', { ascending: false }).limit(50);
      state.messages = (res.data || []).reverse();
    } catch (e) { state.messages = []; }
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
      b.innerHTML = '<i class="fa-solid ' + c.icon + '"></i> ' + esc(c.label);
      b.onclick = function () { switchChannel(c.slug); };
      wrap.appendChild(b);
    });
  }
  async function switchChannel(slug) {
    state.channel = slug;
    $('communityActiveChannel').textContent = '#' + slug;
    renderChips();
    await loadHistory(slug);
    renderAll();
    loadAnnouncement();
    subscribe(slug);
    loadProfiles(uniqueUids());
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

  /* ---------- open / close ---------- */
  async function open() {
    var u = myUser();
    if (!u) {
      var gate = $('accessAuthModal');
      if (gate) { gate.classList.add('open'); toast('Login to join the community chat'); }
      return;
    }
    var v = await fetchVerified();
    if (!v.ok) { openVerifyModal(); return; }
    state.open = true;
    $('communitySection').hidden = false;
    document.body.classList.add('community-open');
    renderChips();
    subscribeProfileRealtime();
    await switchChannel(state.channel);
    var input = $('communityInput');
    if (input) input.focus();
  }
  function close() {
    state.open = false;
    $('communitySection').hidden = true;
    document.body.classList.remove('community-open');
    unsubscribe();
  }
  /* Reset every cached community-chat value so the next open starts clean. */
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
  function pickImage(input) {
    var f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) { toast('Images only, please.'); return; }
    if (f.size > MAX_IMAGE_BYTES) { toast('Image too large — max 5 MB.'); return; }
    compress(f, function (blob) {
      state.imageFile = blob;
      $('communityPreviewImg').src = URL.createObjectURL(blob);
      $('communityImagePreview').hidden = false;
    });
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
        image_url: imageUrl
      };
      var res = await SUPA.from('chat_messages').insert(msg).select().single();
      if (res.error) {
        if (res.error.code === '42501' || /policy/i.test(res.error.message || '')) {
          toast('Your phone verification is pending — finish it to chat.');
          openVerifyModal();
        } else { toast('Could not send: ' + (res.error.message || 'unknown error')); }
      } else {
        t.value = '';
        $('communityCodeLang').value = '';
        markCode('');
        state.messages.push(res.data);
        appendMsg(res.data, { forceScroll: true });
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
  window.BCAChat = {
    open: open, close: close,
    send: send, inputKey: inputKey, markCode: markCode,
    pickImage: pickImage, clearImage: clearImage,
    startVerify: startVerify, confirmOtp: confirmOtp, editNumber: editNumber, recheckVerified: recheckVerified,
    logout: logout
  };
})();
