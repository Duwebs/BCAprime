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
DO NOT include questions from any other subject. Every question must test core concepts, definitions, algorithms, methodologies, or standard syllabus topics of "${subject}" for BCA Semester ${semNum}.
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
    },
    {
      q: 'Which memory type operates at the highest speed and is located closest to the CPU execution core?',
      options: { A: 'Registers / L1 Cache', B: 'DRAM (Main Memory)', C: 'SRAM L3 Cache', D: 'NVMe SSD' },
      ans: 'A',
      exp: 'Internal processor registers and Level 1 (L1) on-chip cache provide single-cycle latency access.'
    }
  ],

  // 10. C PROGRAMMING
  c_programming: [
    {
      q: 'Which format specifier is specifically designed to print memory addresses in C?',
      options: { A: '%p', B: '%x', C: '%u', D: '%d' },
      ans: 'A',
      exp: 'The %p format specifier is specifically defined in standard C to output void pointers as hexadecimal memory addresses.'
    },
    {
      q: 'What is the standard return type of the main() function in modern C (C99 and later)?',
      options: { A: 'int', B: 'void', C: 'char', D: 'float' },
      ans: 'A',
      exp: 'According to ISO C standards (C99, C11, C17), main() must return an int indicating process termination status to the host OS.'
    },
    {
      q: 'What does a break statement do inside a nested inner loop in C?',
      options: { A: 'Terminates only the innermost enclosing loop', B: 'Terminates all nested loops', C: 'Skips to the next iteration', D: 'Restarts the loop from 0' },
      ans: 'A',
      exp: 'A break statement exits only the innermost loop or switch statement that contains it.'
    },
    {
      q: 'What is the primary difference between malloc() and calloc() memory allocation in C?',
      options: { A: 'calloc() initializes allocated memory to zero; malloc() leaves memory uninitialized', B: 'malloc() allocates from heap; calloc() from stack', C: 'calloc() cannot allocate arrays', D: 'malloc() automatically frees memory' },
      ans: 'A',
      exp: 'calloc(n, size) initializes every byte to zero, whereas malloc(size) leaves allocated heap memory with indeterminate (garbage) values.'
    },
    {
      q: 'Which character automatically terminates all standard C strings in memory?',
      options: { A: '\\0 (null character)', B: '\\n', C: 'EOF', D: 'Space' },
      ans: 'A',
      exp: 'In C, strings are null-terminated arrays of characters ending with the byte value 0 (\'\\0\').'
    },
    {
      q: 'What is the size of any memory pointer on a standard 64-bit architecture in C?',
      options: { A: '8 bytes', B: '4 bytes', C: '2 bytes', D: 'Depends on the data type pointed to' },
      ans: 'A',
      exp: 'On a 64-bit architecture, every pointer holds a 64-bit address, occupying exactly 8 bytes of storage.'
    },
    {
      q: 'What is the key difference between a struct and a union in C?',
      options: { A: 'Union members share the same memory location; struct members have distinct memory locations', B: 'Struct cannot store pointers', C: 'Union cannot contain different data types', D: 'Union is dynamically allocated only' },
      ans: 'A',
      exp: 'In a union, all members overlap in the same memory space equal to the size of the largest member; in a struct, each member has separate memory.'
    },
    {
      q: 'Which preprocessor directive is used to prevent multiple inclusions of header files in C?',
      options: { A: '#ifndef / #define header guards', B: '#pragma loop', C: '#undef', D: '#import' },
      ans: 'A',
      exp: 'Conditional preprocessor directives (#ifndef HEADER_H, #define HEADER_H, #endif) prevent duplicate inclusion of header code.'
    },
    {
      q: 'In C, how are standard function arguments passed by default?',
      options: { A: 'Pass by value', B: 'Pass by reference', C: 'Pass by name', D: 'Pass by pointer' },
      ans: 'A',
      exp: 'C strictly uses pass-by-value for all function parameters. Pass-by-reference is simulated by passing pointer values.'
    },
    {
      q: 'What does the bitwise operator ^ perform in C?',
      options: { A: 'Bitwise XOR', B: 'Bitwise AND', C: 'Bitwise OR', D: 'Bitwise NOT' },
      ans: 'A',
      exp: 'In C, the caret symbol ^ denotes the bitwise exclusive-OR (XOR) operator.'
    },
    {
      q: 'Which standard library function is used to release dynamically allocated heap memory in C?',
      options: { A: 'free()', B: 'delete()', C: 'dealloc()', D: 'realloc(NULL)' },
      ans: 'A',
      exp: 'The free() function deallocates memory blocks previously allocated by malloc(), calloc(), or realloc().'
    },
    {
      q: 'What value does getchar() return when it reaches the end of an input stream?',
      options: { A: 'EOF (-1)', B: '0', B: 'NULL', D: '\\0' },
      ans: 'A',
      exp: 'getchar() returns an int value equal to EOF (typically -1) upon encountering end-of-file or an input error.'
    }
  ],

  // 11. COMPUTER FUNDAMENTALS & OFFICE AUTOMATION (CFOA)
  cfoa: [
    {
      q: 'Which unit inside the CPU performs arithmetic computations and logical decision operations?',
      options: { A: 'ALU (Arithmetic Logic Unit)', B: 'Control Unit', C: 'Registers', D: 'System Bus' },
      ans: 'A',
      exp: 'The ALU executes all basic arithmetic calculations (addition, subtraction) and logical comparisons (AND, OR, NOT).'
    },
    {
      q: 'Which type of computer memory is volatile and loses its contents when power is turned off?',
      options: { A: 'RAM (Random Access Memory)', B: 'ROM (Read Only Memory)', C: 'Flash Drive', D: 'Hard Disk Drive' },
      ans: 'A',
      exp: 'RAM is volatile semiconductor memory that requires continuous electrical power to retain active data.'
    },
    {
      q: 'What is the binary equivalent of the decimal number 13?',
      options: { A: '1101', B: '1011', C: '1110', D: '1100' },
      ans: 'A',
      exp: '13 in binary = 8 + 4 + 0 + 1 = 1101 in base 2.'
    },
    {
      q: 'In Microsoft Excel / spreadsheet software, what symbol must precede every mathematical formula?',
      options: { A: '= (equal to)', B: '@', C: '#', D: '$' },
      ans: 'A',
      exp: 'All spreadsheet formulas begin with an equal sign (=) to inform the spreadsheet engine to evaluate the expression.'
    },
    {
      q: 'Which feature in word processing allows sending personalized letters or certificates to multiple recipients automatically?',
      options: { A: 'Mail Merge', B: 'Macros', C: 'Autotext', D: 'Track Changes' },
      ans: 'A',
      exp: 'Mail Merge combines a template document with a data source (such as a table or spreadsheet) to generate customized copies.'
    },
    {
      q: 'What is the primary role of the BIOS / UEFI during computer startup?',
      options: { A: 'Executes POST (Power-On Self Test) and loads the OS bootloader', B: 'Installs user application software', C: 'Compiles high-level code', D: 'Scans for network viruses' },
      ans: 'A',
      exp: 'BIOS (Basic Input/Output System) performs POST hardware diagnostics and hands over control to the OS bootloader on storage.'
    },
    {
      q: 'In a spreadsheet, which function looks up a value in the leftmost column of a table and returns a value in the same row from a specified column?',
      options: { A: 'VLOOKUP', B: 'COUNTIF', C: 'SUMIF', D: 'CONCATENATE' },
      ans: 'A',
      exp: 'VLOOKUP (Vertical Lookup) searches for a key in the first column of a table range and returns corresponding column data.'
    },
    {
      q: 'Which of the following is categorized as System Software rather than Application Software?',
      options: { A: 'Operating System', B: 'Web Browser', C: 'Photo Editor', D: 'Word Processor' },
      ans: 'A',
      exp: 'Operating systems, device drivers, and utility programs are system software that manage and coordinate hardware operations.'
    },
    {
      q: 'In PowerPoint / presentation software, what is the visual effect that occurs when moving from one slide to the next called?',
      options: { A: 'Slide Transition', B: 'Animation', C: 'Trigger', D: 'Slide Master' },
      ans: 'A',
      exp: 'Transitions govern the motion between full slides; Animations govern individual objects within a single slide.'
    },
    {
      q: 'What does 1 Terabyte (TB) equal in standard binary computing (bytes)?',
      options: { A: '1024 Gigabytes (GB)', B: '1000 Megabytes (MB)', C: '1024 Kilobytes (KB)', D: '100 Gigabytes (GB)' },
      ans: 'A',
      exp: 'In computer memory scaling, 1 TB = 1024 GB = 1024 * 1024 MB.'
    },
    {
      q: 'What type of printer uses a laser beam to produce an image on a drum using powdered toner?',
      options: { A: 'Laser Printer', B: 'Inkjet Printer', C: 'Dot Matrix Printer', D: 'Thermal Printer' },
      ans: 'A',
      exp: 'Laser printers use electrophotographic technology with laser light and dry toner powder to produce high-speed printouts.'
    },
    {
      q: 'What is the full form of GUI in modern computing systems?',
      options: { A: 'Graphical User Interface', B: 'General Utility Instruction', C: 'Graphic Unified Integration', D: 'Global User Interaction' },
      ans: 'A',
      exp: 'GUI stands for Graphical User Interface, enabling user interaction via visual icons, menus, and pointers.'
    }
  ],

  // 12. ELEMENTS OF STATISTICS
  statistics: [
    {
      q: 'Which measure of central tendency represents the most frequently occurring value in a data set?',
      options: { A: 'Mode', B: 'Mean', C: 'Median', D: 'Variance' },
      ans: 'A',
      exp: 'The mode is defined as the observation value that appears with the highest frequency in a given distribution.'
    },
    {
      q: 'For a moderately asymmetrical frequency distribution, what is the empirical relationship between Mean, Median, and Mode?',
      options: { A: 'Mode = 3 Median - 2 Mean', B: 'Mode = 2 Median - 3 Mean', C: 'Mean = 3 Median - 2 Mode', D: 'Median = 3 Mode - 2 Mean' },
      ans: 'A',
      exp: 'Karl Pearson established the empirical relationship: Mode = 3 * Median - 2 * Mean.'
    },
    {
      q: 'How is Standard Deviation mathematically related to Variance?',
      options: { A: 'Standard Deviation is the positive square root of Variance', B: 'Standard Deviation is Variance squared', C: 'Standard Deviation is Variance divided by n', D: 'They are identical' },
      ans: 'A',
      exp: 'Standard Deviation (sigma) is the positive square root of the variance: sigma = sqrt(variance).'
    },
    {
      q: 'What is the valid numerical range for any standard probability P(E)?',
      options: { A: '0 <= P(E) <= 1', B: '-1 <= P(E) <= 1', C: '0 < P(E) < 100', D: 'P(E) >= 1' },
      ans: 'A',
      exp: 'Probability values strictly lie between 0 (impossible event) and 1 (certain event) inclusive.'
    },
    {
      q: 'In a perfectly symmetrical Normal Distribution curve, which of the following is true?',
      options: { A: 'Mean = Median = Mode', B: 'Mean > Median > Mode', C: 'Mode > Median > Mean', D: 'Variance = Mean' },
      ans: 'A',
      exp: 'The standard bell-shaped normal distribution is symmetrical about its center, where Mean, Median, and Mode coincide.'
    },
    {
      q: 'What is the range of Pearson\'s coefficient of correlation (r)?',
      options: { A: '-1 <= r <= +1', B: '0 <= r <= 1', C: '-infinity < r < +infinity', D: '0 <= r <= 100' },
      ans: 'A',
      exp: 'Pearson\'s linear correlation coefficient r is bounded between -1 (perfect negative correlation) and +1 (perfect positive correlation).'
    },
    {
      q: 'What is the probability of obtaining an even number on a single roll of an unbiased six-sided die?',
      options: { A: '1/2 (0.5)', B: '1/3', C: '1/6', D: '2/3' },
      ans: 'A',
      exp: 'Favorable outcomes are {2, 4, 6} out of 6 total possibilities: 3/6 = 1/2.'
    },
    {
      q: 'Which graphical representation displays continuous frequency distributions using adjacent rectangular bars?',
      options: { A: 'Histogram', B: 'Bar Chart', C: 'Pie Chart', D: 'Scatter Plot' },
      ans: 'A',
      exp: 'A histogram shows continuous data divided into class intervals with touching bars whose areas represent frequencies.'
    },
    {
      q: 'What is the value of the median for the sorted data set: 4, 7, 9, 12, 15, 18, 22?',
      options: { A: '12', B: '9', C: '15', D: '13' },
      ans: 'A',
      exp: 'For n = 7 odd items, the median is the (7 + 1)/2 = 4th observation, which is 12.'
    },
    {
      q: 'What is the Null Hypothesis (H0) in standard statistical hypothesis testing?',
      options: { A: 'A statement of no effect or no difference between parameters', B: 'The hypothesis the researcher wants to prove', C: 'A biased assumption', D: 'An alternative explanation' },
      ans: 'A',
      exp: 'The null hypothesis posits no significant difference or relationship until empirical evidence rejects it.'
    },
    {
      q: 'If two events A and B are mutually exclusive, what is P(A and B)?',
      options: { A: '0', B: 'P(A) * P(B)', C: 'P(A) + P(B)', D: '1' },
      ans: 'A',
      exp: 'Mutually exclusive events cannot occur simultaneously, meaning their intersection P(A and B) is exactly 0.'
    },
    {
      q: 'What is the difference between the third quartile (Q3) and the first quartile (Q1) called?',
      options: { A: 'Interquartile Range (IQR)', B: 'Semi-interquartile range', C: 'Mean Deviation', D: 'Coefficient of variation' },
      ans: 'A',
      exp: 'The Interquartile Range is calculated as IQR = Q3 - Q1, measuring the middle 50% spread of data.'
    }
  ],

  // 13. PRINCIPLES OF PROGRAMMING & ALGORITHMS (PPA)
  ppa: [
    {
      q: 'Which flowchart symbol is standardly used to depict a conditional decision branching?',
      options: { A: 'Diamond', B: 'Rectangle', C: 'Parallelogram', D: 'Oval' },
      ans: 'A',
      exp: 'A diamond shape represents decision-making (True/False or Yes/No conditional branching) in standard ANSI flowcharts.'
    },
    {
      q: 'Which of the following is a mandatory characteristic of a valid algorithm?',
      options: { A: 'Finiteness (must terminate after a finite number of steps)', B: 'Must contain at least 100 lines', C: 'Must be written in C language', D: 'Must not take any input' },
      ans: 'A',
      exp: 'As defined by Donald Knuth, algorithms must satisfy Finiteness, Definiteness, Input, Output, and Effectiveness.'
    },
    {
      q: 'What is the prerequisite condition for executing Binary Search on a collection of elements?',
      options: { A: 'The elements must be sorted in ascending or descending order', B: 'The collection must be a linked list', C: 'Elements must be positive integers', D: 'The size must be a power of 2' },
      ans: 'A',
      exp: 'Binary search requires sorted data to repeatedly divide the search interval in half with O(log n) efficiency.'
    },
    {
      q: 'What occurs if a recursive function does not include a proper base condition?',
      options: { A: 'Infinite recursion causing a Stack Overflow error', B: 'Compile time syntax error', C: 'Memory leak in heap space', D: 'Automatic termination with 0' },
      ans: 'A',
      exp: 'Without a terminating base case, recursive calls keep pushing frames onto the call stack until memory is exhausted.'
    },
    {
      q: 'What does Big-O notation O(1) indicate regarding time complexity?',
      options: { A: 'Constant time complexity regardless of input size', B: 'Linear time complexity', C: 'Slowest possible time', D: 'One second execution time' },
      ans: 'A',
      exp: 'O(1) signifies constant time: the execution duration remains invariant regardless of how large the input grows.'
    },
    {
      q: 'Which flowchart symbol is used to represent Input and Output operations?',
      options: { A: 'Parallelogram', B: 'Rectangle', C: 'Circle', D: 'Triangle' },
      ans: 'A',
      exp: 'A parallelogram represents input (READ) and output (PRINT/DISPLAY) operations in flowcharts.'
    },
    {
      q: 'In structured programming, what are the three foundational control structures?',
      options: { A: 'Sequence, Selection, and Iteration', B: 'Functions, Classes, and Objects', C: 'Pointers, Arrays, and Files', D: 'Input, Process, and Output' },
      ans: 'A',
      exp: 'Bohm-Jacopini theorem proves that any computable algorithm can be written using Sequence, Selection (if-else), and Iteration (loops).'
    },
    {
      q: 'What is the purpose of dry running (tracing) an algorithm manually on paper?',
      options: { A: 'To verify algorithm logic and step-by-step variable values before coding', B: 'To test hardware speed', C: 'To generate compiler binary', D: 'To format source comments' },
      ans: 'A',
      exp: 'Dry running involves tracing program execution on sample inputs using a trace table to locate conceptual and logic flaws.'
    },
    {
      q: 'What is the average and worst-case time complexity of Linear Search on an array of size n?',
      options: { A: 'O(n)', B: 'O(log n)', C: 'O(1)', D: 'O(n^2)' },
      ans: 'A',
      exp: 'Linear search inspects items sequentially from index 0 to n-1, taking linear O(n) comparisons in the worst case.'
    },
    {
      q: 'What is the scope of a local variable declared inside a block or function?',
      options: { A: 'Accessible only within that enclosing block or function', B: 'Accessible throughout the entire program', C: 'Stored permanently in secondary disk', D: 'Shared across all processes' },
      ans: 'A',
      exp: 'Local variables possess block scope and automatic storage duration; they are created on block entry and destroyed on exit.'
    },
    {
      q: 'Which programming paradigm emphasizes breaking down a problem into a hierarchy of smaller sub-functions (Top-Down Design)?',
      options: { A: 'Structured / Modular Programming', B: 'Object-Oriented Programming', C: 'Logic Programming', D: 'Event-Driven Programming' },
      ans: 'A',
      exp: 'Top-down modular decomposition partitions complex algorithms into manageable modules and functions.'
    },
    {
      q: 'What is pseudocode?',
      options: { A: 'An informal, high-level English-like description of algorithm steps', B: 'Compiled machine bytecode', C: 'Assembly mnemonic instructions', D: 'A proprietary programming language' },
      ans: 'A',
      exp: 'Pseudocode expresses programmatic algorithm logic in structured human-readable language without language-specific syntax.'
    }
  ],

  // 14. PROFESSIONAL COMMUNICATION & ENGLISH PROFICIENCY
  professional_communication: [
    {
      q: 'Which of the following is considered one of the essential "7 Cs" of effective communication?',
      options: { A: 'Conciseness', B: 'Complexity', C: 'Confusion', D: 'Casualness' },
      ans: 'A',
      exp: 'The 7 Cs of communication are: Clear, Concise, Concrete, Correct, Coherent, Complete, and Courteous.'
    },
    {
      q: 'What does Kinesics study in non-verbal communication?',
      options: { A: 'Body language, gestures, and facial expressions', B: 'Voice pitch and tone', C: 'Physical distance between speakers', D: 'Written punctuation' },
      ans: 'A',
      exp: 'Kinesics is the study of communication through body movement, postures, facial expressions, and eye contact.'
    },
    {
      q: 'In professional email etiquette, what does "BCC" stand for?',
      options: { A: 'Blind Carbon Copy', B: 'Business Client Contact', C: 'Broadcast Communication Copy', D: 'Backup Carbon Code' },
      ans: 'A',
      exp: 'Blind Carbon Copy (BCC) delivers copies to recipients without revealing their email addresses to other parties.'
    },
    {
      q: 'Which communication barrier occurs due to differing interpretations of words, symbols, or technical jargon?',
      options: { A: 'Semantic Barrier', B: 'Physical Barrier', C: 'Psychological Barrier', D: 'Physiological Barrier' },
      ans: 'A',
      exp: 'Semantic barriers arise when words, acronyms, or symbols convey ambiguous or unintended meanings to the receiver.'
    },
    {
      q: 'What is the primary difference between Active Listening and Passive Hearing?',
      options: { A: 'Active listening involves conscious mental effort, comprehension, and feedback; hearing is merely physiological sound perception', B: 'Hearing is interactive; listening is passive', C: 'Active listening is only used in formal debates', D: 'Hearing requires recording devices' },
      ans: 'A',
      exp: 'Hearing is the physical perception of sound; active listening demands intentional focus, understanding, and responsive evaluation.'
    },
    {
      q: 'Which reading strategy is used to quickly glance through a document to locate a specific date or name?',
      options: { A: 'Scanning', B: 'Skimming', C: 'Extensive Reading', D: 'Critical Analysis' },
      ans: 'A',
      exp: 'Scanning is rapid reading focused on searching for a specific keyword, date, or piece of information.'
    },
    {
      q: 'What is the study of personal physical space and distance in interpersonal communication called?',
      options: { A: 'Proxemics', B: 'Chronemics', C: 'Haptics', D: 'Phonetics' },
      ans: 'A',
      exp: 'Proxemics (coined by Edward T. Hall) explores how humans use personal space and territorial boundaries in communication.'
    },
    {
      q: 'Choose the grammatically correct sentence with proper subject-verb agreement:',
      options: { A: 'Each of the students has submitted their assignment.', B: 'Each of the students have submitted their assignment.', C: 'Each of the students are submitting.', D: 'Each of the students were submitted.' },
      ans: 'A',
      exp: '"Each" is an indefinite singular pronoun requiring the singular verb "has submitted".'
    },
    {
      q: 'In formal business report writing, which section provides a high-level summary of the entire document for busy executives?',
      options: { A: 'Executive Summary', B: 'Appendix', C: 'Bibliography', D: 'Glossary' },
      ans: 'A',
      exp: 'The Executive Summary synthesizes key findings, methodologies, conclusions, and recommendations concisely.'
    },
    {
      q: 'Which vocal characteristics constitute "Paralanguage"?',
      options: { A: 'Voice tone, pitch, volume, speed, and pauses', B: 'Word definitions', C: 'Hand gestures', D: 'Spelling rules' },
      ans: 'A',
      exp: 'Paralanguage encompasses non-verbal vocal cues that accompany speech, including intonation, tempo, and volume.'
    },
    {
      q: 'What is the official written record of discussions and decisions taken during a formal meeting called?',
      options: { A: 'Minutes of the Meeting (MoM)', B: 'Notice', C: 'Agenda', D: 'Memorandum' },
      ans: 'A',
      exp: 'Meeting Minutes (MoM) record attendees, agenda items discussed, voting results, and actionable task assignments.'
    },
    {
      q: 'Which style of communication expresses thoughts and feelings honestly and respectfully without being aggressive or passive?',
      options: { A: 'Assertive Communication', B: 'Aggressive Communication', C: 'Passive-Aggressive Communication', D: 'Authoritarian Communication' },
      ans: 'A',
      exp: 'Assertive communication upholds personal boundaries and rights while showing mutual respect for others\' perspectives.'
    }
  ],

  // 15. DATA COMMUNICATION
  data_communication: [
    {
      q: 'In which transmission mode can data travel in both directions simultaneously at the same time?',
      options: { A: 'Full-Duplex', B: 'Half-Duplex', C: 'Simplex', D: 'Multiplex' },
      ans: 'A',
      exp: 'Full-duplex allows concurrent bidirectional transmission (like a modern telephone call or Ethernet connection).'
    },
    {
      q: 'Which physical transmission medium transmits data as light pulses using total internal reflection?',
      options: { A: 'Fiber Optic Cable', B: 'Coaxial Cable', C: 'Unshielded Twisted Pair (UTP)', D: 'Microwave Link' },
      ans: 'A',
      exp: 'Optical fibers propagate modulated light signals through glass or plastic cores utilizing total internal reflection.'
    },
    {
      q: 'What is the difference between Bit Rate and Baud Rate in data transmission?',
      options: { A: 'Bit rate is the number of bits sent per second; baud rate is the number of signal state changes per second', B: 'They are always numerically identical', C: 'Baud rate is measured in Hertz', D: 'Bit rate is only for analog signals' },
      ans: 'A',
      exp: 'Bit rate (bps) = Baud rate * bits per signal element. Multiple bits can be encoded per single baud signal change.'
    },
    {
      q: 'Which modulation technique alters the frequency of the carrier wave in accordance with the message signal?',
      options: { A: 'Frequency Modulation (FM)', B: 'Amplitude Modulation (AM)', C: 'Phase Modulation (PM)', D: 'Pulse Code Modulation (PCM)' },
      ans: 'A',
      exp: 'FM varies the carrier frequency proportionally with the amplitude of the baseband modulating signal.'
    },
    {
      q: 'Which multiplexing technique divides the available frequency bandwidth into distinct separate channels for concurrent users?',
      options: { A: 'FDM (Frequency Division Multiplexing)', B: 'TDM (Time Division Multiplexing)', C: 'WDM', D: 'CDM' },
      ans: 'A',
      exp: 'FDM allocates different frequency bands to multiple channels simultaneously over a wide-bandwidth medium.'
    },
    {
      q: 'What type of error detection technique uses polynomial division and appends a checksum to the transmitted frame?',
      options: { A: 'CRC (Cyclic Redundancy Check)', B: 'Parity Bit Check', C: 'Checksum addition', D: 'Hamming Code' },
      ans: 'A',
      exp: 'CRC computes a remainder via binary modulo-2 polynomial division and appends it to data for burst error detection.'
    },
    {
      q: 'What causes the gradual loss of signal strength as an electromagnetic wave travels through a transmission medium?',
      options: { A: 'Attenuation', B: 'Distortion', C: 'Thermal Noise', D: 'Crosstalk' },
      ans: 'A',
      exp: 'Attenuation is the reduction in signal amplitude and power over distance, often countered using amplifiers or repeaters.'
    },
    {
      q: 'In asynchronous serial transmission, how is the beginning and end of each character byte identified?',
      options: { A: 'Using Start and Stop bits', B: 'Using shared external clock lines', C: 'Using parity bytes', D: 'Using token frames' },
      ans: 'A',
      exp: 'Asynchronous transmission frames each byte with a preceding 0 start bit and one or two 1 stop bits.'
    },
    {
      q: 'According to Nyquist theorem, what is the maximum data rate for a noiseless channel with bandwidth B and M discrete signal levels?',
      options: { A: '2 * B * log2(M)', B: 'B * log2(1 + SNR)', C: 'B / M', D: '4 * B * M' },
      ans: 'A',
      exp: 'Nyquist\'s bit rate formula states C = 2 * B * log2(M) bits/sec for a completely noiseless transmission channel.'
    },
    {
      q: 'Why are wire pairs twisted together in UTP (Unshielded Twisted Pair) cables?',
      options: { A: 'To reduce electromagnetic interference (EMI) and crosstalk between adjacent pairs', B: 'To increase cable tensile strength', C: 'To increase electrical resistance', D: 'To allow higher voltage' },
      ans: 'A',
      exp: 'Twisting causes external magnetic fields to induce equal and opposite canceling currents in the pair, neutralizing noise.'
    },
    {
      q: 'What is the primary function of a modem in computer networking?',
      options: { A: 'Modulation (digital to analog) and Demodulation (analog to digital)', B: 'Routing packets across subnets', C: 'Packet filtering firewall', D: 'Encrypting data payload' },
      ans: 'A',
      exp: 'A modem (MOdulator-DEModulator) converts digital computer signals into analog transmission signals and vice versa.'
    },
    {
      q: 'In Time Division Multiplexing (TDM), how is channel bandwidth shared among multiple senders?',
      options: { A: 'Each sender is allocated a dedicated time slot in round-robin fashion', B: 'Different frequencies are assigned', C: 'Different light wavelengths are used', D: 'Only one user transmits forever' },
      ans: 'A',
      exp: 'TDM allocates the entire channel bandwidth to each connected user for a predetermined, recurring time slice.'
    }
  ],

  // 16. INTERNET OF THINGS (IOT)
  iot: [
    {
      q: 'What is the lightweight publish/subscribe messaging protocol designed specifically for resource-constrained IoT devices?',
      options: { A: 'MQTT (Message Queuing Telemetry Transport)', B: 'HTTP 1.1', C: 'FTP', D: 'SMTP' },
      ans: 'A',
      exp: 'MQTT is an ISO standard (ISO/IEC 20922) pub/sub protocol with minimal packet headers and low bandwidth requirements.'
    },
    {
      q: 'What is the primary function of an "Actuator" in an IoT system?',
      options: { A: 'Converts electrical control signals into physical movement or action', B: 'Measures ambient temperature', C: 'Assigns IP addresses', D: 'Transmits wireless packets' },
      ans: 'A',
      exp: 'Sensors convert physical parameters into electrical signals; Actuators convert electrical signals into physical action (e.g. motors, valves).'
    },
    {
      q: 'Which wireless networking standard forms the foundation for Zigbee networks?',
      options: { A: 'IEEE 802.15.4', B: 'IEEE 802.11', C: 'IEEE 802.3', D: 'IEEE 802.16' },
      ans: 'A',
      exp: 'Zigbee builds on the IEEE 802.15.4 physical and MAC layer standard for low-rate wireless personal area networks (LR-WPANs).'
    },
    {
      q: 'What protocol enables IPv6 packets to be transmitted over resource-constrained IEEE 802.15.4 wireless networks?',
      options: { A: '6LoWPAN', B: 'DHCPv6', C: 'BGP', D: 'OSPF' },
      ans: 'A',
      exp: '6LoWPAN (IPv6 over Low-Power Wireless Personal Area Networks) implements header compression to fit IPv6 into tiny IoT frames.'
    },
    {
      q: 'What is the role of Edge Computing in an IoT ecosystem?',
      options: { A: 'Processes sensor data locally near the data source to minimize latency and bandwidth', B: 'Replaces cloud data centers completely', C: 'Generates power for sensors', D: 'Encrypts Wi-Fi passwords' },
      ans: 'A',
      exp: 'Edge computing performs filtering, analytics, and instant decisions near device gateways rather than shipping all raw telemetry to cloud.'
    },
    {
      q: 'Which transport layer protocol does CoAP (Constrained Application Protocol) utilize by default?',
      options: { A: 'UDP', B: 'TCP', C: 'SCTP', D: 'TLS' },
      ans: 'A',
      exp: 'CoAP is designed for constrained web devices and runs over UDP to avoid TCP handshake overhead, using Datagram TLS (DTLS) for security.'
    },
    {
      q: 'What are the four architectural layers of a standard IoT model?',
      options: { A: 'Perception, Network, Middleware (Processing), and Application', B: 'Physical, Data Link, Network, Transport', C: 'Client, Server, Database, Cache', D: 'Input, Output, Memory, CPU' },
      ans: 'A',
      exp: 'Standard IoT architecture comprises Perception (sensors), Network (transmission), Middleware (analytics), and Application layers.'
    },
    {
      q: 'Which technology uses radio waves for contactless automatic identification and data capture of tagged physical objects?',
      options: { A: 'RFID (Radio Frequency Identification)', B: 'GPS', C: 'Ethernet', D: 'DSL' },
      ans: 'A',
      exp: 'RFID utilizes electromagnetic fields to automatically identify and read tracking tags attached to objects without line of sight.'
    },
    {
      q: 'In MQTT architecture, what central entity receives all published messages and routes them to subscribed clients?',
      options: { A: 'MQTT Broker', B: 'Gateway Router', C: 'DNS Server', D: 'Reverse Proxy' },
      ans: 'A',
      exp: 'The MQTT Broker filters incoming topic messages from publishers and routes them to all clients subscribed to that specific topic.'
    },
    {
      q: 'Which low-power Bluetooth technology is designed for IoT devices that broadcast short data bursts while consuming minimal battery power?',
      options: { A: 'BLE (Bluetooth Low Energy)', B: 'Bluetooth Classic', C: 'Infrared IrDA', D: 'NFC' },
      ans: 'A',
      exp: 'Bluetooth Low Energy (BLE / Bluetooth Smart) operates on coin-cell batteries for months or years by remaining asleep between bursts.'
    },
    {
      q: 'What popular microcontroller board equipped with built-in Wi-Fi and Bluetooth is widely used in student IoT hardware projects?',
      options: { A: 'ESP32 / ESP8266', B: '8085 Microprocessor', C: 'Intel Core i3', D: 'PCIe Card' },
      ans: 'A',
      exp: 'Espressif\'s ESP32 is a low-cost, dual-core SoC with integrated Wi-Fi and Bluetooth, ubiquitous in modern IoT embedded designs.'
    },
    {
      q: 'What is a major security challenge unique to mass deployment of IoT devices?',
      options: { A: 'Hardcoded default credentials, lack of encrypted updates, and limited hardware computing power for heavy cryptography', B: 'Excessive memory sizes', C: 'Too high network bandwidth', D: 'Inability to connect to power' },
      ans: 'A',
      exp: 'Resource constraints on tiny microcontrollers make running heavy crypto ciphers difficult, leaving devices vulnerable if default credentials are kept.'
    }
  ]
};

/**
 * Match subject to appropriate verified bank with strict zero-leakage guards
 */
function getSubjectBank(subject) {
  const norm = String(subject || '').toLowerCase().trim();
  if (!norm) return null;

  // 1. C Programming (Strict match, avoiding C++ or C#)
  if (/^c\s+programming\b|\bprogramming in c\b|^c\s+language\b|\bc\s*program/.test(norm) || norm === 'c') {
    return VERIFIED_SUBJECT_BANKS.c_programming;
  }

  // 2. CFOA (Computer Fundamentals and Office Automation)
  if (/\bcfoa\b|computer fundamentals|office automation/.test(norm)) {
    return VERIFIED_SUBJECT_BANKS.cfoa;
  }

  // 3. Elements of Statistics
  if (/statistics|\bstat\b|\bstats\b|probability/.test(norm)) {
    return VERIFIED_SUBJECT_BANKS.statistics;
  }

  // 4. PPA (Principles of Programming & Algorithms)
  if (/\bppa\b|principles of programming|programming principles/.test(norm)) {
    return VERIFIED_SUBJECT_BANKS.ppa;
  }

  // 5. Data Communication (Checked before generic communication)
  if (/data communication/.test(norm)) {
    return VERIFIED_SUBJECT_BANKS.data_communication;
  }

  // 6. Professional Communication & English
  if (/professional communication|business communication|\bcommunication skills\b|\benglish\b|proficiency/.test(norm)) {
    return VERIFIED_SUBJECT_BANKS.professional_communication;
  }

  // 7. Data Structures using C
  if (/data structure|\bdsa\b|\bstack\b|\btree\b|\bqueue\b|\blinked list\b/.test(norm)) {
    return VERIFIED_SUBJECT_BANKS.data_structures;
  }

  // 8. DBMS / Database
  if (/\bdbms\b|database|\bsql\b/.test(norm)) {
    return VERIFIED_SUBJECT_BANKS.dbms;
  }

  // 9. Discrete Mathematics
  if (/discrete/.test(norm)) {
    return VERIFIED_SUBJECT_BANKS.discrete_mathematics;
  }

  // 10. Operating System / Operating Systems
  if (/operating system|\bos\b|\blinux\b|\bunix\b/.test(norm)) {
    return VERIFIED_SUBJECT_BANKS.operating_systems;
  }

  // 11. IOT (Internet of Things)
  if (/\biot\b|internet of things/.test(norm)) {
    return VERIFIED_SUBJECT_BANKS.iot;
  }

  // 12. Java Programming
  if (/\bjava\b/.test(norm)) {
    return VERIFIED_SUBJECT_BANKS.java_programming;
  }

  // 13. Software Engineering (Strict word match: never match 'English'!)
  if (/software engineering|\bsdlc\b|\bsoftware testing\b|\bagile\b/.test(norm)) {
    return VERIFIED_SUBJECT_BANKS.software_engineering;
  }

  // 14. Web Technologies
  if (/web technolog|\bhtml\b|\bcss\b|\bjavascript\b|\bphp\b/.test(norm)) {
    return VERIFIED_SUBJECT_BANKS.web_technologies;
  }

  // 15. Computer Networks
  if (/computer network|\bnetworking\b|\btcp\b/.test(norm)) {
    return VERIFIED_SUBJECT_BANKS.computer_networks;
  }

  // 16. Digital Electronics
  if (/digital electronics|logic gates|\bk-map\b|flip-flop/.test(norm)) {
    return VERIFIED_SUBJECT_BANKS.digital_electronics;
  }

  // NO MATCH: ZERO LEAKAGE! Never fallback to software engineering for another subject.
  return null;
}

/**
 * Generate fallback questions with 100% subject purity
 */
function generateCurriculumFallback(subject, semester, count = 10, difficulty = 'medium') {
  const bank = getSubjectBank(subject);
  if (!bank || !bank.length) {
    return null;
  }
  
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
  const fallbackQuestions = generateCurriculumFallback(subject, semNum, count, difficulty);
  if (fallbackQuestions && fallbackQuestions.length >= 3) {
    console.info(`[AI Generator] External providers unavailable. Serving verified curriculum questions strictly for "${subject}" (Sem ${semNum})`);
    return {
      questions: fallbackQuestions.slice(0, count),
      provider: 'curriculum-engine',
      model: 'bca-standard-v1',
      tier: 'curriculum_fallback'
    };
  }

  // STRICT REQUIREMENT: If questions for this subject are unavailable, NEVER substitute another subject's questions!
  const notAvailErr = new Error(`Is subject (${subject}) ke questions abhi available nahi hain.`);
  notAvailErr.code = 'questions_unavailable';
  throw notAvailErr;
}

module.exports = {
  generateAiQuiz,
  BCA_CURRICULUM,
  generateCurriculumFallback
};
