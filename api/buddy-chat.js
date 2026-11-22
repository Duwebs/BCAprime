// ============================================================
// BCAPrime — api/buddy-chat.js
// Context-Aware Floating AI Study Mascot ("PrimeBuddy") API Route
// Powered by:
// 1. Multi-Provider Failover (Groq -> Gemini -> OpenAI)
// 2. Per-student daily limit (20 messages/day) via Supabase
// 3. Graceful fallback searching matching BCAPrime Notes/PYQs
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const { withCors, send } = require('./_lib/cors');
const { verifySupabaseToken } = require('./_lib/supabaseAuth');

// Automatically read .env.local if present in workspace (local dev support)
function loadLocalEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const k = trimmed.slice(0, idx).trim();
          const v = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (!process.env[k]) process.env[k] = v;
        }
      });
    }
  } catch (_e) {}
}
loadLocalEnv();

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://kjesjaakjddfxykisssh.supabase.co').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ZZ-StuiDnSwyJ9xNRjbY7A_eoyZF7Fl';

// Lightweight native fetch helper for Supabase REST (zero external dependencies)
async function fetchSupabaseRest(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  return fetch(url, { ...options, headers });
}

const DAILY_BUDDY_LIMIT = 20;

const SYSTEM_INSTRUCTION = `You are PrimeBuddy — an encouraging, friendly, and top-tier Computer Science and BCA (Bachelor of Computer Applications) study mentor for Indian university students.
Your goal is to help students excel in semester exams, viva voce, lab practicals, and coding.
Guidelines:
1. Explain core concepts clearly using simple analogies, crisp bullet points, and code snippets when helpful.
2. If asked for Viva questions, provide 3 high-yield questions with crisp 1-line model answers.
3. If asked to explain in Hinglish or simple language, use natural, conversational Hinglish (Hindi written in English alphabet) that is engaging and friendly.
4. Keep answers concise, direct, and mobile-screen friendly (avoid unnecessary fluff).
5. Always be warm, motivating, and supportive!`;

// --- Provider: Groq (Llama 3.3 70B - Fast & Free-Tier) ---
async function callGroqChat(apiKey, message, context, history) {
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  let contextSnippet = '';
  if (context) {
    if (context.resourceTitle) contextSnippet += ` (Material: "${context.resourceTitle}")`;
    if (context.subject) contextSnippet += ` (Subject: "${context.subject}")`;
    if (context.semester) contextSnippet += ` (Sem: ${context.semester})`;
    if (context.codeSnippet) contextSnippet += `\n[Editor Code:\n\`\`\`\n${context.codeSnippet.slice(0, 700)}\n\`\`\`]`;
  }

  const messages = [{ role: 'system', content: SYSTEM_INSTRUCTION + (contextSnippet ? `\nActive Context: ${contextSnippet}` : '') }];
  if (Array.isArray(history)) {
    history.slice(-4).forEach(h => {
      if (h.sender && h.text) {
        messages.push({ role: h.sender === 'user' ? 'user' : 'assistant', content: String(h.text) });
      }
    });
  }
  messages.push({ role: 'user', content: message });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    signal: controller.signal,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.35,
      max_tokens: 950
    })
  });
  clearTimeout(timeoutId);

  if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) throw new Error('Empty response from Groq');
  return reply.trim();
}

// --- Provider: Gemini (Gemini 1.5 Flash - Google Free-Tier) ---
async function callGeminiChat(apiKey, message, context, history) {
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let contextSnippet = '';
  if (context) {
    if (context.resourceTitle) contextSnippet += `\n[Current Study Material: "${context.resourceTitle}"]`;
    if (context.subject) contextSnippet += `\n[Subject: "${context.subject}"]`;
    if (context.semester) contextSnippet += `\n[BCA Semester: ${context.semester}]`;
    if (context.codeSnippet) contextSnippet += `\n[Code in Editor:\n\`\`\`\n${context.codeSnippet.slice(0, 700)}\n\`\`\`]`;
  }

  const promptText = `${contextSnippet ? 'Current Context:' + contextSnippet + '\n\n' : ''}Student Query: ${message}`;

  const contents = [];
  if (Array.isArray(history)) {
    history.slice(-4).forEach(h => {
      if (h.sender && h.text) {
        contents.push({
          role: h.sender === 'user' ? 'user' : 'model',
          parts: [{ text: String(h.text) }]
        });
      }
    });
  }
  contents.push({ role: 'user', parts: [{ text: promptText }] });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 16000);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents,
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 950
      }
    })
  });
  clearTimeout(timeoutId);

  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error('No candidate content from Gemini');
  return reply.trim();
}

// --- Provider: OpenAI (GPT-4o Mini - Optional Backup) ---
async function callOpenAIChat(apiKey, message, context, history) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  const messages = [{ role: 'system', content: SYSTEM_INSTRUCTION }];
  if (Array.isArray(history)) {
    history.slice(-4).forEach(h => {
      if (h.sender && h.text) {
        messages.push({ role: h.sender === 'user' ? 'user' : 'assistant', content: String(h.text) });
      }
    });
  }
  messages.push({ role: 'user', content: message });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    signal: controller.signal,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.35,
      max_tokens: 950
    })
  });
  clearTimeout(timeoutId);

  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) throw new Error('Empty response from OpenAI');
  return reply.trim();
}

// --- Supabase Notes & PYQs Fallback Search ---
async function searchSupabaseStudyMaterials(query, context) {
  const subject = (context.subject || '').trim();
  const semester = Number(context.semester) || 2;
  const searchTerm = subject && subject !== 'all' ? subject : (query.split(' ')[0] || '');

  try {
    let qs = 'status=eq.approved&select=id,title,type,subject,semester,file_url,downloads&order=downloads.desc&limit=3';
    if (semester >= 1 && semester <= 6) {
      qs += `&semester=eq.${semester}`;
    }
    if (searchTerm && searchTerm.length > 2) {
      qs += `&or=(subject.ilike.*${encodeURIComponent(searchTerm)}*,title.ilike.*${encodeURIComponent(searchTerm)}*)`;
    }

    const res = await fetchSupabaseRest(`resources?${qs}`, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    console.warn('[Supabase Fallback Search Warning]', err.message);
  }
  return [];
}

// --- Serverless Request Handler ---
module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed' });
  }

  loadLocalEnv();

  let body = {};
  try {
    body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch (e) {
    return send(res, 400, { error: 'Invalid JSON request' });
  }

  const message = String(body.message || '').trim();
  if (!message) {
    return send(res, 400, { error: 'Message cannot be empty' });
  }

  const context = body.context || {};
  const history = body.history || [];

  // 1. Identify Student & Verify Daily Quota (20 msgs/day)
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || body.accessToken;
  let user = null;
  if (token) {
    try {
      user = await verifySupabaseToken(token);
    } catch (_e) {
      user = null;
    }
  }

  const clientIp = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'guest').split(',')[0].trim();
  const guestId = String(body.guestId || req.headers['x-guest-id'] || clientIp).trim().slice(0, 64);
  const studentKey = user?.uid ? user.uid : `guest:${guestId}`;
  const buddyQuotaKey = `buddy:${studentKey}`;

  const today = new Date().toISOString().slice(0, 10);
  let usedToday = 0;

  try {
    const usageRes = await fetchSupabaseRest(
      `ai_quiz_usage?user_id=eq.${encodeURIComponent(buddyQuotaKey)}&usage_date=eq.${today}&select=count&limit=1`,
      { method: 'GET' }
    );
    if (usageRes.ok) {
      const usageData = await usageRes.json();
      if (Array.isArray(usageData) && usageData[0] && typeof usageData[0].count === 'number') {
        usedToday = usageData[0].count;
      }
    }
  } catch (err) {
    console.warn('[Buddy Quota Check Warning]', err.message);
  }

  // If daily limit (20 msgs/day) reached, gracefully notify and offer library materials
  if (usedToday >= DAILY_BUDDY_LIMIT) {
    const matchingDocs = await searchSupabaseStudyMaterials(message, context);
    let docSnippet = '';
    if (matchingDocs.length > 0) {
      docSnippet = '\n\n📚 **Recommended Study Materials for Sem ' + (context.semester || '2') + ':**\n' +
        matchingDocs.map(d => `• **${d.type.toUpperCase()}:** ${d.title} (${d.subject})`).join('\n');
    }

    return send(res, 200, {
      quotaReached: true,
      used: usedToday,
      limit: DAILY_BUDDY_LIMIT,
      remaining: 0,
      reply: `🎓 **Daily AI Study Quota Reached (20/20)**\n\nYou've used your 20 free PrimeBuddy AI queries for today! Your limit will refresh tonight at 12:00 AM IST.\n\nIn the meantime, you can explore verified notes and PYQs directly from the library!${docSnippet}`,
      resources: matchingDocs
    });
  }

  // 2. Multi-Provider Key Collection (Priority: Groq -> Gemini -> OpenAI)
  const groqKeys = [
    process.env.GROQ_API_KEY,
    process.env.AI_BACKUP_API_KEY,
    process.env.GROQ_KEY_1
  ].map(k => (k || '').trim()).filter(Boolean);

  const geminiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_AI_KEY,
    process.env.AI_PRIMARY_API_KEY,
    process.env.GEMINI_KEY_1,
    process.env.GEMINI_KEY_2
  ].map(k => (k || '').trim()).filter(Boolean);

  const openaiKeys = [
    process.env.OPENAI_API_KEY
  ].map(k => (k || '').trim()).filter(Boolean);

  let replyText = '';
  let providerUsed = '';

  // Cascade 1: Groq (Llama 3.3 70B)
  for (const k of groqKeys) {
    try {
      replyText = await callGroqChat(k, message, context, history);
      providerUsed = 'groq';
      break;
    } catch (err) {
      console.warn('[PrimeBuddy API] Groq attempt failed:', err.message);
    }
  }

  // Cascade 2: Gemini (Gemini 1.5 Flash)
  if (!replyText) {
    for (const k of geminiKeys) {
      try {
        replyText = await callGeminiChat(k, message, context, history);
        providerUsed = 'gemini';
        break;
      } catch (err) {
        console.warn('[PrimeBuddy API] Gemini attempt failed:', err.message);
      }
    }
  }

  // Cascade 3: OpenAI (GPT-4o Mini)
  if (!replyText) {
    for (const k of openaiKeys) {
      try {
        replyText = await callOpenAIChat(k, message, context, history);
        providerUsed = 'openai';
        break;
      } catch (err) {
        console.warn('[PrimeBuddy API] OpenAI attempt failed:', err.message);
      }
    }
  }

  // Cascade 4: Supabase Live Database + Intelligent Syllabus Fallback
  if (!replyText) {
    providerUsed = 'supabase-curriculum';
    const matchingDocs = await searchSupabaseStudyMaterials(message, context);
    replyText = generateCurriculumFallback(message, context, matchingDocs);
  }

  // 3. Record Successful Query in Quota Tracker
  usedToday++;
  try {
    await fetchSupabaseRest('ai_quiz_usage', {
      method: 'POST',
      headers: {
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        user_id: buddyQuotaKey,
        usage_date: today,
        count: usedToday
      })
    });
  } catch (err) {
    console.warn('[Buddy Quota Increment Warning]', err.message);
  }

  return send(res, 200, {
    ok: true,
    reply: replyText,
    provider: providerUsed,
    used: usedToday,
    limit: DAILY_BUDDY_LIMIT,
    remaining: Math.max(0, DAILY_BUDDY_LIMIT - usedToday)
  });
});

function generateCurriculumFallback(query, context, matchingDocs = []) {
  const q = query.toLowerCase();
  const sub = (context.subject || 'Computer Science').trim();
  const sem = context.semester || '2';

  let docsSection = '';
  if (matchingDocs.length > 0) {
    docsSection = '\n\n📁 **Matching BCAPrime Study Materials:**\n' +
      matchingDocs.map(d => `• **${d.type.toUpperCase()}:** ${d.title} (${d.downloads || 0} downloads)`).join('\n') +
      '\n*Tap Library tab to open these PDFs!*';
  }

  if (q.includes('viva') || q.includes('question')) {
    return `🎯 **Top 3 Viva Questions for ${sub} (Sem ${sem}):**\n\n` +
      `**Q1. What is the fundamental principle of ${sub}?**\n` +
      `*Ans:* It structures algorithmic data flow and ensures memory-safe runtime execution.\n\n` +
      `**Q2. What is the difference between static and dynamic allocation?**\n` +
      `*Ans:* Static is allocated on the stack at compile-time; dynamic is allocated on the heap at runtime.\n\n` +
      `**Q3. Name one high-yield practical application.**\n` +
      `*Ans:* B-Trees in database index lookup, CPU round-robin scheduling, and shortest-path routing in networks.\n\n` +
      `💡 *Viva Strategy:* Deliver your definition in 2 crisp sentences and cite 1 practical application!${docsSection}`;
  }

  if (q.includes('summar') || q.includes('quick') || q.includes('revision') || q.includes('exam')) {
    return `📝 **Quick Revision Notes — ${sub} (Sem ${sem}):**\n\n` +
      `• **Key Definition:** Core architecture, memory models, and standard operational cycles.\n` +
      `• **High-Yield Exam Topics:** Clean block diagrams, comparison matrices (e.g. TCP vs UDP, Primary vs Foreign Key), and boundary conditions.\n` +
      `• **University Exam Secret:** Always write point-wise with underlined keywords and provide a 2-line code/diagram example! 🚀${docsSection}`;
  }

  if (q.includes('hinglish') || q.includes('simple')) {
    return `💡 **Simple Hinglish Explanation:**\n\n` +
      `Dekho, **${sub}** ka basic funda bilkul simple hai:\n` +
      `1. Real-world tasks ko computer me fastest aur memory-efficient tarike se execute karna.\n` +
      `2. RAM aur CPU cycles ko bina matlab waste hone se bachana.\n` +
      `3. Clear step-by-step logic aur neat architecture follow karna.\n\n` +
      `Exams me bas **Definition ➔ Clean Diagram ➔ Real-life Example** likh kar aao, full marks milenge! ✨${docsSection}`;
  }

  if (q.includes('bug') || q.includes('error') || q.includes('code')) {
    return `🐞 **Code Debugger Checklist:**\n\n` +
      `Top common BCA coding traps to verify:\n` +
      `1. **Semicolon missing** after struct definitions or loop headers.\n` +
      `2. **Array Bounds Overflow:** Loop iterating \`i <= n\` instead of \`i < n\`.\n` +
      `3. **Dangling Pointers:** Dereferencing \`NULL\` or freed heap memory.\n\n` +
      `Paste your snippet into Code Lab and I will guide you through the fix!${docsSection}`;
  }

  return `✨ **PrimeBuddy Study Tip for ${sub}:**\n\n` +
    `I've noted: *"${query}"*.\n\n` +
    `• **Semester ${sem} Strategy:** Review Previous Year Questions (PYQs) from the last 3 years — 70% of questions repeat core conceptual patterns.\n` +
    `• **High-Yield Practice:** Examiners consistently award high marks for time complexities ($O(1)$, $O(n)$, $O(n \\log n)$) and 2-difference comparison tables.${docsSection}\n\n` +
    `Tap **"Summarize this topic"** or **"3 Viva questions"** anytime! 🎓`;
}
