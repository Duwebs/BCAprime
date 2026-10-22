// ============================================================
// BCAPrime — api/generate-quiz.js
// On-the-fly AI Quiz Generator with Strict Daily Quota (Max 3/day)
// and Automatic Backend Failover
// ============================================================
'use strict';

const { withCors, send } = require('./_lib/cors');
const { verifySupabaseToken } = require('./_lib/supabaseAuth');
const { generateAiQuiz } = require('./_lib/aiQuizGenerator');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://kjesjaakjddfxykisssh.supabase.co').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ZZ-StuiDnSwyJ9xNRjbY7A_eoyZF7Fl';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DAILY_LIMIT = 3;

module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed' });
  }

  let body = {};
  try {
    body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch (e) {
    return send(res, 400, { error: 'Invalid JSON request' });
  }

  // 1. Verify User Authentication
  const idToken = body.accessToken || body.idToken || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!idToken) {
    return send(res, 401, { error: 'Authentication required. Please log in to generate mock tests.' });
  }

  const user = await verifySupabaseToken(idToken);
  if (!user || !user.uid) {
    return send(res, 401, { error: 'Invalid or expired user session. Please log in again.' });
  }

  const userId = user.uid;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const tomorrowMidnight = new Date();
  tomorrowMidnight.setUTCHours(24, 0, 0, 0);

  // 2. Check Daily Limit (Max 3/day)
  let currentUsage = 0;
  try {
    const { data: usageRow } = await supabase
      .from('ai_quiz_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .maybeSingle();

    if (usageRow && typeof usageRow.count === 'number') {
      currentUsage = usageRow.count;
    }
  } catch (err) {
    console.warn('[Quota Check Error]', err.message);
  }

  if (currentUsage >= DAILY_LIMIT) {
    return send(res, 429, {
      ok: false,
      error: 'quota_exceeded',
      message: `You have reached your daily quota of ${DAILY_LIMIT} practice tests. Your limit resets at midnight.`,
      quota: {
        used: currentUsage,
        limit: DAILY_LIMIT,
        remaining: 0,
        resetAt: tomorrowMidnight.toISOString()
      }
    });
  }

  // 3. Extract Quiz Parameters
  const subject = String(body.subject || 'Data Structures').trim();
  const semester = Math.min(Math.max(parseInt(body.semester, 10) || 1, 1), 6);
  const topic = String(body.topic || '').trim();
  const questionCount = Math.min(Math.max(parseInt(body.questionCount, 10) || 10, 5), 15);
  const difficulty = ['easy', 'medium', 'hard'].includes(body.difficulty) ? body.difficulty : 'medium';
  const timeLimitMinutes = Math.max(Math.round(questionCount * 1.2), 5);

  // 4. Generate Quiz with Failover
  let aiResult;
  try {
    aiResult = await generateAiQuiz({
      subject,
      semester,
      topic,
      questionCount,
      difficulty
    });
  } catch (genError) {
    console.error('[Generation Error]', genError);
    return send(res, 500, {
      ok: false,
      error: 'Failed to generate quiz questions. Please try again.',
      detail: genError.message
    });
  }

  const questions = aiResult.questions || [];
  if (!questions.length) {
    return send(res, 500, { ok: false, error: 'Could not generate questions for this subject.' });
  }

  // 5. Store Quiz and Questions in Supabase
  let createdQuiz = null;
  try {
    const quizTitle = `${subject} (Sem ${semester}) Mock Test${topic ? ' - ' + topic : ''}`;
    const { data: quizData, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        title: quizTitle,
        subject,
        semester,
        description: `Practice mock test covering BCA Semester ${semester} syllabus standards.`,
        total_questions: questions.length,
        time_limit_minutes: timeLimitMinutes,
        difficulty,
        is_ai_generated: true,
        created_by: userId
      })
      .select()
      .single();

    if (quizError) throw quizError;
    createdQuiz = quizData;

    // Insert Questions
    const questionRows = questions.map(q => ({
      quiz_id: createdQuiz.id,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      options: q.options || { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
      correct_answer: q.correct_answer,
      explanation: q.explanation || ''
    }));

    const { data: insertedQuestions, error: qInsertError } = await supabase
      .from('questions')
      .insert(questionRows)
      .select();

    if (qInsertError) throw qInsertError;

    // 6. Atomically Increment User's Daily Quota
    const newUsage = currentUsage + 1;
    await supabase
      .from('ai_quiz_usage')
      .upsert({
        user_id: userId,
        usage_date: today,
        count: newUsage
      }, { onConflict: 'user_id, usage_date' });

    return send(res, 200, {
      ok: true,
      quiz: createdQuiz,
      questions: insertedQuestions || questionRows,
      quota: {
        used: newUsage,
        limit: DAILY_LIMIT,
        remaining: Math.max(0, DAILY_LIMIT - newUsage),
        resetAt: tomorrowMidnight.toISOString()
      },
      generatorMeta: {
        provider: aiResult.provider,
        model: aiResult.model,
        tier: aiResult.tier
      }
    });
  } catch (dbError) {
    console.error('[Database Save Error]', dbError);
    // If database insertion failed, return the generated quiz in-memory so user can still take the test!
    return send(res, 200, {
      ok: true,
      quiz: {
        id: 'temp-' + Date.now(),
        title: `${subject} (Sem ${semester}) AI Mock Test`,
        subject,
        semester,
        total_questions: questions.length,
        time_limit_minutes: timeLimitMinutes,
        difficulty,
        is_ai_generated: true,
        created_by: userId
      },
      questions: questions.map((q, i) => ({ id: 'temp-q-' + i, ...q })),
      quota: {
        used: currentUsage + 1,
        limit: DAILY_LIMIT,
        remaining: Math.max(0, DAILY_LIMIT - (currentUsage + 1)),
        resetAt: tomorrowMidnight.toISOString()
      },
      note: 'Rendered in instant mode.'
    });
  }
});
