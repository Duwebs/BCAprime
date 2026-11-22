// ============================================================
// BCAPrime — api/_lib/telegramAdmin.js
// Dedicated Admin Telegram Alert System (BCAPrime Admin Bot)
// Uses server-side secrets:
//   TELEGRAM_ADMIN_BOT_TOKEN
//   TELEGRAM_ADMIN_CHAT_ID
//
// Formats timestamps in IST (UTC+5:30) and cleanly escapes markdown.
// ============================================================
'use strict';

/**
 * Format a Date object or ISO string to Indian Standard Time (IST, UTC+5:30)
 * Example output: "21 Nov 2026, 07:30 PM IST"
 */
function formatToIST(dateInput) {
  try {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) {
      return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
    }
    return (
      new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(d) + ' IST'
    );
  } catch (_e) {
    return new Date().toISOString() + ' (UTC)';
  }
}

/**
 * Clean string for safe Telegram Markdown V1 rendering
 */
function escapeMarkdown(text) {
  return String(text || '').replace(/[*_`\[\]]/g, ' ');
}

/**
 * Dispatch an admin notification to the BCAPrime Admin Telegram Bot.
 * Wrapped safely so network or config issues return clean error objects without crashing.
 *
 * @param {string} text - Message text formatted with Telegram Markdown
 * @returns {Promise<{ ok: boolean, messageId?: number, error?: string }>}
 */
async function sendAdminTelegramMessage(text) {
  const botToken = (process.env.TELEGRAM_ADMIN_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim();

  if (!botToken || !chatId) {
    const missing = [];
    if (!botToken) missing.push('TELEGRAM_ADMIN_BOT_TOKEN');
    if (!chatId) missing.push('TELEGRAM_ADMIN_CHAT_ID');
    console.warn(`[telegramAdmin] Missing env: ${missing.join(', ')}`);
    return { ok: false, error: `Missing ${missing.join(', ')} on server` };
  }

  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    // 1. Try with Markdown
    let res = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    let data = await res.json().catch(() => ({}));

    // 2. Fallback to plain text if Markdown parsing failed (Telegram 400 bad request)
    if (!res.ok && data.description && /can't parse/i.test(data.description)) {
      console.warn('[telegramAdmin] Markdown parsing failed, retrying plain text...');
      const plainText = text.replace(/[*_`\[\]]/g, '');
      res = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: plainText,
          disable_web_page_preview: true,
        }),
      });
      data = await res.json().catch(() => ({}));
    }

    if (res.ok && data.ok) {
      return { ok: true, messageId: data.result ? data.result.message_id : null };
    }

    const errMsg = data.description || `HTTP ${res.status}`;
    console.error('[telegramAdmin] Telegram API error:', errMsg);
    return { ok: false, error: errMsg };
  } catch (err) {
    console.error('[telegramAdmin] Network error:', err.message || err);
    return { ok: false, error: err.message || 'Network error' };
  }
}

/**
 * Format and send structured admin alerts
 *
 * Types:
 * - 'resource_upload': New Notes / PYQ Upload
 * - 'feedback': Internal Feedback / Star Rating
 * - 'senior_request': Ask Seniors / Junior Request
 * - 'lost_found': Lost & Found Post
 * - 'test': Manual Admin verification ping
 */
async function sendAdminTelegramAlert(type, payload = {}) {
  const istTime = formatToIST(payload.timestamp || payload.created_at || new Date());
  let msg = '';

  switch (type) {
    case 'resource_upload': {
      const typeLabel = (payload.type === 'pyq' ? 'PYQ' : 'Notes').toUpperCase();
      const title = escapeMarkdown(payload.title || 'Untitled Resource');
      const subject = escapeMarkdown(payload.subject || 'General');
      const semester = payload.semester != null ? payload.semester : (payload.sem || 'N/A');
      const uploader = escapeMarkdown(payload.uploader || payload.uploader_name || 'Anonymous Student');
      const college = escapeMarkdown(payload.college || 'All Colleges');

      msg = [
        `📄 *New Resource Upload on BCAPrime!*`,
        ``,
        `📚 *Title:* ${title}`,
        `📖 *Subject:* ${subject}`,
        `🎓 *Semester:* Semester ${semester}`,
        `🏷️ *Type:* ${typeLabel}`,
        `🏛️ *College:* ${college}`,
        `👤 *Uploader:* @${uploader.replace(/^@/, '')}`,
        `⏰ *Time:* ${istTime}`,
        ``,
        `⏳ _Waiting in Admin Moderation Queue for review._`,
      ].join('\n');
      break;
    }

    case 'feedback': {
      const star = payload.rating ? Number(payload.rating) : 0;
      let starEmoji = '⭐';
      if (star === 1) starEmoji = '⭐ 1★ (Needs Work)';
      else if (star === 2) starEmoji = '⭐⭐ 2★ (Needs Work)';
      else if (star === 3) starEmoji = '⭐⭐⭐ 3★ (Average)';
      else if (star > 3) starEmoji = `${'⭐'.repeat(star)} ${star}★`;

      const kind = escapeMarkdown((payload.kind || 'feedback').toUpperCase());
      const message = escapeMarkdown(payload.message || 'No message provided');
      const user = escapeMarkdown(payload.user_name || payload.user_email || 'Student');

      msg = [
        `⭐ *New Internal Feedback Alert!*`,
        ``,
        `🏷️ *Category:* ${kind}`,
        ...(star > 0 ? [`🌟 *Rating:* ${starEmoji}`] : []),
        `💬 *Message:*`,
        `"${message.slice(0, 500)}${message.length > 500 ? '...' : ''}"`,
        ``,
        `👤 *Submitted by:* ${user}`,
        `⏰ *Time:* ${istTime}`,
      ].join('\n');
      break;
    }

    case 'senior_request':
    case 'junior_request': {
      const isJuniorView = type === 'junior_request' || payload.isJunior;
      const header = isJuniorView ? `🙋‍♂️ *New Junior Request!*` : `💬 *New Question in Ask Seniors!*`;
      const subject = escapeMarkdown(payload.subject || 'BCA Study Help');
      const semester = payload.semester != null ? payload.semester : 'N/A';
      const user = escapeMarkdown(payload.requester_name || payload.user_name || 'A Student');
      const college = escapeMarkdown(payload.college || 'All Colleges');
      const reqType = (payload.type === 'pyq' ? 'PYQ' : 'Notes').toUpperCase();
      const message = payload.message ? escapeMarkdown(payload.message) : '';

      msg = [
        header,
        ``,
        `📖 *Topic/Subject:* ${subject}`,
        `🎓 *Semester:* Semester ${semester}`,
        `🏷️ *Type Requested:* ${reqType}`,
        `🏛️ *College:* ${college}`,
        ...(message ? [`💬 *Note:* "${message.slice(0, 300)}"`] : []),
        `👤 *Student:* ${user}`,
        `⏰ *Time:* ${istTime}`,
      ].join('\n');
      break;
    }

    case 'lost_found': {
      const mode = (payload.type === 'found' ? 'FOUND' : 'LOST').toUpperCase();
      const modeEmoji = mode === 'FOUND' ? '🟢' : '🔴';
      const category = escapeMarkdown(payload.category || payload.custom_category || 'Item');
      const location = escapeMarkdown(payload.location || 'College Campus');
      const description = escapeMarkdown(payload.description || 'No description');
      const user = escapeMarkdown(payload.poster_name || 'A Student');
      const college = escapeMarkdown(payload.college || 'All Colleges');
      const contact = payload.contact ? escapeMarkdown(payload.contact) : '';

      msg = [
        `🔍 *New Lost & Found Report!*`,
        ``,
        `${modeEmoji} *Status:* ${mode}`,
        `📦 *Item:* ${category}`,
        `📍 *Location:* ${location}`,
        `🏛️ *College:* ${college}`,
        `📝 *Details:* "${description.slice(0, 300)}"`,
        ...(contact ? [`📞 *Contact snippet:* ${contact}`] : []),
        `👤 *Posted by:* ${user}`,
        `⏰ *Time:* ${istTime}`,
      ].join('\n');
      break;
    }

    case 'college_request': {
      const collegeName = escapeMarkdown(payload.name || payload.college_name || 'Unnamed College');
      const user = escapeMarkdown(payload.submitted_by_name || payload.user_name || payload.username || 'Student');

      msg = [
        `🏫 *New College Request!*`,
        ``,
        `🏛️ *College Name:* ${collegeName}`,
        `👤 *Requested by:* @${user.replace(/^@/, '')}`,
        `⏰ *Time:* ${istTime}`,
        ``,
        `⏳ _Awaiting approval in BCAPrime Admin → College Approvals._`,
      ].join('\n');
      break;
    }

    case 'lost_found_escalation_30d': {
      const itemCount = payload.count || 1;
      const sampleTitle = escapeMarkdown(payload.sample_title || payload.item_name || 'Lost & Found Items');
      const college = escapeMarkdown(payload.college || 'Various Colleges');

      msg = [
        `⚠️ *Lost & Found 30-Day Escalation!*`,
        ``,
        `📦 *Unresolved Items:* ${itemCount} post(s) older than 30 days`,
        `🔍 *Sample Item:* ${sampleTitle}`,
        `🏛️ *College:* ${college}`,
        `⏰ *Time:* ${istTime}`,
        ``,
        `🚨 _Action needed: Please review in BCAPrime Admin → Community → Lost & Found Moderation to Wipe Image or Extend._`,
      ].join('\n');
      break;
    }

    case 'test':
    default: {
      const adminName = escapeMarkdown(payload.admin_name || 'Admin');
      msg = [
        `🔔 *BCAPrime Admin Bot — Test Ping!*`,
        ``,
        `✅ Connection verified successfully!`,
        `🤖 *Bot:* BCAPrime Admin Alert System`,
        `👤 *Triggered by:* ${adminName}`,
        `⏰ *Time:* ${istTime}`,
        ``,
        `_All admin activity notifications (uploads, feedback, requests, lost & found) will arrive here instantly._`,
      ].join('\n');
      break;
    }
  }

  return sendAdminTelegramMessage(msg);
}

module.exports = {
  formatToIST,
  escapeMarkdown,
  sendAdminTelegramMessage,
  sendAdminTelegramAlert,
};
