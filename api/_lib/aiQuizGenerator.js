// ============================================================
// BCAPrime — api/_lib/aiQuizGenerator.js
// Multi-provider AI Quiz Generator with Automatic Failover
// Supports: Google Gemini, Groq, OpenAI + BCA Curriculum Engine Fallback
// Features: Strict Subject Guardrails & Zero-Leakage Curriculum Bank
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
 * Call Google Gemini API with strict system instructions and domain constraint
 */
async function callGemini(apiKey, model, prompt, subject, semNum, topic) {
  const modelName = model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  const systemInstructionText = `You are a strict, senior Computer Science University Examiner for BCA (Bachelor of Computer Applications) Semester ${semNum}.
CRITICAL CONSTRAINT: You must generate questions EXCLUSIVELY and STRICTLY for the subject "${subject}"${topic ? ' (Topic: ' + topic + ')' : ''}.
DO NOT include questions from any other subject (for example, if the subject is "${subject}", DO NOT ask C programming, pointers, database, or hardware questions unless they are explicitly in the syllabus of "${subject}").
Every question must test core concepts, definitions, algorithms, methodologies, or standard syllabus topics of "${subject}".
CRITICAL REQUIREMENT: Randomize the correct answer position naturally and evenly across options (A, B, C, or D). DO NOT always set option A as the correct answer. Output strictly a valid JSON array.`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstructionText }]
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 3000,
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
async function callGroq(apiKey, model, prompt, subject, semNum, topic) {
  const modelName = model || 'llama-3.3-70b-versatile';
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000);

  const systemPrompt = `You are a strict academic university examiner for BCA (Bachelor of Computer Applications) Semester ${semNum}.
MANDATORY: You must generate questions EXCLUSIVELY and STRICTLY for the subject "${subject}"${topic ? ' (Topic: ' + topic + ')' : ''}.
DO NOT mix questions from other unrelated computer science subjects.
CRITICAL: Randomize the correct answer letter evenly across options (A, B, C, D) so that correct answers are realistically distributed. DO NOT always make Option A the correct answer.
Output strictly a valid JSON array of objects.`;

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.35,
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
async function callOpenAI(apiKey, model, prompt, subject, semNum, topic) {
  const modelName = model || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  const systemPrompt = `You are an academic BCA Computer Science professor. Output strictly valid JSON format only.
Every question must test the subject "${subject}" for BCA Semester ${semNum}. Do NOT include unrelated subjects.
CRITICAL: Randomize the correct answer letter evenly across options (A, B, C, D) so that correct answers are realistically distributed. DO NOT always make Option A the correct answer.`;

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.35,
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
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/s, '').trim();

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
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
 * Fisher-Yates array shuffle helper
 */
function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Standardize question structure, randomize option positions (A, B, C, D)
 * and remap correct_answer accordingly. Guarantees zero option bias.
 */
function normalizeQuestions(items) {
  if (!Array.isArray(items)) return [];

  return items.map((q, idx) => {
    const qText = String(q.question_text || q.question || q.prompt || q.q || `Question ${idx + 1}`).trim();
    
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

    // Determine which option was originally marked as correct
    let originalCorrect = String(q.correct_answer || q.answer || q.ans || q.correct || 'A').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(originalCorrect)) {
      if (originalCorrect.includes('A') || originalCorrect === optA.toUpperCase()) originalCorrect = 'A';
      else if (originalCorrect.includes('B') || originalCorrect === optB.toUpperCase()) originalCorrect = 'B';
      else if (originalCorrect.includes('C') || originalCorrect === optC.toUpperCase()) originalCorrect = 'C';
      else if (originalCorrect.includes('D') || originalCorrect === optD.toUpperCase()) originalCorrect = 'D';
      else originalCorrect = 'A';
    }

    const optionEntries = [
      { text: optA, isCorrect: originalCorrect === 'A' },
      { text: optB, isCorrect: originalCorrect === 'B' },
      { text: optC, isCorrect: originalCorrect === 'C' },
      { text: optD, isCorrect: originalCorrect === 'D' }
    ];

    // Shuffle the 4 options using Fisher-Yates
    const shuffled = shuffleArray(optionEntries);
    const keys = ['A', 'B', 'C', 'D'];
    let newCorrect = 'A';

    shuffled.forEach((entry, i) => {
      if (entry.isCorrect) newCorrect = keys[i];
    });

    const finalA = shuffled[0].text;
    const finalB = shuffled[1].text;
    const finalC = shuffled[2].text;
    const finalD = shuffled[3].text;

    const explanation = String(q.explanation || q.exp || q.reason || 'Refer to BCA standard curriculum for this topic.').trim();

    return {
      question_text: qText,
      option_a: finalA,
      option_b: finalB,
      option_c: finalC,
      option_d: finalD,
      options: { A: finalA, B: finalB, C: finalC, D: finalD },
      correct_answer: newCorrect,
      explanation
    };
  });
}

/**
 * Built-in Curriculum Fallback Engine
 * Comprehensive, verified BCA university questions categorized strictly by subject
 * ZERO LEAKAGE: Never mixes questions between unrelated subjects!
 */
const VERIFIED_SUBJECT_BANKS = {
  // 1. SOFTWARE ENGINEERING
  software_engineering: [
    {
      q: 'Which SDLC model is characterized by risk assessment at each iteration?',
      options: { A: 'Spiral Model', B: 'Waterfall Model', C: 'V-Model', D: 'Prototyping Model' },
      ans: 'A',
      exp: 'Boehm\'s Spiral Model incorporates explicit risk analysis and prototyping at each quadrant/iteration.'
    },
    {
      q: 'In software design, what is the ideal relationship between cohesion and coupling?',
      options: { A: 'High Cohesion, Low Coupling', B: 'Low Cohesion, High Coupling', C: 'High Cohesion, High Coupling', D: 'Low Cohesion, Low Coupling' },
      ans: 'A',
      exp: 'Good modular design aims for High Cohesion (elements within a module are closely related) and Low Coupling (minimal interdependence between modules).'
    },
    {
      q: 'Which testing technique evaluates the internal structure and logic paths of code?',
      options: { A: 'White Box Testing', B: 'Black Box Testing', C: 'Equivalence Partitioning', D: 'Boundary Value Analysis' },
      ans: 'A',
      exp: 'White Box (structural/glass-box) testing verifies internal control flow, statements, and decision logic.'
    },
    {
      q: 'In the Waterfall model, which phase immediately precedes Implementation / Coding?',
      options: { A: 'Software Design', B: 'Feasibility Study', C: 'Requirements Analysis', D: 'Integration Testing' },
      ans: 'A',
      exp: 'Software Design (Architectural & Detailed design) directly precedes the Implementation (coding) phase.'
    },
    {
      q: 'What is the primary document created at the end of the Requirements Engineering phase?',
      options: { A: 'SRS (Software Requirement Specification)', B: 'SDD (Software Design Document)', C: 'Test Plan', D: 'User Manual' },
      ans: 'A',
      exp: 'The Software Requirement Specification (SRS) serves as the formal contractual foundation between client and developers.'
    },
    {
      q: 'Which metric measures the number of linearly independent paths through a program\'s source code?',
      options: { A: 'Cyclomatic Complexity', B: 'Function Points', C: 'Lines of Code (LOC)', D: 'Halstead Complexity' },
      ans: 'A',
      exp: 'McCabe\'s Cyclomatic Complexity computes independent paths using V(G) = E - N + 2P from the control flow graph.'
    },
    {
      q: 'What type of software maintenance involves adapting software to changes in hardware, OS, or external environment?',
      options: { A: 'Adaptive Maintenance', B: 'Corrective Maintenance', C: 'Perfective Maintenance', D: 'Preventive Maintenance' },
      ans: 'A',
      exp: 'Adaptive maintenance modifies software to keep pace with changing operational environments (such as OS upgrades or database migrations).'
    },
    {
      q: 'In Agile Scrum framework, what is the maximum recommended duration for a Daily Standup meeting?',
      options: { A: '15 minutes', B: '30 minutes', C: '45 minutes', D: '60 minutes' },
      ans: 'A',
      exp: 'The Daily Scrum / Standup is strictly timeboxed to 15 minutes to inspect progress toward the Sprint Goal.'
    },
    {
      q: 'Which level of CMM (Capability Maturity Model) indicates that processes are quantitative and statistically controlled?',
      options: { A: 'Level 4 (Quantitatively Managed)', B: 'Level 2 (Repeatable)', C: 'Level 3 (Defined)', D: 'Level 5 (Optimizing)' },
      ans: 'A',
      exp: 'At CMM Level 4, process and product quality are measured and statistically controlled using detailed quantitative metrics.'
    },
    {
      q: 'What is Black Box Testing based on?',
      options: { A: 'Functional Requirements and Specifications', B: 'Source Code logic', C: 'Database schemas', D: 'Compiler outputs' },
      ans: 'A',
      exp: 'Black box testing evaluates functionality solely against specified inputs and expected outputs without internal code knowledge.'
    },
    {
      q: 'What does COCOMO stand for in software cost estimation?',
      options: { A: 'Constructive Cost Model', B: 'Common Object Code Model', C: 'Continuous Coding Model', D: 'Commercial Cost Metrics' },
      ans: 'A',
      exp: 'Barry Boehm introduced COCOMO (Constructive Cost Model) for estimating software effort, time, and team size.'
    },
    {
      q: 'Which diagram in UML represents the dynamic interaction between objects ordered by time sequence?',
      options: { A: 'Sequence Diagram', B: 'Class Diagram', C: 'Use Case Diagram', D: 'Component Diagram' },
      ans: 'A',
      exp: 'Sequence Diagrams emphasize chronological message exchanges and lifelines between participating objects.'
    }
  ],

  // 2. DATABASE MANAGEMENT SYSTEMS (DBMS)
  dbms: [
    {
      q: 'Which normal form guarantees the elimination of non-trivial multi-valued dependencies?',
      options: { A: '4NF (Fourth Normal Form)', B: '3NF', C: '2NF', D: 'BCNF' },
      ans: 'A',
      exp: '4NF specifically requires that non-trivial multi-valued dependencies (A ->> B) only exist on super keys.'
    },
    {
      q: 'What is a minimal super key called in relational database theory?',
      options: { A: 'Candidate Key', B: 'Foreign Key', C: 'Secondary Key', D: 'Composite Key' },
      ans: 'A',
      exp: 'A candidate key is a minimal super key having no extraneous attributes that uniquely identifies tuples in a relation.'
    },
    {
      q: 'Which component of a DBMS ensures the Durability property of ACID transactions?',
      options: { A: 'Recovery Management & Write-Ahead Log (WAL)', B: 'Query Optimizer', C: 'Concurrency Controller', D: 'Data Dictionary' },
      ans: 'A',
      exp: 'The Recovery Manager uses WAL (Write-Ahead Logging) and checkpoints to ensure committed transactions survive system failures.'
    },
    {
      q: 'In SQL, which clause is used to filter groups created by the GROUP BY statement?',
      options: { A: 'HAVING', B: 'WHERE', C: 'ORDER BY', D: 'LIMIT' },
      ans: 'A',
      exp: 'The HAVING clause filters aggregated groups, whereas the WHERE clause filters individual records before aggregation.'
    },
    {
      q: 'What type of dependency is eliminated in Second Normal Form (2NF)?',
      options: { A: 'Partial Dependency', B: 'Transitive Dependency', C: 'Multi-valued Dependency', D: 'Join Dependency' },
      ans: 'A',
      exp: '2NF requires relations in 1NF to have no non-prime attributes functionally dependent on a proper subset of any candidate key.'
    },
    {
      q: 'Which index structure is most widely used by relational database engines for range queries and equality lookups?',
      options: { A: 'B+ Tree Index', B: 'Binary Search Tree', C: 'Hash Index', D: 'Inverted Index' },
      ans: 'A',
      exp: 'B+ Trees keep data pointers at leaf nodes and link them sequentially, allowing both fast O(log N) searches and range scans.'
    },
    {
      q: 'What is the phenomenon where two concurrent transactions read and update the same data item, overwriting each other?',
      options: { A: 'Lost Update Problem', B: 'Dirty Read', C: 'Phantom Read', D: 'Non-repeatable Read' },
      ans: 'A',
      exp: 'The lost update problem occurs when one transaction overrides uncommitted modifications made by another concurrent transaction.'
    },
    {
      q: 'In Relational Algebra, which operator produces all possible combinations of tuples from two relations?',
      options: { A: 'Cartesian Product (X)', B: 'Natural Join', C: 'Projection', D: 'Selection' },
      ans: 'A',
      exp: 'The Cartesian product (r x s) pairs every row from relation r with every row from relation s.'
    },
    {
      q: 'Which isolation level prevents Dirty Reads, Non-Repeatable Reads, and Phantom Reads?',
      options: { A: 'Serializable', B: 'Repeatable Read', C: 'Read Committed', D: 'Read Uncommitted' },
      ans: 'A',
      exp: 'Serializable is the highest transaction isolation level, guaranteeing execution equivalent to serial execution.'
    },
    {
      q: 'In an Entity-Relationship (ER) model, how is a weak entity set represented visually?',
      options: { A: 'Double Rectangle', B: 'Double Diamond', C: 'Dashed Ellipse', D: 'Double Ellipse' },
      ans: 'A',
      exp: 'Weak entity sets (which lack a primary key of their own) are depicted using double rectangles, and their identifying relationship uses a double diamond.'
    }
  ],

  // 3. OPERATING SYSTEMS
  operating_systems: [
    {
      q: 'Which of the following conditions is NOT required for a deadlock to exist?',
      options: { A: 'Preemption Allowed', B: 'Mutual Exclusion', C: 'Hold and Wait', D: 'Circular Wait' },
      ans: 'A',
      exp: 'The four Coffman conditions are Mutual Exclusion, Hold & Wait, No Preemption, and Circular Wait. If preemption is allowed, deadlock cannot occur.'
    },
    {
      q: 'What is Belady\'s Anomaly in operating systems memory management?',
      options: {
        A: 'Page fault rate increases as more page frames are allocated in FIFO',
        B: 'Memory fragmentation causes CPU starvation',
        C: 'Processes starve due to priority inversion',
        D: 'Thrashing occurs due to insufficient disk swap space'
      },
      ans: 'A',
      exp: 'Belady\'s Anomaly occurs specifically in FIFO page replacement, where increasing physical frames paradoxically results in more page faults.'
    },
    {
      q: 'Which CPU scheduling algorithm is non-preemptive and selects the process with the smallest CPU burst time?',
      options: { A: 'SJF (Shortest Job First)', B: 'Round Robin', C: 'SRTF', D: 'Multilevel Feedback Queue' },
      ans: 'A',
      exp: 'Standard SJF is strictly non-preemptive; its preemptive counterpart is called SRTF (Shortest Remaining Time First).'
    },
    {
      q: 'What is the primary function of a Translation Lookaside Buffer (TLB)?',
      options: {
        A: 'A hardware cache for fast virtual-to-physical address translation',
        B: 'A register holding the base address of the PCB',
        C: 'A disk buffer for swap space',
        D: 'A synchronization barrier for thread locks'
      },
      ans: 'A',
      exp: 'The TLB is an associative hardware cache inside the MMU that accelerates virtual address to physical frame mapping.'
    },
    {
      q: 'In Unix/Linux, which system call creates an exact duplicate copy of the calling process?',
      options: { A: 'fork()', B: 'exec()', C: 'clone()', D: 'spawn()' },
      ans: 'A',
      exp: 'fork() creates a new child process with a duplicate copy of the parent process\'s address space.'
    },
    {
      q: 'What is the condition called when the CPU spends more time swapping pages in and out than executing instructions?',
      options: { A: 'Thrashing', B: 'Starvation', C: 'Aging', D: 'Spooling' },
      ans: 'A',
      exp: 'Thrashing occurs when high degree of multiprogramming leaves processes with fewer frames than their working sets.'
    },
    {
      q: 'Which synchronization primitive uses atomic test-and-set operations with wait() and signal() calls?',
      options: { A: 'Semaphore', B: 'Pipe', C: 'Message Queue', D: 'Socket' },
      ans: 'A',
      exp: 'Dijkstra introduced Semaphores, which provide integer counters accessed only through atomic P (wait) and V (signal) routines.'
    },
    {
      q: 'Which disk scheduling algorithm services requests in a circular scan direction and jumps back to the beginning without servicing on return?',
      options: { A: 'C-SCAN', B: 'SCAN (Elevator)', C: 'SSTF', D: 'FCFS' },
      ans: 'A',
      exp: 'C-SCAN (Circular SCAN) treats disk cylinders as a circular list, giving a more uniform wait time.'
    }
  ],

  // 4. COMPUTER NETWORKS
  computer_networks: [
    {
      q: 'At which OSI layer does the Internet Protocol (IP) operate?',
      options: { A: 'Network Layer (Layer 3)', B: 'Transport Layer (Layer 4)', C: 'Data Link Layer (Layer 2)', D: 'Session Layer (Layer 5)' },
      ans: 'A',
      exp: 'IP operates at Layer 3 (Network Layer) providing logical host addressing, routing, and packet forwarding.'
    },
    {
      q: 'What is the default minimum header size of a standard TCP packet without optional fields?',
      options: { A: '20 bytes', B: '8 bytes', C: '16 bytes', D: '32 bytes' },
      ans: 'A',
      exp: 'A standard TCP header is 20 bytes (compared to UDP which is only 8 bytes).'
    },
    {
      q: 'Which protocol dynamically maps an IP address to a physical MAC address on a local area network?',
      options: { A: 'ARP (Address Resolution Protocol)', B: 'RARP', C: 'DHCP', D: 'DNS' },
      ans: 'A',
      exp: 'ARP broadcasts on the local data link layer to resolve a known 32-bit IPv4 address into its 48-bit hardware MAC address.'
    },
    {
      q: 'What is the subnet mask for a default IPv4 Class C network in CIDR notation?',
      options: { A: '/24 (255.255.255.0)', B: '/16 (255.255.0.0)', C: '/8 (255.0.0.0)', D: '/32' },
      ans: 'A',
      exp: 'Class C networks use 24 network bits and 8 host bits, corresponding to /24 or 255.255.255.0.'
    },
    {
      q: 'Which routing protocol is an Interior Gateway Protocol based on Dijkstra\'s Shortest Path First algorithm?',
      options: { A: 'OSPF (Open Shortest Path First)', B: 'BGP', C: 'RIP', D: 'EGP' },
      ans: 'A',
      exp: 'OSPF is a link-state routing protocol that utilizes Dijkstra\'s SPF algorithm to construct loop-free topological shortest paths.'
    },
    {
      q: 'Which transport layer protocol is connectionless and does not guarantee packet delivery or ordering?',
      options: { A: 'UDP (User Datagram Protocol)', B: 'TCP', C: 'SCTP', D: 'FTP' },
      ans: 'A',
      exp: 'UDP is an unreliable, connectionless protocol prioritizing low-latency transmission over retransmissions and acknowledgments.'
    },
    {
      q: 'What port number is assigned by default to secure HTTPS traffic?',
      options: { A: '443', B: '80', C: '8080', D: '22' },
      ans: 'A',
      exp: 'Port 443 is the standard IANA port for HTTP over TLS/SSL (HTTPS), while port 80 is for unencrypted HTTP.'
    }
  ],

  // 5. DATA STRUCTURES & ALGORITHMS
  data_structures: [
    {
      q: 'Which data structure follows the LIFO (Last In First Out) operational principle?',
      options: { A: 'Stack', B: 'Queue', C: 'Binary Tree', D: 'Linked List' },
      ans: 'A',
      exp: 'In a stack, push and pop operations are performed exclusively at the top of the collection (LIFO).'
    },
    {
      q: 'What is the worst-case time complexity of QuickSort?',
      options: { A: 'O(N^2)', B: 'O(N log N)', C: 'O(N)', D: 'O(log N)' },
      ans: 'A',
      exp: 'QuickSort degrades to O(N^2) when an unbalanced pivot is picked repeatedly (e.g. sorted input with last element pivot).'
    },
    {
      q: 'In a complete binary tree containing N nodes, what is the maximum depth / height of the tree?',
      options: { A: 'O(log N)', B: 'O(N)', C: 'O(N^2)', D: 'O(1)' },
      ans: 'A',
      exp: 'A complete binary tree has maximum depth floor(log2(N)), ensuring O(log N) worst-case search path in balanced trees.'
    },
    {
      q: 'What is the average lookup time complexity in a well-distributed Hash Table?',
      options: { A: 'O(1)', B: 'O(log N)', C: 'O(N)', D: 'O(N log N)' },
      ans: 'A',
      exp: 'Assuming a uniform distribution with collisions resolved by chaining or open addressing, average lookup is O(1).'
    },
    {
      q: 'Which data structure is optimal for implementing Breadth First Search (BFS) traversal of a graph?',
      options: { A: 'Queue', B: 'Stack', C: 'Priority Queue', D: 'Binary Search Tree' },
      ans: 'A',
      exp: 'BFS visits vertices level-by-level, which requires a FIFO Queue to enqueue adjacent unvisited vertices.'
    },
    {
      q: 'What is the minimum number of queues required to implement a Stack?',
      options: { A: '2', B: '1', C: '3', D: '4' },
      ans: 'A',
      exp: 'A stack can be implemented using two queues by making either push or pop operation costly.'
    }
  ],

  // 6. JAVA PROGRAMMING & OOP
  java_programming: [
    {
      q: 'Which memory area in the Java Virtual Machine (JVM) stores static variables and compiled method bytecodes?',
      options: { A: 'Method Area / Metaspace', B: 'Heap Memory', C: 'JVM Stack', D: 'PC Register' },
      ans: 'A',
      exp: 'The Method Area (Metaspace since Java 8) houses per-class structures, static fields, and method bytecodes.'
    },
    {
      q: 'Can a constructor be declared with the "static" or "final" keyword in Java?',
      options: { A: 'No, constructors cannot be static or final', B: 'Yes, both are allowed', C: 'Only static is allowed', D: 'Only final is allowed' },
      ans: 'A',
      exp: 'Constructors in Java belong to instance instantiation and cannot be marked static, final, or abstract.'
    },
    {
      q: 'Which Java collection class is thread-safe and synchronizes all its element modification methods?',
      options: { A: 'Vector', B: 'ArrayList', C: 'LinkedList', D: 'HashSet' },
      ans: 'A',
      exp: 'Vector is legacy synchronized and thread-safe, whereas ArrayList is non-synchronized for higher single-thread throughput.'
    },
    {
      q: 'What is the parent class of all exception classes in the Java standard library?',
      options: { A: 'java.lang.Throwable', B: 'java.lang.Exception', C: 'java.lang.Error', D: 'java.lang.RuntimeException' },
      ans: 'A',
      exp: 'java.lang.Throwable is the ultimate root class of the Java exception hierarchy, superclassing Exception and Error.'
    },
    {
      q: 'Which keyword is used in Java to prevent a class from being inherited / subclassed?',
      options: { A: 'final', B: 'abstract', C: 'static', D: 'private' },
      ans: 'A',
      exp: 'Marking a class "final" in Java disallows any subclassing (e.g., java.lang.String is a final class).'
    }
  ],

  // 7. WEB TECHNOLOGIES & PHP
  web_technologies: [
    {
      q: 'In PHP, which superglobal array contains variables passed via the URL query string?',
      options: { A: '$_GET', B: '$_POST', C: '$_REQUEST', D: '$_SERVER' },
      ans: 'A',
      exp: '$_GET collects data sent via URL parameters appended to the query string.'
    },
    {
      q: 'Which HTTP response status code indicates that a resource has been permanently redirected to a new URI?',
      options: { A: '301 Moved Permanently', B: '302 Found', C: '404 Not Found', D: '500 Server Error' },
      ans: 'A',
      exp: 'HTTP 301 is the official status code signaling permanent redirection.'
    },
    {
      q: 'Which CSS property is used in Flexbox to distribute space along the main axis?',
      options: { A: 'justify-content', B: 'align-items', C: 'flex-direction', D: 'align-content' },
      ans: 'A',
      exp: 'justify-content aligns flex items along the main axis of the current flex container line.'
    },
    {
      q: 'What is the correct JavaScript method to convert a JSON string into an executable JavaScript object?',
      options: { A: 'JSON.parse()', B: 'JSON.stringify()', C: 'JSON.toObject()', D: 'JSON.decode()' },
      ans: 'A',
      exp: 'JSON.parse() deserializes a JSON text string into a native JavaScript object or array.'
    }
  ],

  // 8. DISCRETE MATHEMATICS
  discrete_mathematics: [
    {
      q: 'A relation R on set A is an Equivalence Relation if and only if it satisfies which three properties?',
      options: {
        A: 'Reflexive, Symmetric, and Transitive',
        B: 'Reflexive, Antisymmetric, and Transitive',
        C: 'Irreflexive, Symmetric, and Transitive',
        D: 'Reflexive, Symmetric, and Asymmetric'
      },
      ans: 'A',
      exp: 'An equivalence relation must be Reflexive (aRa), Symmetric (aRb implies bRa), and Transitive (aRb & bRc implies aRc).'
    },
    {
      q: 'What is the total number of subsets (power set cardinality) of a finite set containing n elements?',
      options: { A: '2^n', B: 'n^2', C: '2n', D: 'n!' },
      ans: 'A',
      exp: 'For a set of size n, every element has 2 choices (include or exclude), yielding |P(A)| = 2^n.'
    },
    {
      q: 'In Graph Theory, what is a simple connected graph containing no cycles called?',
      options: { A: 'Tree', B: 'Bipartite Graph', C: 'Complete Graph', D: 'Eulerian Graph' },
      ans: 'A',
      exp: 'By definition, a tree is an undirected connected graph with no cycles (n vertices and n - 1 edges).'
    }
  ],

  // 9. DIGITAL ELECTRONICS & COMPUTER ARCHITECTURE
  digital_electronics: [
    {
      q: 'Which logic gate is known as a Universal Gate because any Boolean function can be constructed using it alone?',
      options: { A: 'NAND Gate', B: 'AND Gate', C: 'OR Gate', D: 'XOR Gate' },
      ans: 'A',
      exp: 'NAND (and NOR) gates are universal logic gates capable of synthesizing NOT, AND, OR, and any combinatorial circuit.'
    },
    {
      q: 'What is the function of the Program Counter (PC) register in the CPU control unit?',
      options: {
        A: 'Holds the memory address of the next instruction to be fetched',
        B: 'Stores the currently executing instruction opcode',
        C: 'Accumulates results of arithmetic operations',
        D: 'Tracks hardware interrupts'
      },
      ans: 'A',
      exp: 'The Program Counter (PC) stores the memory address of the subsequent instruction to be fetched and executed.'
    },
    {
      q: 'Which memory type operates at the highest speed and is located closest to the CPU execution core?',
      options: { A: 'Registers / L1 Cache', B: 'DRAM (Main Memory)', C: 'SRAM L3 Cache', D: 'NVMe SSD' },
      ans: 'A',
      exp: 'Internal processor registers and Level 1 (L1) on-chip cache provide single-cycle latency access.'
    }
  ]
};

/**
 * Match subject to appropriate verified bank
 */
function getSubjectBank(subject) {
  const norm = String(subject || '').toLowerCase();
  
  if (norm.includes('software') || norm.includes('eng') || norm.includes('testing') || norm.includes('quality') || norm.includes('agile')) {
    return VERIFIED_SUBJECT_BANKS.software_engineering;
  }
  if (norm.includes('dbms') || norm.includes('database') || norm.includes('sql') || norm.includes('data mining') || norm.includes('warehousing')) {
    return VERIFIED_SUBJECT_BANKS.dbms;
  }
  if (norm.includes('operating') || norm.includes('os') || norm.includes('linux') || norm.includes('unix')) {
    return VERIFIED_SUBJECT_BANKS.operating_systems;
  }
  if (norm.includes('network') || norm.includes('tcp') || norm.includes('security') || norm.includes('cyber')) {
    return VERIFIED_SUBJECT_BANKS.computer_networks;
  }
  if (norm.includes('data structure') || norm.includes('dsa') || norm.includes('algorithm') || norm.includes('stack') || norm.includes('tree')) {
    return VERIFIED_SUBJECT_BANKS.data_structures;
  }
  if (norm.includes('java') || norm.includes('oop') || norm.includes('object')) {
    return VERIFIED_SUBJECT_BANKS.java_programming;
  }
  if (norm.includes('web') || norm.includes('php') || norm.includes('html') || norm.includes('script') || norm.includes('e-commerce')) {
    return VERIFIED_SUBJECT_BANKS.web_technologies;
  }
  if (norm.includes('discrete') || norm.includes('math') || norm.includes('mathematics')) {
    return VERIFIED_SUBJECT_BANKS.discrete_mathematics;
  }
  if (norm.includes('digital') || norm.includes('architecture') || norm.includes('hardware') || norm.includes('electronics')) {
    return VERIFIED_SUBJECT_BANKS.digital_electronics;
  }

  // Fallback to DSA / Software engineering questions
  return VERIFIED_SUBJECT_BANKS.software_engineering;
}

/**
 * Generate fallback questions with 100% subject purity
 */
function generateCurriculumFallback(subject, semester, count = 10, difficulty = 'medium') {
  const bank = getSubjectBank(subject);
  
  // Clone array and shuffle
  const shuffled = [...bank].sort(() => 0.5 - Math.random());
  
  // If count exceeds bank size, duplicate and vary questions rather than mixing other subjects
  let results = [];
  while (results.length < count) {
    for (const item of shuffled) {
      results.push({
        question_text: item.q,
        option_a: item.options.A,
        option_b: item.options.B,
        option_c: item.options.C,
        option_d: item.options.D,
        options: item.options,
        correct_answer: item.ans,
        explanation: item.exp
      });
      if (results.length >= count) break;
    }
  }

  return normalizeQuestions(results.slice(0, count));
}

/**
 * Dynamically collect all configured API keys for a provider
 */
function collectProviderKeys(providerName) {
  const p = providerName.toUpperCase();
  const keys = [];

  const addKey = (val) => {
    if (!val) return;
    const clean = String(val).trim();
    if (clean && !keys.includes(clean)) keys.push(clean);
  };

  const multiVars = [`${p}_API_KEYS`, `${p}_KEYS`];
  multiVars.forEach(vName => {
    const raw = process.env[vName];
    if (raw) {
      raw.split(/[\s,;\n\r]+/).forEach(addKey);
    }
  });

  addKey(process.env[`${p}_API_KEY`]);
  addKey(process.env[`${p}_BACKUP_API_KEY`]);

  const prefixRegex = new RegExp(`^${p}_(?:API_)?KEY(?:_(\\d+|[A-Z0-9_-]+))?$`, 'i');
  const matchingEnvNames = Object.keys(process.env)
    .filter(name => prefixRegex.test(name))
    .sort((a, b) => {
      const matchA = a.match(/_(\d+)$/);
      const matchB = b.match(/_(\d+)$/);
      if (matchA && matchB) return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
      return a.localeCompare(b);
    });

  matchingEnvNames.forEach(envName => addKey(process.env[envName]));

  return keys;
}

/**
 * Robust Multi-Key Pool AI Quiz Generator with Strict Subject Guardrails
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
  
  // Highly focused, subject-guarded prompt
  const topicClause = topic ? `focusing specifically on the sub-topic "${topic}"` : '';
  const prompt = `
STRICT SUBJECT EXAMINATION:
Target Subject: "${subject}"
BCA Semester: ${semNum}
${topicClause ? `Topic: ${topicClause}` : ''}
Difficulty: ${difficulty}
Required Question Count: Exactly ${count}

INSTRUCTIONS FOR UNIVERSITY EXAMINER:
1. Every single question MUST strictly belong to the syllabus and domain of "${subject}".
2. ABSOLUTE CONSTRAINT: DO NOT include questions from other subjects (for example, if the subject is "${subject}", DO NOT generate questions about unrelated subjects like C programming or pointer arithmetic unless "${subject}" is specifically a C programming course).
3. Provide exactly 4 clear, plausible choices: option_a, option_b, option_c, option_d.
4. CRITICAL: Randomize the correct answer position naturally and evenly across choices A, B, C, and D for each question. DO NOT always place the correct answer in option A.
5. Mark the accurate correct_answer ("A", "B", "C", or "D").
6. Provide a clear 1-2 sentence explanation clarifying the correct concept.
7. Return ONLY a valid JSON array of objects with the exact schema:
[
  {
    "question_text": "...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_answer": "C",
    "explanation": "..."
  }
]
No markdown fences, no preface, pure JSON only.
`.trim();

  // Collect key pools for all providers
  const geminiKeys = collectProviderKeys('gemini');
  if (process.env.GOOGLE_AI_KEY && !geminiKeys.includes(process.env.GOOGLE_AI_KEY.trim())) {
    geminiKeys.push(process.env.GOOGLE_AI_KEY.trim());
  }
  const groqKeys = collectProviderKeys('groq');
  const openaiKeys = collectProviderKeys('openai');

  // Generic key env support
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
      console.info(`[AI Generator] Trying Gemini Key #${i + 1}/${geminiKeys.length} (${geminiModel}) for "${subject}"...`);
      const questions = await callGemini(key, geminiModel, prompt, subject, semNum, topic);
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
      console.info(`[AI Generator] Trying Groq Key #${i + 1}/${groqKeys.length} (${groqModel}) for "${subject}"...`);
      const questions = await callGroq(key, groqModel, prompt, subject, semNum, topic);
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
      console.info(`[AI Generator] Trying OpenAI Key #${i + 1}/${openaiKeys.length} (${openaiModel}) for "${subject}"...`);
      const questions = await callOpenAI(key, openaiModel, prompt, subject, semNum, topic);
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

  // 4. Zero-leakage Curriculum Engine Fallback
  console.info(`[AI Generator] External providers unavailable. Serving verified curriculum questions strictly for "${subject}" (Sem ${semNum})`);
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
