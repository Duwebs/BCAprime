// ============================================================
// BCAPrime — api/_lib/aiQuizGenerator.js
// Multi-provider AI Quiz Generator with Automatic Failover
// Supports: Google Gemini, Groq, OpenAI + BCA Curriculum Engine Fallback
// ============================================================
'use strict';

/**
 * BCA Curriculum Subjects mapped by semester for authentic mock tests
 */
const BCA_CURRICULUM = {
  1: ['Programming Principles & C', 'Digital Electronics & Computer Architecture', 'Discrete Mathematics', 'Business Communication', 'Environmental Studies'],
  2: ['Data Structures using C', 'Object Oriented Programming with C++', 'Organization Behavior', 'Financial Accounting & Management', 'Mathematics II'],
  3: ['Database Management Systems', 'Computer Networks', 'Java Programming', 'Operating Systems', 'Software Engineering'],
  4: ['Web Technologies & PHP', 'Python Programming', 'Information Security & Cyber Law', 'Design & Analysis of Algorithms', 'Computer Graphics'],
  5: ['Mobile Application Development (Android)', 'Cloud Computing', 'Artificial Intelligence', 'Data Mining & Warehousing', 'E-Commerce'],
  6: ['Major Project', 'Machine Learning & Big Data', 'Internet of Things (IoT)', 'Network Security & Cryptography', 'Software Testing & Quality Assurance']
};

/**
 * Detect provider from API key or name
 */
function detectProvider(apiKey, explicitProvider) {
  if (explicitProvider) return explicitProvider.toLowerCase();
  const key = String(apiKey || '').trim();
  if (key.startsWith('AIza')) return 'gemini';
  if (key.startsWith('gsk_')) return 'groq';
  if (key.startsWith('sk-')) return 'openai';
  return 'gemini';
}

/**
 * Call Google Gemini API
 */
async function callGemini(apiKey, model, prompt) {
  const modelName = model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 2500,
          responseMimeType: 'application/json'
        }
      })
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = new Error(`Gemini API error (${res.status}): ${errText}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Empty response from Gemini API');
    return parseQuizJson(rawText);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call Groq API (High-speed llama-3.3-70b / llama-3.1-8b)
 */
async function callGroq(apiKey, model, prompt) {
  const modelName = model || 'llama-3.3-70b-versatile';
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert BCA Computer Science University professor creating university-level multiple-choice examination questions. Respond strictly with a valid JSON array.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' }
      })
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = new Error(`Groq API error (${res.status}): ${errText}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const rawText = data?.choices?.[0]?.message?.content;
    if (!rawText) throw new Error('Empty response from Groq API');
    return parseQuizJson(rawText);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(apiKey, model, prompt) {
  const modelName = model || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: 'You are an academic BCA Computer Science professor. Output strictly valid JSON format only.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        response_format: { type: 'json_object' }
      })
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = new Error(`OpenAI API error (${res.status}): ${errText}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const rawText = data?.choices?.[0]?.message?.content;
    if (!rawText) throw new Error('Empty response from OpenAI API');
    return parseQuizJson(rawText);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Safely parse raw JSON from model response
 */
function parseQuizJson(text) {
  let cleaned = String(text || '').trim();
  // Strip markdown code fences if model returned ```json ... ```
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/s, '').trim();

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // Attempt to extract JSON array [ ... ] or object { ... }
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      parsed = JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
    } else {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        const obj = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        parsed = obj.questions || obj.quiz || obj.data || obj;
      }
    }
  }

  if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.questions)) {
    parsed = parsed.questions;
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Model did not return a valid array of questions');
  }

  return normalizeQuestions(parsed);
}

/**
 * Standardize question structure to ensure all fields are present & validated
 */
function normalizeQuestions(items) {
  return items.map((q, idx) => {
    const qText = String(q.question_text || q.question || q.prompt || `Question ${idx + 1}`).trim();
    
    // Support options in various formats: {A, B, C, D} or options array or option_a...
    let optA = '', optB = '', optC = '', optD = '';
    if (q.options && typeof q.options === 'object') {
      if (Array.isArray(q.options)) {
        optA = String(q.options[0] || 'Option A').trim();
        optB = String(q.options[1] || 'Option B').trim();
        optC = String(q.options[2] || 'Option C').trim();
        optD = String(q.options[3] || 'Option D').trim();
      } else {
        optA = String(q.options.A || q.options.a || q.option_a || 'Option A').trim();
        optB = String(q.options.B || q.options.b || q.option_b || 'Option B').trim();
        optC = String(q.options.C || q.options.c || q.option_c || 'Option C').trim();
        optD = String(q.options.D || q.options.d || q.option_d || 'Option D').trim();
      }
    } else {
      optA = String(q.option_a || 'Option A').trim();
      optB = String(q.option_b || 'Option B').trim();
      optC = String(q.option_c || 'Option C').trim();
      optD = String(q.option_d || 'Option D').trim();
    }

    let correct = String(q.correct_answer || q.answer || q.correct || 'A').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(correct)) {
      if (correct.includes('A') || correct === optA.toUpperCase()) correct = 'A';
      else if (correct.includes('B') || correct === optB.toUpperCase()) correct = 'B';
      else if (correct.includes('C') || correct === optC.toUpperCase()) correct = 'C';
      else if (correct.includes('D') || correct === optD.toUpperCase()) correct = 'D';
      else correct = 'A';
    }

    const explanation = String(q.explanation || q.reason || 'Refer to BCA standard textbook for detailed analysis.').trim();

    return {
      question_text: qText,
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      options: { A: optA, B: optB, C: optC, D: optD },
      correct_answer: correct,
      explanation
    };
  });
}

/**
 * Built-in Curriculum Fallback Engine
 * Generates verified high-yield BCA questions when external AI is unavailable or rate-limited
 */
function generateCurriculumFallback(subject, semester, count = 10, difficulty = 'medium') {
  const normSub = String(subject || '').toLowerCase();
  
  const questionBank = [
    // Programming & C / C++
    {
      topics: ['c', 'programming', 'c++', 'oop', 'c language'],
      q: 'Which of the following functions is dynamically allocated in heap memory in C?',
      options: { A: 'malloc()', B: 'printf()', C: 'scanf()', D: 'sizeof()' },
      ans: 'A',
      exp: 'malloc() dynamically allocates the specified number of bytes in heap memory and returns a void pointer.'
    },
    {
      topics: ['c', 'programming', 'pointers'],
      q: 'What is a "dangling pointer" in C/C++?',
      options: {
        A: 'A pointer pointing to deallocated or freed memory',
        B: 'A pointer initialized to NULL',
        C: 'A pointer that points to another pointer',
        D: 'A pointer stored in read-only memory'
      },
      ans: 'A',
      exp: 'A dangling pointer points to a memory location that has already been deallocated using free() or delete.'
    },
    {
      topics: ['c++', 'oop', 'object oriented'],
      q: 'Which OOP concept allows the same function name to behave differently based on arguments or object type?',
      options: { A: 'Polymorphism', B: 'Encapsulation', C: 'Inheritance', D: 'Abstraction' },
      ans: 'A',
      exp: 'Polymorphism (compile-time overloading or runtime overriding) allows one interface to perform different actions.'
    },
    {
      topics: ['c++', 'oop', 'constructors'],
      q: 'Can a constructor be declared as virtual in C++?',
      options: { A: 'No, constructors cannot be virtual', B: 'Yes, always', C: 'Only default constructors', D: 'Only copy constructors' },
      ans: 'A',
      exp: 'Constructors cannot be virtual because the vtable is constructed during object creation.'
    },

    // Data Structures
    {
      topics: ['data structures', 'dsa', 'stack', 'queue'],
      q: 'Which data structure follows the LIFO (Last In First Out) principle?',
      options: { A: 'Stack', B: 'Queue', C: 'Binary Tree', D: 'Linked List' },
      ans: 'A',
      exp: 'Stack elements are pushed and popped exclusively from the top, obeying the Last-In First-Out rule.'
    },
    {
      topics: ['data structures', 'trees', 'binary tree'],
      q: 'In a complete binary tree with N nodes, what is the height of the tree?',
      options: { A: 'O(log N)', B: 'O(N)', C: 'O(N^2)', D: 'O(1)' },
      ans: 'A',
      exp: 'A balanced or complete binary tree of N elements has a height of floor(log2(N)), yielding O(log N) depth.'
    },
    {
      topics: ['data structures', 'hashing', 'algorithms'],
      q: 'What is the average time complexity of searching for an element in a Hash Table?',
      options: { A: 'O(1)', B: 'O(log N)', C: 'O(N)', D: 'O(N log N)' },
      ans: 'A',
      exp: 'With a uniform hash function and minimal collisions, hash table lookup operates in average constant time O(1).'
    },

    // DBMS
    {
      topics: ['dbms', 'database', 'sql'],
      q: 'Which normal form guarantees the elimination of multi-valued dependencies?',
      options: { A: '4NF', B: '3NF', C: '2NF', D: 'BCNF' },
      ans: 'A',
      exp: 'Fourth Normal Form (4NF) specifically eliminates non-trivial multi-valued dependencies.'
    },
    {
      topics: ['dbms', 'database', 'keys'],
      q: 'What is the minimal super key called in relational database theory?',
      options: { A: 'Candidate Key', B: 'Foreign Key', C: 'Composite Key', D: 'Alternate Key' },
      ans: 'A',
      exp: 'A candidate key is a minimal super key having no redundant attributes that uniquely identifies tuples in a relation.'
    },
    {
      topics: ['dbms', 'transactions', 'acid'],
      q: 'Which component of the DBMS ensures the Durability property in ACID transactions?',
      options: { A: 'Recovery Management & Write-Ahead Log (WAL)', B: 'Query Optimizer', C: 'Concurrency Controller', D: 'Data Dictionary' },
      ans: 'A',
      exp: 'The Recovery Manager uses WAL (Write-Ahead Logging) and checkpoints to ensure committed transactions survive crashes.'
    },

    // Operating Systems
    {
      topics: ['operating systems', 'os', 'threads', 'processes'],
      q: 'Which of the following is NOT a necessary condition for a deadlock to occur?',
      options: { A: 'Preemption allowed', B: 'Mutual Exclusion', C: 'Hold and Wait', D: 'Circular Wait' },
      ans: 'A',
      exp: 'The four Coffman conditions are Mutual Exclusion, Hold & Wait, No Preemption, and Circular Wait. Preemption breaks deadlock.'
    },
    {
      topics: ['operating systems', 'memory', 'paging'],
      q: 'What is the phenomenon where page fault rate increases as more frames are allocated to a process in FIFO page replacement?',
      options: { A: 'Belady’s Anomaly', B: 'Thrashing', C: 'Segmentation Fault', D: 'Starvation' },
      ans: 'A',
      exp: 'Belady’s anomaly occurs specifically in FIFO page replacement when allocating more physical frames yields more page faults.'
    },
    {
      topics: ['operating systems', 'scheduling'],
      q: 'Which CPU scheduling algorithm is non-preemptive and selects the process with the shortest execution burst?',
      options: { A: 'SJF (Shortest Job First)', B: 'Round Robin', C: 'SRTF (Shortest Remaining Time First)', D: 'Priority Scheduling' },
      ans: 'A',
      exp: 'Standard SJF is non-preemptive. The preemptive variant is known as SRTF.'
    },

    // Computer Networks
    {
      topics: ['computer networks', 'networking', 'osi', 'tcp'],
      q: 'At which OSI layer does the IP (Internet Protocol) operate?',
      options: { A: 'Network Layer (Layer 3)', B: 'Transport Layer (Layer 4)', C: 'Data Link Layer (Layer 2)', D: 'Session Layer (Layer 5)' },
      ans: 'A',
      exp: 'Internet Protocol (IPv4/IPv6) is the fundamental addressing and routing protocol of the Network Layer (Layer 3).'
    },
    {
      topics: ['computer networks', 'transport', 'tcp', 'udp'],
      q: 'What is the size of the standard TCP header without optional fields?',
      options: { A: '20 bytes', B: '8 bytes', C: '16 bytes', D: '32 bytes' },
      ans: 'A',
      exp: 'The minimum TCP header size is 20 bytes (compared to UDP header which is 8 bytes).'
    },

    // Java & Python
    {
      topics: ['java', 'jvm'],
      q: 'Which memory area in the Java Virtual Machine (JVM) stores static variables and class metadata?',
      options: { A: 'Method Area / Metaspace', B: 'Heap Memory', C: 'JVM Stack', D: 'Program Counter Register' },
      ans: 'A',
      exp: 'The Method Area (Metaspace in Java 8+) stores per-class structures, static fields, method bytecodes, and runtime constant pool.'
    },
    {
      topics: ['python', 'programming'],
      q: 'In Python, which built-in data type is immutable?',
      options: { A: 'tuple', B: 'list', C: 'dict', D: 'set' },
      ans: 'A',
      exp: 'Tuples, strings, and integers are immutable in Python, meaning their contents cannot be modified after creation.'
    },

    // Web Technologies
    {
      topics: ['web', 'html', 'javascript', 'css'],
      q: 'Which HTTP status code signifies that a requested resource has been permanently moved?',
      options: { A: '301 Moved Permanently', B: '302 Found', C: '404 Not Found', D: '500 Internal Server Error' },
      ans: 'A',
      exp: 'HTTP 301 is the standard redirection status code indicating permanent URI relocation.'
    },
    {
      topics: ['software engineering', 'agile', 'sdlc'],
      q: 'In the Waterfall SDLC model, which phase immediately follows System Analysis and Requirements Specification?',
      options: { A: 'System Design', B: 'Implementation / Coding', C: 'Integration & Testing', D: 'Maintenance' },
      ans: 'A',
      exp: 'In classic Waterfall, requirements lead directly into architectural and detailed system design before code is written.'
    }
  ];

  // Match questions by subject keyword
  let matched = questionBank.filter(item => {
    return item.topics.some(t => normSub.includes(t));
  });

  // If few or no matches, take the best available questions across BCA
  if (matched.length < count) {
    const remaining = questionBank.filter(q => !matched.includes(q));
    matched = matched.concat(remaining);
  }

  // Shuffle questions randomly
  const shuffled = matched.sort(() => 0.5 - Math.random()).slice(0, count);

  return shuffled.map((item, idx) => ({
    question_text: item.q,
    option_a: item.options.A,
    option_b: item.options.B,
    option_c: item.options.C,
    option_d: item.options.D,
    options: item.options,
    correct_answer: item.ans,
    explanation: item.exp
  }));
}

/**
 * Dynamically collect all configured API keys for a provider
 * ZERO CODE CHANGES EVER NEEDED IN THE FUTURE:
 *   1. Comma/space/newline-separated list: GEMINI_API_KEYS="key1,key2,key3..." (unlimited keys)
 *   2. Dynamic Regex Auto-Discovery: Automatically detects ANY variable in process.env
 *      matching GEMINI_API_KEY_*, GEMINI_KEY_*, etc. (whether it is _7, _8, _9, _50, or _100)
 */
function collectProviderKeys(providerName) {
  const p = providerName.toUpperCase();
  const keys = [];

  // Helper to safely add unique non-empty keys
  const addKey = (val) => {
    if (!val) return;
    const clean = String(val).trim();
    if (clean && !keys.includes(clean)) keys.push(clean);
  };

  // 1. Comma/newline/space separated list (e.g. GEMINI_API_KEYS="key1, key2, key3...")
  const multiVars = [`${p}_API_KEYS`, `${p}_KEYS`];
  multiVars.forEach(vName => {
    const raw = process.env[vName];
    if (raw) {
      raw.split(/[\s,;\n\r]+/).forEach(addKey);
    }
  });

  // 2. Base / default key (e.g. GEMINI_API_KEY)
  addKey(process.env[`${p}_API_KEY`]);
  addKey(process.env[`${p}_BACKUP_API_KEY`]);

  // 3. Dynamic Auto-Discovery of ANY numbered or custom variable in process.env!
  // Matches: GEMINI_API_KEY_1, GEMINI_API_KEY_7, GEMINI_API_KEY_99, GEMINI_KEY_2, etc.
  const prefixRegex = new RegExp(`^${p}_(?:API_)?KEY(?:_(\\d+|[A-Z0-9_-]+))?$`, 'i');

  const matchingEnvNames = Object.keys(process.env)
    .filter(name => prefixRegex.test(name))
    .sort((a, b) => {
      // Numerical sort: _1, _2 ... _10 before non-numeric
      const numA = parseInt((a.match(/\d+$/) || [])[0], 10);
      const numB = parseInt((b.match(/\d+$/) || [])[0], 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });

  matchingEnvNames.forEach(name => {
    addKey(process.env[name]);
  });

  return keys;
}

/**
 * Robust Multi-Key Pool AI Quiz Generator with Automatic Cascade Failover
 * 
 * Execution Cascade:
 *   1. Tries Gemini Keys Pool (Key 1 -> Key 2 -> Key 3 -> Key 4 -> Key 5...)
 *   2. If all Gemini keys fail/rate-limited (429), cascades to Groq Keys Pool (Key 1 -> Key 2...)
 *   3. If all Groq keys fail, cascades to OpenAI Keys Pool
 *   4. Zero-failure BCA Curriculum Question Engine fallback
 */
async function generateAiQuiz({
  subject = 'Data Structures',
  semester = 3,
  topic = '',
  questionCount = 10,
  difficulty = 'medium'
}) {
  const count = Math.min(Math.max(Number(questionCount) || 10, 5), 20);
  const semNum = Math.min(Math.max(Number(semester) || 1, 1), 6);
  
  // Prepare university-standard prompt
  const topicClause = topic ? `focusing especially on "${topic}"` : '';
  const prompt = `
You are a senior computer science university professor setting an end-semester multiple-choice examination for BCA (Bachelor of Computer Applications) Semester ${semNum}.
Subject: "${subject}" ${topicClause}.
Difficulty level: ${difficulty}.
Number of questions: ${count}.

Requirements:
1. Provide exactly ${count} multiple choice questions strictly aligned with Indian university BCA curriculum standards.
2. Each question MUST have exactly 4 plausible choices: option A, B, C, and D.
3. Mark the exact correct answer (A, B, C, or D).
4. Provide a clear, educational 1-2 sentence explanation clarifying the correct concept.
5. Return ONLY a valid JSON array of objects with the exact keys:
   [
     {
       "question_text": "Question statement here",
       "option_a": "First option",
       "option_b": "Second option",
       "option_c": "Third option",
       "option_d": "Fourth option",
       "correct_answer": "A",
       "explanation": "Why this answer is correct"
     }
   ]
No markdown fences, no conversational prose, only pure JSON.
`.trim();

  // Collect key pools for all providers
  const geminiKeys = collectProviderKeys('gemini');
  if (process.env.GOOGLE_AI_KEY && !geminiKeys.includes(process.env.GOOGLE_AI_KEY.trim())) {
    geminiKeys.push(process.env.GOOGLE_AI_KEY.trim());
  }
  const groqKeys = collectProviderKeys('groq');
  const openaiKeys = collectProviderKeys('openai');

  // Generic AI_PRIMARY_API_KEY / AI_BACKUP_API_KEY support
  if (process.env.AI_PRIMARY_API_KEY) {
    const prov = detectProvider(process.env.AI_PRIMARY_API_KEY, process.env.AI_PRIMARY_PROVIDER);
    if (prov === 'gemini' && !geminiKeys.includes(process.env.AI_PRIMARY_API_KEY)) geminiKeys.unshift(process.env.AI_PRIMARY_API_KEY);
    if (prov === 'groq' && !groqKeys.includes(process.env.AI_PRIMARY_API_KEY)) groqKeys.unshift(process.env.AI_PRIMARY_API_KEY);
    if (prov === 'openai' && !openaiKeys.includes(process.env.AI_PRIMARY_API_KEY)) openaiKeys.unshift(process.env.AI_PRIMARY_API_KEY);
  }
  if (process.env.AI_BACKUP_API_KEY) {
    const prov = detectProvider(process.env.AI_BACKUP_API_KEY, process.env.AI_BACKUP_PROVIDER);
    if (prov === 'gemini' && !geminiKeys.includes(process.env.AI_BACKUP_API_KEY)) geminiKeys.push(process.env.AI_BACKUP_API_KEY);
    if (prov === 'groq' && !groqKeys.includes(process.env.AI_BACKUP_API_KEY)) groqKeys.push(process.env.AI_BACKUP_API_KEY);
    if (prov === 'openai' && !openaiKeys.includes(process.env.AI_BACKUP_API_KEY)) openaiKeys.push(process.env.AI_BACKUP_API_KEY);
  }

  // 1. Try Gemini Key Pool in rotation
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  for (let i = 0; i < geminiKeys.length; i++) {
    const key = geminiKeys[i];
    try {
      console.info(`[AI Generator] Trying Gemini Key #${i + 1}/${geminiKeys.length} (${geminiModel})...`);
      const questions = await callGemini(key, geminiModel, prompt);
      if (questions && questions.length >= 3) {
        return {
          questions: questions.slice(0, count),
          provider: 'gemini',
          model: geminiModel,
          tier: `gemini_key_${i + 1}`
        };
      }
    } catch (err) {
      console.warn(`[AI Failover] Gemini Key #${i + 1} failed (${err.message}). Trying next available key...`);
    }
  }

  // 2. Cascade to Groq Key Pool in rotation
  const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  for (let i = 0; i < groqKeys.length; i++) {
    const key = groqKeys[i];
    try {
      console.info(`[AI Generator] Trying Groq Key #${i + 1}/${groqKeys.length} (${groqModel})...`);
      const questions = await callGroq(key, groqModel, prompt);
      if (questions && questions.length >= 3) {
        return {
          questions: questions.slice(0, count),
          provider: 'groq',
          model: groqModel,
          tier: `groq_key_${i + 1}`
        };
      }
    } catch (err) {
      console.warn(`[AI Failover] Groq Key #${i + 1} failed (${err.message}). Trying next available key...`);
    }
  }

  // 3. Cascade to OpenAI Key Pool
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  for (let i = 0; i < openaiKeys.length; i++) {
    const key = openaiKeys[i];
    try {
      console.info(`[AI Generator] Trying OpenAI Key #${i + 1}/${openaiKeys.length} (${openaiModel})...`);
      const questions = await callOpenAI(key, openaiModel, prompt);
      if (questions && questions.length >= 3) {
        return {
          questions: questions.slice(0, count),
          provider: 'openai',
          model: openaiModel,
          tier: `openai_key_${i + 1}`
        };
      }
    } catch (err) {
      console.warn(`[AI Failover] OpenAI Key #${i + 1} failed (${err.message}). Trying next available key...`);
    }
  }

  // 4. Zero-failure Curriculum Engine
  console.info(`[AI Generator] All external keys exhausted or unconfigured. Serving verified BCA curriculum questions for "${subject}" (Sem ${semNum})`);
  const fallbackQuestions = generateCurriculumFallback(subject, semNum, count, difficulty);
  return {
    questions: fallbackQuestions,
    provider: 'curriculum-engine',
    model: 'bca-standard-v1',
    tier: 'curriculum_fallback'
  };
}

module.exports = {
  generateAiQuiz,
  BCA_CURRICULUM,
  generateCurriculumFallback
};
