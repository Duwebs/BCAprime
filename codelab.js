/**
 * BCAPrime PrimeCode IDE (codelab.js)
 * Clean, Mobile-First IDE Architecture with 8 Languages, Multi-File HTML,
 * ASCII Table MySQL Engine, Piston/Wandbox Compilers & Custom Stdin Input.
 */

(function () {
  'use strict';

  // ---- Language Configuration ----
  const LANG_CONFIG = {
    python: { name: 'Python', filename: 'main.py', ext: 'py', type: 'compiler', version: 'Python 3.10' },
    java: { name: 'Java', filename: 'Main.java', ext: 'java', type: 'compiler', version: 'Java 21' },
    c: { name: 'C', filename: 'main.c', ext: 'c', type: 'compiler', version: 'GCC 13' },
    cpp: { name: 'C++', filename: 'main.cpp', ext: 'cpp', type: 'compiler', version: 'G++ 13' },
    php: { name: 'PHP', filename: 'index.php', ext: 'php', type: 'compiler', version: 'PHP 8.3' },
    mysql: { name: 'MySQL', filename: 'queries.sql', ext: 'sql', type: 'sql', version: 'MySQL / SQLite 3' },
    html: { name: 'HTML', filename: 'index.html', ext: 'html', type: 'webdev', version: 'HTML5 & CSS3 & JS' },
    javascript: { name: 'JavaScript', filename: 'index.js', ext: 'js', type: 'compiler', version: 'Node.js 20' }
  };

  // ---- Starter Templates ----
  const STARTERS = {
    c: `#include <stdio.h>

int main() {
    printf("Welcome to BCAPrime C Lab! 🚀\\n");
    printf("BCA C Programming Sandbox\\n\\n");
    
    // Sample calculation
    int a = 15, b = 27;
    int sum = a + b;
    printf("Sum of %d and %d is: %d\\n", a, b, sum);
    
    return 0;
}`,
    cpp: `#include <iostream>
#include <vector>
#include <numeric>

using namespace std;

int main() {
    cout << "Welcome to BCAPrime C++ Lab! ⚡\\n";
    
    vector<int> marks = {85, 92, 78, 88, 95};
    int total = accumulate(marks.begin(), marks.end(), 0);
    double avg = (double)total / marks.size();
    
    cout << "Total Marks: " << total << endl;
    cout << "Semester Average: " << avg << "%" << endl;
    
    return 0;
}`,
    java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        System.out.println("Welcome to BCAPrime Java Lab! ☕");
        System.out.println("Object-Oriented Programming for BCA");
        
        String[] subjects = {"Data Structures", "DBMS", "Java OOP", "Computer Networks"};
        System.out.println("\\nCore BCA Subjects:");
        for (int i = 0; i < subjects.length; i++) {
            System.out.println((i + 1) + ". " + subjects[i]);
        }
    }
}`,
    python: `# BCAPrime Python Lab 🐍
def bca_grade_calc(marks):
    avg = sum(marks) / len(marks)
    return avg, "First Class with Distinction" if avg >= 75 else "First Class"

scores = [88, 92, 79, 85, 91]
average, grade = bca_grade_calc(scores)

print("BCAPrime Academic Evaluation:")
print(f"Scores: {scores}")
print(f"Semester Average: {average:.1f}%")
print(f"Award: {grade} 🏆")
`,
    php: `<?php
// BCAPrime PHP Lab 🐘
echo "Welcome to BCAPrime PHP Lab! 🚀\\n";
echo "Server-Side Scripting & Logic for BCA\\n\\n";

$students = [
    ["name" => "Aarav Sharma", "semester" => 3, "score" => 92],
    ["name" => "Priya Patel", "semester" => 3, "score" => 95],
    ["name" => "Rohan Verma", "semester" => 3, "score" => 84]
];

echo "BCA Top Performers:\\n";
foreach ($students as $index => $s) {
    echo ($index + 1) . ". " . $s["name"] . " - Sem " . $s["semester"] . " (" . $s["score"] . "%)\\n";
}
?>`,
    javascript: `// BCAPrime JavaScript & Node.js Lab ⚡
console.log("Welcome to BCAPrime JavaScript Lab! 🚀");
console.log("Modern ES6+ & Node.js Runtime for BCA\\n");

const subjects = [
  { code: 'BCA-301', name: 'Data Structures', credits: 4 },
  { code: 'BCA-302', name: 'Database Management', credits: 4 },
  { code: 'BCA-303', name: 'Web Technology', credits: 3 },
  { code: 'BCA-304', name: 'Python Programming', credits: 3 }
];

console.log("Registered Semester Courses:");
subjects.forEach((subj, idx) => {
  console.log((idx + 1) + ". [" + subj.code + "] " + subj.name + " (" + subj.credits + " Credits)");
});

const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0);
console.log("\\nTotal Semester Credits: " + totalCredits);
`,
    html: `<div class="card">
  <h2>BCAPrime Web Lab 🚀</h2>
  <p>Interactive client-side sandbox for HTML5, CSS3 &amp; JavaScript.</p>
  <button id="counterBtn" class="btn">Clicks: <span id="count">0</span></button>
</div>`,
    css: `body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #0f172a;
  color: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  margin: 0;
  padding: 16px;
  box-sizing: border-box;
}
.card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 16px;
  padding: 24px;
  max-width: 360px;
  width: 100%;
  text-align: center;
  box-shadow: 0 10px 25px rgba(0,0,0,0.3);
}
h2 {
  margin: 0 0 8px;
  font-size: 20px;
  color: #38bdf8;
}
p {
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.5;
  margin: 0 0 20px;
}
.btn {
  background: #2563eb;
  color: #fff;
  border: 0;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 9999px;
  cursor: pointer;
  transition: transform 0.15s, background 0.15s;
}
.btn:hover { background: #1d4ed8; }
.btn:active { transform: scale(0.96); }`,
    js: `let count = 0;
const btn = document.getElementById('counterBtn');
const countSpan = document.getElementById('count');
if (btn && countSpan) {
  btn.addEventListener('click', () => {
    count++;
    countSpan.textContent = count;
  });
}`,
    mysql: `-- BCA DBMS Lab: Query Semester 3 students by CGPA
SELECT id, name, semester, email, cgpa 
FROM students 
WHERE semester = 3 
ORDER BY cgpa DESC;`
  };

  // SQLite Schema Seed
  const SQL_SEED = `
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  semester INTEGER,
  email TEXT,
  cgpa REAL
);
INSERT INTO students VALUES
  (101, 'Aarav Sharma', 3, 'aarav@bcaprime.edu', 8.9),
  (102, 'Priya Patel', 3, 'priya@bcaprime.edu', 9.2),
  (103, 'Rohan Verma', 2, 'rohan@bcaprime.edu', 7.8),
  (104, 'Sneha Rao', 4, 'sneha@bcaprime.edu', 9.5),
  (105, 'Vikram Singh', 3, 'vikram@bcaprime.edu', 8.1);

CREATE TABLE courses (
  course_code TEXT PRIMARY KEY,
  course_name TEXT,
  semester INTEGER,
  credits INTEGER
);
INSERT INTO courses VALUES
  ('BCA-301', 'Data Structures & Algorithms', 3, 4),
  ('BCA-302', 'Database Management Systems', 3, 4),
  ('BCA-303', 'Computer Networks', 3, 3),
  ('BCA-304', 'Python Programming', 3, 3);
`;

  // BCA Practical Lab Templates
  const BCA_PRACTICALS = {
    java: [
      {
        name: '1. Hello World (Basic Class)',
        code: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        System.out.println("BCAPrime Java Lab ☕");
    }
}`
      },
      {
        name: '2. User Input & Arithmetic (Scanner)',
        code: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter first number: ");
        int num1 = sc.nextInt();
        System.out.print("Enter second number: ");
        int num2 = sc.nextInt();
        
        int sum = num1 + num2;
        int diff = num1 - num2;
        int prod = num1 * num2;
        
        System.out.println("\\nResults:");
        System.out.println("Sum: " + sum);
        System.out.println("Difference: " + diff);
        System.out.println("Product: " + prod);
        sc.close();
    }
}`
      },
      {
        name: '3. Cafe Java Order System (Interactive CLI)',
        code: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.println("=== Swagat hai Cafe Java Me ===");
        
        while (true) {
            System.out.println("\\n--- Coffee Menu ---");
            System.out.println("1. Espresso      - Rs. 120");
            System.out.println("2. Cappuccino    - Rs. 160");
            System.out.println("3. Cafe Latte    - Rs. 180");
            System.out.println("4. Cold Coffee   - Rs. 150");
            System.out.println("5. Bill Generate Karein & Exit");
            System.out.print("Apni choice enter karein (1-5): ");
            int choice = sc.nextInt();
            
            if (choice == 5) {
                System.out.println("Dhanyawaad! Visit again!");
                break;
            }
            
            String itemName = "";
            double price = 0;
            switch(choice) {
                case 1: itemName = "Espresso"; price = 120; break;
                case 2: itemName = "Cappuccino"; price = 160; break;
                case 3: itemName = "Cafe Latte"; price = 180; break;
                case 4: itemName = "Cold Coffee"; price = 150; break;
                default: System.out.println("Galat choice! Dubara koshish karein."); continue;
            }
            
            System.out.print("Kitne cup " + itemName + " chahiye? ");
            int qty = sc.nextInt();
            
            System.out.print("Extra Whipped Cream / Syrup add karein? (Rs. 30/cup) [1 = Haan, 0 = Nahi]: ");
            int addon = sc.nextInt();
            
            double subtotal = (price + (addon == 1 ? 30 : 0)) * qty;
            System.out.println(qty + " x " + itemName + " order me add ho gaya! (Subtotal: Rs. " + subtotal + ")");
        }
    }
}`
      },
      {
        name: '3. Method Overloading (Polymorphism)',
        code: `public class Main {
    // Area of Circle
    static double area(double radius) {
        return Math.PI * radius * radius;
    }

    // Area of Rectangle
    static double area(double length, double breadth) {
        return length * breadth;
    }

    // Area of Triangle
    static double area(float base, float height) {
        return 0.5 * base * height;
    }

    public static void main(String[] args) {
        System.out.println("--- Method Overloading Demo ---");
        System.out.printf("Area of Circle (r=5.0): %.2f\\n", area(5.0));
        System.out.printf("Area of Rectangle (l=4, b=6): %.2f\\n", area(4.0, 6.0));
        System.out.printf("Area of Triangle (b=3, h=7): %.2f\\n", area(3.0f, 7.0f));
    }
}`
      },
      {
        name: '4. Inheritance (Single & Multilevel)',
        code: `class Person {
    String name = "Aarav Sharma";
    int age = 20;

    void displayPerson() {
        System.out.println("Name: " + name);
        System.out.println("Age: " + age);
    }
}

class Student extends Person {
    String rollNo = "BCA-2024-042";
    int semester = 3;

    void displayStudent() {
        displayPerson();
        System.out.println("Roll Number: " + rollNo);
        System.out.println("Semester: " + semester);
    }
}

public class Main {
    public static void main(String[] args) {
        System.out.println("=== Student Record (Inheritance) ===");
        Student s = new Student();
        s.displayStudent();
    }
}`
      },
      {
        name: '5. Exception Handling (try-catch-finally)',
        code: `public class Main {
    public static void main(String[] args) {
        System.out.println("--- Exception Handling Demo ---");
        try {
            int a = 25;
            int b = 0;
            System.out.println("Attempting division: " + a + " / " + b);
            int result = a / b;
            System.out.println("Result: " + result);
        } catch (ArithmeticException e) {
            System.err.println("Caught Exception: Division by zero is not permitted!");
        } finally {
            System.out.println("Finally block executed cleanly.");
        }
    }
}`
      }
    ],
    python: [
      {
        name: '1. Hello World & Grade Calculator',
        code: `# BCAPrime Python Lab 🐍
def calculate_grade(marks):
    avg = sum(marks) / len(marks)
    if avg >= 75:
        return avg, "First Class with Distinction 🏆"
    elif avg >= 60:
        return avg, "First Class 🌟"
    elif avg >= 50:
        return avg, "Second Class"
    return avg, "Pass"

scores = [88, 92, 79, 85, 91]
average, grade = calculate_grade(scores)

print(f"Student Marks: {scores}")
print(f"Semester Average: {average:.2f}%")
print(f"Academic Standing: {grade}")`
      },
      {
        name: '2. User Input & Palindrome Check',
        code: `# Palindrome Checker
word = input("Enter a string or number: ").strip()
cleaned = word.lower().replace(" ", "")

if cleaned == cleaned[::-1]:
    print(f"'{word}' is a PALINDROME! 🎉")
else:
    print(f"'{word}' is NOT a palindrome.")`
      },
      {
        name: '3. Prime & Fibonacci Generators',
        code: `def is_prime(n):
    if n <= 1:
        return False
    for i in range(2, int(n ** 0.5) + 1):
        if n % i == 0:
            return False
    return True

def fibonacci(count):
    series = [0, 1]
    while len(series) < count:
        series.append(series[-1] + series[-2])
    return series[:count]

print("First 10 Fibonacci Numbers:", fibonacci(10))
primes = [x for x in range(2, 50) if is_prime(x)]
print("Primes under 50:", primes)`
      },
      {
        name: '4. List Comprehension & Dictionary Operations',
        code: `students = [
    {"name": "Aarav", "marks": 85, "sem": 3},
    {"name": "Priya", "marks": 94, "sem": 3},
    {"name": "Rohan", "marks": 72, "sem": 3},
    {"name": "Sneha", "marks": 91, "sem": 3}
]

top_performers = [s["name"] for s in students if s["marks"] >= 85]
avg_marks = sum(s["marks"] for s in students) / len(students)

print("Top Performers (>= 85%):", top_performers)
print(f"Class Average: {avg_marks:.2f}%")`
      }
    ],
    c: [
      {
        name: '1. Hello World & Variables',
        code: `#include <stdio.h>

int main() {
    printf("Welcome to BCAPrime C Lab! 🚀\\n");
    int rollNo = 101;
    char name[] = "Aarav Sharma";
    float cgpa = 8.95;

    printf("Student Info:\\n");
    printf("Roll No: %d\\n", rollNo);
    printf("Name: %s\\n", name);
    printf("CGPA: %.2f\\n", cgpa);

    return 0;
}`
      },
      {
        name: '2. Swap Two Numbers with Pointers',
        code: `#include <stdio.h>

void swap(int *a, int *b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}

int main() {
    int x = 25, y = 80;
    printf("Before swap: x = %d, y = %d\\n", x, y);
    swap(&x, &y);
    printf("After swap:  x = %d, y = %d\\n", x, y);
    return 0;
}`
      },
      {
        name: '3. Dynamic Memory Allocation (malloc)',
        code: `#include <stdio.h>
#include <stdlib.h>

int main() {
    int n = 5;
    int *arr = (int*)malloc(n * sizeof(int));
    if (arr == NULL) {
        printf("Memory allocation failed!\\n");
        return 1;
    }

    printf("Allocated array of size %d:\\n", n);
    for (int i = 0; i < n; i++) {
        arr[i] = (i + 1) * 10;
        printf("arr[%d] = %d\\n", i, arr[i]);
    }

    free(arr);
    printf("Memory freed successfully.\\n");
    return 0;
}`
      }
    ],
    cpp: [
      {
        name: '1. Student Class & Object OOP',
        code: `#include <iostream>
#include <string>
using namespace std;

class Student {
private:
    int id;
    string name;
    double cgpa;

public:
    Student(int i, string n, double c) : id(i), name(n), cgpa(c) {}

    void display() const {
        cout << "ID: " << id << " | Name: " << name << " | CGPA: " << cgpa << endl;
    }
};

int main() {
    cout << "=== BCAPrime C++ OOP Lab ===" << endl;
    Student s1(101, "Aarav Sharma", 8.9);
    Student s2(102, "Priya Patel", 9.2);

    s1.display();
    s2.display();
    return 0;
}`
      },
      {
        name: '2. Vectors & STL Algorithms',
        code: `#include <iostream>
#include <vector>
#include <algorithm>
#include <numeric>

using namespace std;

int main() {
    vector<int> marks = {85, 92, 78, 88, 95};
    cout << "Original marks: ";
    for (int m : marks) cout << m << " ";
    cout << endl;

    sort(marks.begin(), marks.end());
    cout << "Sorted marks: ";
    for (int m : marks) cout << m << " ";
    cout << endl;

    int sum = accumulate(marks.begin(), marks.end(), 0);
    cout << "Average: " << (double)sum / marks.size() << "%" << endl;
    return 0;
}`
      }
    ],
    php: [
      {
        name: '1. Associative Arrays & Looping',
        code: `<?php
$students = [
    ["name" => "Aarav Sharma", "semester" => 3, "score" => 92],
    ["name" => "Priya Patel", "semester" => 3, "score" => 95],
    ["name" => "Rohan Verma", "semester" => 3, "score" => 84]
];

echo "BCA Top Performers:\\n";
foreach ($students as $index => $s) {
    echo ($index + 1) . ". " . $s["name"] . " - Sem " . $s["semester"] . " (" . $s["score"] . "%)\\n";
}
?>`
      },
      {
        name: '2. JSON API Simulator',
        code: `<?php
header('Content-Type: application/json');
$response = [
    "status" => "success",
    "course" => "BCA",
    "semester" => 3,
    "subjects" => ["Data Structures", "DBMS", "Java OOP", "Computer Networks"],
    "timestamp" => time()
];
echo json_encode($response, JSON_PRETTY_PRINT);
?>`
      }
    ],
    mysql: [
      {
        name: '1. Sem 3 Top Students (ORDER BY)',
        code: `-- Query Semester 3 students ranked by CGPA
SELECT id, name, semester, email, cgpa 
FROM students 
WHERE semester = 3 
ORDER BY cgpa DESC;`
      },
      {
        name: '2. Student & Courses JOIN Query',
        code: `-- Join students with matching semester courses
SELECT s.name, s.semester, c.course_code, c.course_name, c.credits
FROM students s
JOIN courses c ON s.semester = c.semester
ORDER BY s.semester, s.name;`
      },
      {
        name: '3. Semester CGPA Aggregation (GROUP BY)',
        code: `-- Calculate student count and average CGPA per semester
SELECT semester, COUNT(*) AS student_count, ROUND(AVG(cgpa), 2) AS avg_cgpa
FROM students
GROUP BY semester
ORDER BY semester;`
      }
    ],
    html: [
      {
        name: '1. Responsive Student Card Component',
        code: `<div class="card">
  <h2>BCAPrime Web Lab 🚀</h2>
  <p>Interactive client-side sandbox for HTML5, CSS3 &amp; JavaScript.</p>
  <button id="counterBtn" class="btn">Clicks: <span id="count">0</span></button>
</div>`
      }
    ],
    javascript: [
      {
        name: '1. Array Methods (map, filter, reduce)',
        code: `const students = [
  { name: 'Aarav', cgpa: 8.9, sem: 3 },
  { name: 'Priya', cgpa: 9.2, sem: 3 },
  { name: 'Rohan', cgpa: 7.8, sem: 2 },
  { name: 'Sneha', cgpa: 9.5, sem: 4 }
];

const sem3HighPerformers = students
  .filter(s => s.sem === 3 && s.cgpa >= 8.5)
  .map(s => s.name + " (" + s.cgpa + " CGPA)");

console.log("Sem 3 High Performers:", sem3HighPerformers);

const avgCgpa = (students.reduce((sum, s) => sum + s.cgpa, 0) / students.length).toFixed(2);
console.log("Overall Average CGPA:", avgCgpa);`
      },
      {
        name: '2. Async/Await & Promise Simulation',
        code: `function fetchCourseData() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        program: "Bachelor of Computer Applications (BCA)",
        semester: 3,
        status: "Active",
        creditsCompleted: 44
      });
    }, 400);
  });
}

async function loadDashboard() {
  console.log("Fetching academic dashboard...");
  const data = await fetchCourseData();
  console.log("Dashboard Loaded Successfully: 🎉");
  console.log(JSON.stringify(data, null, 2));
}

loadDashboard();`
      }
    ]
  };

  // ---- PrimeCode State ----
  const state = {
    screen: 'splash', // 'splash' | 'picker' | 'workspace'
    showParentBrand: true,
    splashTimer: null,
    activeLang: 'java', // 'python' | 'java' | 'c' | 'cpp' | 'php' | 'mysql' | 'html' | 'javascript'
    activeTab: 'code', // 'code' | 'console' | 'io' | 'preview'
    activeWebFile: 'html', // 'html' | 'css' | 'js'
    fontSize: '13.5px', // '13.5px' | '15px' | '18px'
    isExecuting: false,
    stdinWarnedOnce: false,
    sqlDb: null,
    sqlJsLoading: false,
    cmInitialized: false,
    consoleStateByLang: {}
  };

  // ---- CodeMirror 6 Bridge Helpers ----
  function syncCodeMirror(langKey, code) {
    const mountEl = document.getElementById('primecodeCodeMirrorMount');
    const editor = document.getElementById('primecodeEditor');
    const lineNumbers = document.getElementById('primecodeLineNumbers');

    if (window.PrimeCodeMirror && window.PrimeCodeMirror.isReady && mountEl) {
      if (!state.cmInitialized) {
        if (editor) editor.style.display = 'none';
        if (lineNumbers) lineNumbers.style.display = 'none';
        mountEl.style.display = 'flex';

        window.PrimeCodeMirror.createEditor(
          mountEl,
          code,
          langKey,
          state.fontSize,
          (newCode) => {
            const activeKey = state.activeLang === 'html' ? state.activeWebFile : state.activeLang;
            saveCode(activeKey, newCode);
            if (editor) editor.value = newCode;
          }
        );
        state.cmInitialized = true;
      } else {
        if (editor) editor.style.display = 'none';
        if (lineNumbers) lineNumbers.style.display = 'none';
        mountEl.style.display = 'flex';
        window.PrimeCodeMirror.setLanguage(langKey);
        window.PrimeCodeMirror.setCode(code);
      }
    } else {
      // Fallback: If CodeMirror is still loading or unavailable, ensure native textarea is active
      if (mountEl) mountEl.style.display = 'none';
      if (editor) editor.style.display = 'block';
      if (lineNumbers) lineNumbers.style.display = 'block';
    }
  }

  function saveConsoleState(langKey) {
    if (!langKey) return;
    if (!state.consoleStateByLang) state.consoleStateByLang = {};
    const consolePre = document.getElementById('primecodeConsolePre');
    const consoleBadge = document.getElementById('primecodeConsoleStatusBadge');
    const consoleStatusText = document.getElementById('primecodeConsoleStatusText');
    state.consoleStateByLang[langKey] = {
      hasRun: true,
      outputHtml: consolePre ? consolePre.innerHTML : '',
      badgeVisible: consoleBadge ? (consoleBadge.style.display !== 'none') : false,
      badgeClass: consoleBadge ? consoleBadge.className : '',
      badgeText: consoleStatusText ? consoleStatusText.innerHTML : ''
    };
  }

  function getActiveCode() {
    if (window.PrimeCodeMirror && window.PrimeCodeMirror.isReady && state.cmInitialized) {
      return window.PrimeCodeMirror.getCode();
    }
    const editor = document.getElementById('primecodeEditor');
    return editor ? editor.value : '';
  }

  function setActiveCode(code, lang = state.activeLang) {
    const editor = document.getElementById('primecodeEditor');
    if (editor) {
      editor.value = code;
      const lineNumbers = document.getElementById('primecodeLineNumbers');
      if (lineNumbers) updateLineNumbers(editor, lineNumbers);
    }
    if (window.PrimeCodeMirror && window.PrimeCodeMirror.isReady && state.cmInitialized) {
      window.PrimeCodeMirror.setCode(code);
      if (lang) window.PrimeCodeMirror.setLanguage(lang);
    }
  }

  // ---- Haptics & Notification ----
  function triggerHaptic(duration = 10) {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(duration);
      }
    } catch (e) {}
  }

  function notify(msg, type = 'info') {
    if (window.BCA_UI && window.BCA_UI.Toast) {
      if (type === 'success') window.BCA_UI.Toast.success(msg);
      else if (type === 'error') window.BCA_UI.Toast.error(msg);
      else window.BCA_UI.Toast.show(msg);
    } else if (typeof window.toast === 'function') {
      window.toast(msg);
    } else {
      console.log('[PrimeCode]', msg);
    }
  }

  // ---- LocalStorage Helpers ----
  function storageKey(id) {
    return `bcaprime_codelab_${id}`;
  }

  function getSavedCode(key) {
    try {
      const saved = localStorage.getItem(storageKey(key));
      if (saved !== null && saved !== undefined) return saved;
    } catch (e) {}
    return STARTERS[key] || '';
  }

  function saveCode(key, code) {
    try {
      localStorage.setItem(storageKey(key), code);
    } catch (e) {}
  }

  // Mascot Controller (Strictly hides PrimeBuddy during 2.2s splash only)
  function setPrimeBuddyVisible(visible) {
    const buddySelectors = [
      '#primeBuddyMascot',
      '.prime-buddy-wrap',
      '#primeBuddy',
      '#buddyActionPill',
      '#buddyFocusPopup',
      '.prime-buddy-bubble'
    ];
    buddySelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (visible) {
          el.style.removeProperty('display');
          el.style.removeProperty('visibility');
          el.style.removeProperty('opacity');
          el.style.removeProperty('pointer-events');
        } else {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('opacity', '0', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
        }
      });
    });
    if (visible && window.PrimeBuddy) {
      try {
        window.PrimeBuddy.checkNavigationState?.();
      } catch (_e) {}
    }
  }

  // ---- Screen Navigation (Splash -> Picker -> Workspace) ----
  function switchScreen(screen) {
    state.screen = screen;
    const splashEl = document.getElementById('primecodeSplash');
    const pickerEl = document.getElementById('primecodePicker');
    const workspaceEl = document.getElementById('primecodeWorkspace');

    if (state.splashTimer) {
      clearTimeout(state.splashTimer);
      state.splashTimer = null;
    }

    if (screen === 'splash') {
      document.body.classList.add('primecode-splash-active');
      setPrimeBuddyVisible(false);
      if (splashEl) {
        splashEl.hidden = false;
        splashEl.classList.remove('fade-out');
        splashEl.style.display = 'flex';
        splashEl.style.opacity = '1';
        splashEl.style.visibility = 'visible';
        splashEl.style.pointerEvents = 'auto';
      }
      if (pickerEl) pickerEl.hidden = true;
      if (workspaceEl) workspaceEl.hidden = true;

      // Auto transition after 2.2s (smooth 300ms fade-out)
      state.splashTimer = setTimeout(() => {
        if (state.screen === 'splash') {
          if (splashEl) {
            splashEl.classList.add('fade-out');
            setTimeout(() => {
              if (state.screen === 'splash') {
                document.body.classList.remove('primecode-splash-active');
                switchScreen('picker');
                setPrimeBuddyVisible(true);
              }
            }, 300);
          } else {
            document.body.classList.remove('primecode-splash-active');
            switchScreen('picker');
            setPrimeBuddyVisible(true);
          }
        }
      }, 2200);
    } else if (screen === 'picker') {
      document.body.classList.remove('primecode-splash-active');
      setPrimeBuddyVisible(true);
      if (splashEl) {
        splashEl.classList.add('fade-out');
        splashEl.hidden = true;
        splashEl.style.display = 'none';
      }
      if (pickerEl) {
        pickerEl.hidden = false;
        const scrollArea = pickerEl.querySelector('.primecode-picker-scroll');
        if (scrollArea) scrollArea.scrollTop = 0;
      }
      if (workspaceEl) workspaceEl.hidden = true;
    } else if (screen === 'workspace') {
      document.body.classList.remove('primecode-splash-active');
      setPrimeBuddyVisible(true);
      if (splashEl) {
        splashEl.classList.add('fade-out');
        splashEl.hidden = true;
        splashEl.style.display = 'none';
      }
      if (pickerEl) pickerEl.hidden = true;
      if (workspaceEl) workspaceEl.hidden = false;
      const codeKey = state.activeLang === 'html' ? state.activeWebFile : state.activeLang;
      syncCodeMirror(state.activeLang, getSavedCode(codeKey));
    }
  }

  // Open & Close PrimeCode Modal
  function openCodeLab(directScreen = 'splash') {
    triggerHaptic(14);
    const modal = document.getElementById('codeLabModal');
    if (!modal) return;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    if (!directScreen || directScreen === 'splash') {
      document.body.classList.add('primecode-splash-active');
      setPrimeBuddyVisible(false);
    } else {
      document.body.classList.remove('primecode-splash-active');
      setPrimeBuddyVisible(true);
    }

    switchScreen(directScreen || 'splash');
  }

  function closeCodeLab(syncHistory = true) {
    triggerHaptic(10);
    document.body.classList.remove('primecode-splash-active');
    setPrimeBuddyVisible(true);
    if (state.splashTimer) {
      clearTimeout(state.splashTimer);
      state.splashTimer = null;
    }
    const modal = document.getElementById('codeLabModal');
    if (!modal) return;

    modal.classList.remove('open');
    modal.style.height = '';
    const workspace = document.getElementById('primecodeWorkspace');
    if (workspace) workspace.style.height = '';
    document.body.style.overflow = '';

    if (syncHistory && (location.hash === '#primecode' || location.hash === '#codelab')) {
      try {
        history.back();
      } catch (e) {
        location.hash = '';
      }
    }
  }

  function openCodeLabRoute() {
    try {
      if (location.hash !== '#primecode') {
        history.pushState(null, '', '#primecode');
      }
    } catch (e) {
      location.hash = '#primecode';
    }
    openCodeLab('splash');
  }

  window.addEventListener('hashchange', () => {
    if (location.hash === '#primecode' || location.hash === '#codelab') {
      openCodeLab('splash');
    } else {
      const modal = document.getElementById('codeLabModal');
      if (modal && modal.classList.contains('open')) {
        closeCodeLab(false);
      }
    }
  });

  // ---- Line Number Generator & Fold Carets ----
  function updateLineNumbers(textareaEl, lineNumbersEl) {
    if (!textareaEl || !lineNumbersEl) return;
    const lines = (textareaEl.value || '').split('\n');
    let numbersHtml = '';
    
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const lineText = lines[i];
      // Show fold caret on line 1 or lines opening a block
      const hasFold = (lineNum === 1 || lineNum === 2 || lineText.includes('{') || lineText.trim().startsWith('def ') || lineText.trim().startsWith('class '));
      const caret = hasFold ? ' <i class="fa-solid fa-caret-down fold-caret"></i>' : '';
      numbersHtml += `<span>${lineNum}${caret}</span>\n`;
    }
    lineNumbersEl.innerHTML = numbersHtml;
    lineNumbersEl.scrollTop = textareaEl.scrollTop;
  }

  // ---- Open Language Workspace ----
  function openLanguage(langKey) {
    triggerHaptic(12);
    state.activeLang = langKey;
    const config = LANG_CONFIG[langKey] || LANG_CONFIG.python;

    // 1. Configure Segmented Pill Switcher (Only [Code | Console] and [Code | Preview])
    const pillCode = document.getElementById('primecodeTabCode');
    const pillConsole = document.getElementById('primecodeTabConsole');
    const pillPreview = document.getElementById('primecodeTabPreview');

    if (pillCode) pillCode.style.display = 'inline-flex';

    if (langKey === 'html') {
      if (pillConsole) pillConsole.style.display = 'none';
      if (pillPreview) pillPreview.style.display = 'inline-flex';
    } else {
      // Compilers and MySQL use Console
      if (pillConsole) pillConsole.style.display = 'inline-flex';
      if (pillPreview) pillPreview.style.display = 'none';
    }

    // 2. Configure File Tab Bar
    const tabsTrack = document.getElementById('primecodeFileTabsTrack');
    if (tabsTrack) {
      if (langKey === 'html') {
        state.activeWebFile = 'html';
        tabsTrack.innerHTML = `
          <button type="button" class="primecode-file-tab active bca-pressable" data-web-file="html">
            <span>index.html</span>
          </button>
          <button type="button" class="primecode-file-tab bca-pressable" data-web-file="css">
            <span>styles.css</span>
          </button>
          <button type="button" class="primecode-file-tab bca-pressable" data-web-file="js">
            <span>script.js</span>
          </button>
        `;
        tabsTrack.querySelectorAll('.primecode-file-tab').forEach(btn => {
          btn.addEventListener('click', () => switchWebFile(btn.dataset.webFile));
        });
      } else {
        tabsTrack.innerHTML = `
          <button type="button" class="primecode-file-tab active" data-file="main" id="primecodeActiveFileTab">
            <span>${config.filename}</span>
          </button>
        `;
      }
    }

    // 3. Load Code into Editor & CodeMirror
    const codeKey = langKey === 'html' ? state.activeWebFile : langKey;
    const initialCode = getSavedCode(codeKey);
    const editor = document.getElementById('primecodeEditor');
    const lineNumbers = document.getElementById('primecodeLineNumbers');
    if (editor) {
      editor.value = initialCode;
      editor.style.fontSize = state.fontSize;
      if (lineNumbers) {
        lineNumbers.style.fontSize = state.fontSize;
        updateLineNumbers(editor, lineNumbers);
      }
    }
    syncCodeMirror(langKey, initialCode);

    // 4. Isolate Console Output Per Language (Never show stale output from another language)
    if (state.interactiveSession && state.interactiveSession.active) {
      stopInteractiveExecution();
    }
    state.isExecuting = false;

    const consolePre = document.getElementById('primecodeConsolePre');
    const consoleBadge = document.getElementById('primecodeConsoleStatusBadge');
    const consoleStatusText = document.getElementById('primecodeConsoleStatusText');
    const inputBar = document.getElementById('primecodeConsoleInputBar');
    if (inputBar) inputBar.style.display = 'none';

    const floatingActions = document.getElementById('primecodeFloatingActions');
    if (floatingActions) floatingActions.classList.remove('with-input-bar');

    if (!state.consoleStateByLang) {
      state.consoleStateByLang = {};
    }

    const langConsole = state.consoleStateByLang[langKey];
    if (langConsole && langConsole.hasRun && langConsole.outputHtml) {
      if (consolePre) consolePre.innerHTML = langConsole.outputHtml;
      if (consoleBadge && langConsole.badgeVisible) {
        consoleBadge.className = langConsole.badgeClass || 'primecode-status-badge success';
        consoleBadge.style.display = 'inline-flex';
        if (consoleStatusText) consoleStatusText.innerHTML = langConsole.badgeText || '';
      } else if (consoleBadge) {
        consoleBadge.style.display = 'none';
      }
    } else {
      // Clean pristine console for newly opened languages
      if (consolePre) {
        consolePre.innerHTML = '<span class="primecode-console-placeholder">No output yet &mdash; Run your code to see the output here.</span>';
      }
      if (consoleBadge) consoleBadge.style.display = 'none';
      if (consoleStatusText) consoleStatusText.innerHTML = '';
    }

    // 5. Default tab: 'code'
    switchWorkspaceTab('code');

    // 6. Pre-init SQLite if mysql
    if (langKey === 'mysql' && !state.sqlDb) {
      initSqlDatabase();
    }

    // Switch screen to workspace
    switchScreen('workspace');
  }

  // ---- Workspace Tab Switching ----
  function switchWorkspaceTab(tab) {
    triggerHaptic(10);
    state.activeTab = tab;

    // Highlight active pill
    document.querySelectorAll('.primecode-segment-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Quick symbol toolbar must ONLY appear in the Code editor tab
    const quickSymbols = document.getElementById('primecodeQuickSymbols');
    if (quickSymbols) {
      quickSymbols.style.display = tab === 'code' ? 'flex' : 'none';
    }

    const isDesktop = window.innerWidth >= 768;
    const editorPane = document.getElementById('primecodePaneEditor');
    const outputPane = document.getElementById('primecodePaneOutput');
    const consoleView = document.getElementById('primecodeConsoleView');
    const previewView = document.getElementById('primecodePreviewView');

    if (!isDesktop) {
      // Mobile View Switching
      if (tab === 'code') {
        if (editorPane) editorPane.style.display = 'flex';
        if (outputPane) outputPane.style.display = 'none';
      } else {
        if (editorPane) editorPane.style.display = 'none';
        if (outputPane) outputPane.style.display = 'flex';

        if (consoleView) consoleView.style.display = tab === 'console' ? 'flex' : 'none';
        if (previewView) previewView.style.display = tab === 'preview' ? 'flex' : 'none';
      }
    } else {
      // Desktop View (Split 2-Pane: Editor always visible on left)
      if (editorPane) editorPane.style.display = 'flex';
      if (outputPane) outputPane.style.display = 'flex';

      if (state.activeLang === 'html') {
        if (consoleView) consoleView.style.display = 'none';
        if (previewView) previewView.style.display = 'flex';
      } else {
        if (consoleView) consoleView.style.display = 'flex';
        if (previewView) previewView.style.display = 'none';
      }
    }
  }

  // ---- HTML Multi-File Switching ----
  function switchWebFile(fileKey) {
    triggerHaptic(10);
    // Save previous file
    saveCode(state.activeWebFile, getActiveCode());
    state.activeWebFile = fileKey;
    const nextCode = getSavedCode(fileKey);
    const lang = fileKey === 'js' ? 'javascript' : fileKey === 'css' ? 'css' : 'html';
    setActiveCode(nextCode, lang);

    // Update active tab styling
    document.querySelectorAll('#primecodeFileTabsTrack .primecode-file-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.webFile === fileKey);
    });
  }

  // ---- Input Call Detection ----
  function detectInputCalls(code) {
    if (!code) return { needsInput: false, keyword: '' };
    if (/\b(Scanner|BufferedReader)\b/.test(code)) return { needsInput: true, keyword: 'Scanner' };
    if (/\b(cin\s*>>|scanf\s*\()/.test(code)) return { needsInput: true, keyword: 'cin / scanf' };
    if (/\b(input\s*\()/.test(code)) return { needsInput: true, keyword: 'input()' };
    return { needsInput: false, keyword: '' };
  }

  // ---- ASCII Table Generator for MySQL ----
  function formatSqlToAsciiTable(columns, values) {
    if (!columns || columns.length === 0) return 'Query executed successfully. (0 rows returned)';
    if (!values || values.length === 0) {
      const colWidths = columns.map(c => Math.max(String(c).length, 3));
      const sep = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
      const hdr = '|' + columns.map((c, i) => ' ' + String(c).padEnd(colWidths[i]) + ' ').join('|') + '|';
      return sep + '\n' + hdr + '\n' + sep + '\n(0 rows in set)';
    }

    const colWidths = columns.map((col, i) => {
      let max = String(col).length;
      values.forEach(row => {
        const valStr = row[i] === null ? 'NULL' : String(row[i]);
        if (valStr.length > max) max = valStr.length;
      });
      return Math.max(max, 3);
    });

    const sep = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
    const hdr = '|' + columns.map((col, i) => ' ' + String(col).padEnd(colWidths[i]) + ' ').join('|') + '|';
    const rows = values.map(row => {
      return '|' + row.map((cell, i) => {
        const valStr = cell === null ? 'NULL' : String(cell);
        const isNum = !isNaN(Number(valStr)) && valStr.trim() !== '';
        const padded = isNum ? valStr.padStart(colWidths[i]) : valStr.padEnd(colWidths[i]);
        return ' ' + padded + ' ';
      }).join('|') + '|';
    });

    return [sep, hdr, sep, ...rows, sep, `\n${values.length} row${values.length === 1 ? '' : 's'} in set`].join('\n');
  }

  // ---- SQLite Database Initialization ----
  async function initSqlDatabase() {
    if (state.sqlDb || state.sqlJsLoading) return;
    state.sqlJsLoading = true;

    try {
      if (typeof window.initSqlJs !== 'function') {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
          script.async = true;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      if (typeof window.initSqlJs === 'function') {
        const SQL = await window.initSqlJs({
          locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        state.sqlDb = new SQL.Database();
        state.sqlDb.run(SQL_SEED);
      }
    } catch (e) {
      console.warn('[PrimeCode] SQLite initialization error:', e);
    } finally {
      state.sqlJsLoading = false;
    }
  }

  // ---- Primary Execution Engine (runPrimeCode) ----
  async function runPrimeCode() {
    if (state.isExecuting) return;
    triggerHaptic(14);

    const editor = document.getElementById('primecodeEditor');
    if (!editor) return;

    const lang = state.activeLang;

    // === 1. HTML WEB DEV WORKSPACE ===
    if (lang === 'html') {
      saveCode(state.activeWebFile, getActiveCode());
      const html = getSavedCode('html');
      const css = getSavedCode('css');
      const js = getSavedCode('js');

      const iframe = document.getElementById('primecodePreviewIframe');
      if (iframe) {
        iframe.srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${css}</style>
</head>
<body>
  ${html}
  <script>${js}<\/script>
</body>
</html>`;
      }
      switchWorkspaceTab('preview');
      notify('Live preview refreshed! ⚡', 'success');
      return;
    }

    // === 2. MYSQL QUERY EXECUTION ===
    if (lang === 'mysql') {
      const query = getActiveCode().trim();
      if (!query) {
        notify('Please enter a SQL query', 'info');
        return;
      }
      saveCode('mysql', query);

      if (!state.sqlDb) {
        await initSqlDatabase();
      }

      const startTime = performance.now();
      const consoleBadge = document.getElementById('primecodeConsoleStatusBadge');
      const consoleStatusText = document.getElementById('primecodeConsoleStatusText');
      const consolePre = document.getElementById('primecodeConsolePre');
      const inputBar = document.getElementById('primecodeConsoleInputBar');
      if (inputBar) inputBar.style.display = 'none';

      const floatingActions = document.getElementById('primecodeFloatingActions');
      if (floatingActions) floatingActions.classList.remove('with-input-bar');

      try {
        if (state.sqlDb) {
          const results = state.sqlDb.exec(query);
          const elapsed = Math.round(performance.now() - startTime);

          if (!results || results.length === 0) {
            const tableText = 'Query executed successfully. (0 rows returned)';
            if (consolePre) consolePre.textContent = tableText;
            if (consoleStatusText) consoleStatusText.innerHTML = `<i class="fa-solid fa-check"></i> <span>Success · ${elapsed} ms</span>`;
            if (consoleBadge) {
              consoleBadge.className = 'primecode-status-badge success';
              consoleBadge.style.display = 'inline-flex';
            }
          } else {
            const first = results[0];
            const tableText = formatSqlToAsciiTable(first.columns, first.values);
            if (consolePre) consolePre.textContent = tableText;
            if (consoleStatusText) consoleStatusText.innerHTML = `<i class="fa-solid fa-check"></i> <span>Success · ${elapsed} ms</span>`;
            if (consoleBadge) {
              consoleBadge.className = 'primecode-status-badge success';
              consoleBadge.style.display = 'inline-flex';
            }
          }
          switchWorkspaceTab('console');
          saveConsoleState('mysql');
          notify('SQL query executed successfully!', 'success');
        } else {
          if (consolePre) consolePre.textContent = `-- SQLite engine ready. Sample table: students (id, name, semester, cgpa)\n${query}`;
          switchWorkspaceTab('console');
          saveConsoleState('mysql');
        }
      } catch (err) {
        const elapsed = Math.round(performance.now() - startTime);
        if (consolePre) consolePre.textContent = `SQL Error: ${err.message || String(err)}`;
        if (consoleStatusText) consoleStatusText.innerHTML = `<span class="primecode-status-dot">●</span> <span>Error · ${elapsed} ms</span>`;
        if (consoleBadge) {
          consoleBadge.className = 'primecode-status-badge error';
          consoleBadge.style.display = 'inline-flex';
        }
        switchWorkspaceTab('console');
        saveConsoleState('mysql');
        notify('SQL syntax error', 'error');
      }
      return;
    }

    // === 3. COMPILER LANGUAGES (Java, Python, C, C++, PHP, JavaScript) ===
    saveCode(lang, getActiveCode());

    // If session is already running and user clicked Run/Stop, stop it
    if (state.interactiveSession && state.interactiveSession.active) {
      stopInteractiveExecution();
      return;
    }

    // Start New Interactive Live Session
    state.interactiveSession = {
      active: true,
      isWaitingForInput: false,
      isKilled: false,
      lang: lang,
      code: getActiveCode(),
      turns: [],
      fullStdout: '',
      startTime: performance.now(),
      abortController: new AbortController()
    };
    state.isExecuting = true;

    // Switch to console view immediately
    switchWorkspaceTab('console');

    // UI state
    const consoleBadge = document.getElementById('primecodeConsoleStatusBadge');
    const consoleStatusText = document.getElementById('primecodeConsoleStatusText');
    const consolePre = document.getElementById('primecodeConsolePre');
    const fabStop = document.getElementById('primecodeFabStop');
    const fabRun = document.getElementById('primecodeFabRun');
    const fabAssist = document.getElementById('primecodeFabAssist');
    const fabFix = document.getElementById('primecodeFabFix');
    const deskRun = document.getElementById('primecodeDesktopRunBtn');
    const inputBar = document.getElementById('primecodeConsoleInputBar');

    if (consoleBadge) {
      consoleBadge.className = 'primecode-status-badge running';
      consoleBadge.style.display = 'inline-flex';
    }
    if (consoleStatusText) {
      consoleStatusText.innerHTML = '<span class="primecode-spinner"></span> <span>Running</span>';
    }
    if (consolePre) {
      consolePre.textContent = 'Connecting to execution engine...\n';
    }
    if (inputBar) inputBar.style.display = 'none';

    if (fabAssist) fabAssist.style.display = 'none';
    if (fabFix) fabFix.style.display = 'none';
    if (fabRun) fabRun.style.display = 'none';
    if (fabStop) fabStop.style.display = 'inline-flex';
    if (deskRun) {
      deskRun.innerHTML = '<i class="fa-solid fa-square"></i> <span>Stop</span>';
      deskRun.classList.add('primecode-btn-stop-active');
    }

    executeInteractiveStep();
  }

  // ---- Interactive Console HTML Renderer ----
  function renderInteractiveConsole(turns, fullStdout, isWaitingForInput, isKilled) {
    const consolePre = document.getElementById('primecodeConsolePre');
    if (!consolePre) return;

    function esc(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    let html = '';
    let consumed = 0;

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      const chunk = fullStdout.slice(consumed, consumed + turn.promptLength);
      consumed += turn.promptLength;
      html += esc(chunk);
      html += `<span class="primecode-echo-input">${esc(turn.userInput)}</span>\n`;
    }

    const remaining = fullStdout.slice(consumed);
    html += esc(remaining);

    if (isWaitingForInput) {
      html += `<span class="primecode-terminal-cursor">|</span>`;
    } else if (isKilled) {
      html += `<span class="primecode-killed-text">Execution killed</span>`;
    }

    consolePre.innerHTML = html;
    saveConsoleState(state.activeLang);

    const consoleBody = document.getElementById('primecodeConsoleBody');
    if (consoleBody) {
      consoleBody.scrollTop = consoleBody.scrollHeight;
    }
  }

  // ---- Interactive Step Execution Engine ----
  async function executeInteractiveStep() {
    if (!state.interactiveSession || !state.interactiveSession.active) return;

    const session = state.interactiveSession;
    const lang = session.lang;
    const code = session.code;

    // Stdin from accumulated turns
    const stdin = session.turns.map(t => t.userInput).join('\n') + (session.turns.length > 0 ? '\n' : '');

    // Smart Java filename resolution
    let javaFileName = 'Main.java';
    if (lang === 'java') {
      const javaClassMatch = code.match(/public\s+class\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
      if (javaClassMatch && javaClassMatch[1]) {
        javaFileName = `${javaClassMatch[1]}.java`;
      }
    }

    let executionResult = null;

    try {
      // 1. Primary Engine: Wandbox
      try {
        const wandboxCompilers = {
          c: 'gcc-13.2.0-c',
          cpp: 'gcc-13.2.0',
          java: 'openjdk-jdk-21+35',
          python: 'cpython-3.8.20',
          php: 'php-8.3.12',
          javascript: 'nodejs-20.17.0'
        };

        const compilerName = wandboxCompilers[lang] || wandboxCompilers.c;
        const wandboxPayload = {
          compiler: compilerName,
          code: lang === 'java' ? '// BCA Java Runner' : code,
          stdin: stdin
        };

        if (lang === 'java') {
          wandboxPayload.codes = [{ file: javaFileName, code: code }];
          wandboxPayload['compiler-option-raw'] = javaFileName;
        }

        const wbRes = await fetch('https://wandbox.org/api/compile.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(wandboxPayload),
          signal: session.abortController ? session.abortController.signal : undefined
        });

        if (wbRes.ok) {
          const data = await wbRes.json();
          executionResult = {
            stdout: data.program_output || '',
            stderr: (data.compiler_error || '') + (data.program_error || ''),
            exitCode: parseInt(data.status, 10) || 0
          };
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('[PrimeCode] Wandbox runner error:', err);
      }

      // 2. Secondary Engine: Piston
      if (!executionResult && (!session.abortController || !session.abortController.signal.aborted)) {
        try {
          const pistonLangs = {
            c: { language: 'c', version: '10.2.0', file: 'main.c' },
            cpp: { language: 'c++', version: '10.2.0', file: 'main.cpp' },
            java: { language: 'java', version: '15.0.2', file: javaFileName },
            python: { language: 'python', version: '3.10.0', file: 'main.py' },
            php: { language: 'php', version: '8.2.3', file: 'main.php' },
            javascript: { language: 'javascript', version: '18.15.0', file: 'main.js' }
          };

          const pistonConfig = pistonLangs[lang] || pistonLangs.c;
          const response = await fetch('https://emkc.org/api/v2/piston/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              language: pistonConfig.language,
              version: pistonConfig.version,
              files: [{ name: pistonConfig.file, content: code }],
              stdin: stdin
            }),
            signal: session.abortController ? session.abortController.signal : undefined
          });

          if (response.ok) {
            const data = await response.json();
            if (data && data.run) {
              executionResult = {
                stdout: data.run.stdout || '',
                stderr: (data.compile && data.compile.stderr) || data.run.stderr || '',
                exitCode: data.run.code
              };
            }
          }
        } catch (err) {
          if (err.name === 'AbortError') return;
          console.warn('[PrimeCode] Piston fallback error:', err);
        }
      }

      if (session.isKilled || !session.active) return;

      const consoleBadge = document.getElementById('primecodeConsoleStatusBadge');
      const consoleStatusText = document.getElementById('primecodeConsoleStatusText');
      const inputBar = document.getElementById('primecodeConsoleInputBar');
      const inputEl = document.getElementById('primecodeInteractiveInput');
      const floatingActions = document.getElementById('primecodeFloatingActions');
      const fabStop = document.getElementById('primecodeFabStop');
      const fabRun = document.getElementById('primecodeFabRun');
      const fabAssist = document.getElementById('primecodeFabAssist');
      const fabFix = document.getElementById('primecodeFabFix');
      const deskRun = document.getElementById('primecodeDesktopRunBtn');

      if (!executionResult) {
        const errMsg = 'Execution service is unreachable. Please verify your internet connection.';
        session.fullStdout = errMsg;
        renderInteractiveConsole([], errMsg, false, false);
        if (consoleBadge) {
          consoleBadge.className = 'primecode-status-badge error';
          consoleBadge.style.display = 'inline-flex';
        }
        if (consoleStatusText) consoleStatusText.textContent = 'Network Error';
        session.active = false;
        state.isExecuting = false;
        if (fabStop) fabStop.style.display = 'none';
        if (fabFix) fabFix.style.display = 'inline-flex';
        if (fabRun) fabRun.style.display = 'inline-flex';
        return;
      }

      const rawStdout = executionResult.stdout || '';
      const rawStderr = executionResult.stderr || '';

      // Detection: is the program awaiting input?
      const isEofError = 
        /NoSuchElementException/i.test(rawStderr) ||
        /EOFError/i.test(rawStderr) ||
        /End of file/i.test(rawStderr) ||
        /unexpected EOF/i.test(rawStderr);

      const promptRegex = /([:?\]>]|\([0-9\-,/ ]+\):?)\s*$/;
      const endsWithPrompt = promptRegex.test(rawStdout.trimEnd());
      const hasInputCalls = detectInputCalls(code).needsInput;

      const isWaiting = isEofError || (hasInputCalls && endsWithPrompt);

      if (isWaiting) {
        session.isWaitingForInput = true;
        session.fullStdout = rawStdout;

        // Running pill badge with spinning loader
        if (consoleBadge) {
          consoleBadge.className = 'primecode-status-badge running';
          consoleBadge.style.display = 'inline-flex';
        }
        if (consoleStatusText) {
          consoleStatusText.innerHTML = '<span class="primecode-spinner"></span> <span>Running</span>';
        }

        // Render console with blue blinking cursor
        renderInteractiveConsole(session.turns, rawStdout, true, false);

        // Show sticky input bar
        if (inputBar) inputBar.style.display = 'flex';
        if (floatingActions) floatingActions.classList.add('with-input-bar');
        if (inputEl) {
          inputEl.disabled = false;
          inputEl.focus();
        }

        // Stop button active
        if (fabStop) fabStop.style.display = 'inline-flex';
        if (fabRun) fabRun.style.display = 'none';
        if (fabAssist) fabAssist.style.display = 'none';
        if (fabFix) fabFix.style.display = 'none';
      } else {
        // Finished or compilation/runtime error
        session.active = false;
        session.isWaitingForInput = false;
        state.isExecuting = false;
        session.fullStdout = rawStdout;

        const elapsed = Math.round(performance.now() - session.startTime);
        const isSuccess = executionResult.exitCode === 0 && !rawStderr;

        let finalText = rawStdout;
        if (rawStderr) {
          if (finalText) finalText += '\n';
          finalText += rawStderr;
        }
        if (!finalText) {
          finalText = isSuccess ? 'Program completed with no output (exit code 0).' : `Process exited with code ${executionResult.exitCode}.`;
        }

        renderInteractiveConsole(session.turns, finalText, false, false);

        if (inputBar) inputBar.style.display = 'none';
        if (floatingActions) floatingActions.classList.remove('with-input-bar');

        if (isSuccess) {
          if (consoleBadge) {
            consoleBadge.className = 'primecode-status-badge success';
            consoleBadge.style.display = 'inline-flex';
          }
          if (consoleStatusText) {
            consoleStatusText.innerHTML = `<i class="fa-solid fa-check"></i> <span>Success · ${elapsed} ms</span>`;
          }
          if (fabStop) fabStop.style.display = 'none';
          if (fabFix) fabFix.style.display = 'none';
          if (fabAssist) fabAssist.style.display = 'inline-flex';
          if (fabRun) {
            fabRun.style.display = 'inline-flex';
            fabRun.innerHTML = '<i class="fa-solid fa-play"></i> <span>Run</span>';
          }
          if (deskRun) {
            deskRun.innerHTML = '<i class="fa-solid fa-play"></i> <span>Run</span>';
            deskRun.classList.remove('primecode-btn-stop-active');
          }
          saveConsoleState(state.activeLang);
          notify('Code executed successfully!', 'success');
        } else {
          const elapsedSec = (elapsed / 1000).toFixed(1);
          if (consoleBadge) {
            consoleBadge.className = 'primecode-status-badge error';
            consoleBadge.style.display = 'inline-flex';
          }
          if (consoleStatusText) {
            consoleStatusText.innerHTML = `<span class="primecode-status-dot">●</span> <span>Error · ${elapsedSec}s</span>`;
          }
          if (fabStop) fabStop.style.display = 'none';
          if (fabAssist) fabAssist.style.display = 'none';
          if (fabFix) fabFix.style.display = 'inline-flex';
          if (fabRun) {
            fabRun.style.display = 'inline-flex';
            fabRun.innerHTML = '<i class="fa-solid fa-play"></i> <span>Run</span>';
          }
          if (deskRun) {
            deskRun.innerHTML = '<i class="fa-solid fa-play"></i> <span>Run</span>';
            deskRun.classList.remove('primecode-btn-stop-active');
          }
          saveConsoleState(state.activeLang);
          notify('Program exited with error', 'error');
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[PrimeCode] Interactive execution error:', err);
    }
  }

  // ---- Submit Interactive Stdin Input ----
  function submitInteractiveInput() {
    const inputEl = document.getElementById('primecodeInteractiveInput');
    if (!inputEl) return;
    const val = inputEl.value;
    if (!state.interactiveSession || !state.interactiveSession.active) return;
    if (!state.interactiveSession.isWaitingForInput) return;

    triggerHaptic(10);

    let prevConsumed = 0;
    state.interactiveSession.turns.forEach(t => { prevConsumed += t.promptLength; });
    const promptLength = Math.max(0, (state.interactiveSession.fullStdout || '').length - prevConsumed);

    state.interactiveSession.turns.push({
      promptLength: promptLength,
      userInput: val
    });

    inputEl.value = '';
    state.interactiveSession.isWaitingForInput = false;

    // Immediately render echoed input in blue
    renderInteractiveConsole(
      state.interactiveSession.turns,
      state.interactiveSession.fullStdout,
      false,
      false
    );

    const consoleStatusText = document.getElementById('primecodeConsoleStatusText');
    if (consoleStatusText) {
      consoleStatusText.innerHTML = '<span class="primecode-spinner"></span> <span>Running</span>';
    }

    executeInteractiveStep();
  }

  // ---- Stop Execution Handler ----
  function stopInteractiveExecution() {
    triggerHaptic(15);
    if (!state.interactiveSession || !state.interactiveSession.active) return;

    if (state.interactiveSession.abortController) {
      try {
        state.interactiveSession.abortController.abort();
      } catch (_e) {}
    }

    state.interactiveSession.active = false;
    state.interactiveSession.isWaitingForInput = false;
    state.interactiveSession.isKilled = true;
    state.isExecuting = false;

    const elapsedSec = ((performance.now() - state.interactiveSession.startTime) / 1000).toFixed(1);

    const consoleBadge = document.getElementById('primecodeConsoleStatusBadge');
    const consoleStatusText = document.getElementById('primecodeConsoleStatusText');
    if (consoleBadge) {
      consoleBadge.className = 'primecode-status-badge error';
      consoleBadge.style.display = 'inline-flex';
    }
    if (consoleStatusText) {
      consoleStatusText.innerHTML = `<span class="primecode-status-dot">●</span> <span>Error · ${elapsedSec}s</span>`;
    }

    renderInteractiveConsole(
      state.interactiveSession.turns,
      state.interactiveSession.fullStdout || '',
      false,
      true
    );

    const inputBar = document.getElementById('primecodeConsoleInputBar');
    if (inputBar) inputBar.style.display = 'none';

    const floatingActions = document.getElementById('primecodeFloatingActions');
    if (floatingActions) floatingActions.classList.remove('with-input-bar');

    const fabStop = document.getElementById('primecodeFabStop');
    const fabRun = document.getElementById('primecodeFabRun');
    const fabAssist = document.getElementById('primecodeFabAssist');
    const fabFix = document.getElementById('primecodeFabFix');
    const deskRun = document.getElementById('primecodeDesktopRunBtn');

    if (fabStop) fabStop.style.display = 'none';
    if (fabAssist) fabAssist.style.display = 'none';
    if (fabFix) fabFix.style.display = 'inline-flex';
    if (fabRun) {
      fabRun.style.display = 'inline-flex';
      fabRun.innerHTML = '<i class="fa-solid fa-play"></i> <span>Run</span>';
    }
    if (deskRun) {
      deskRun.innerHTML = '<i class="fa-solid fa-play"></i> <span>Run</span>';
      deskRun.classList.remove('primecode-btn-stop-active');
    }

    notify('Execution stopped', 'info');
  }

  // ---- AI Fix & Diagnostic Sheet ----
  function openAiFixSheet() {
    triggerHaptic(12);
    const lang = state.activeLang;

    let fixHtml = `
      <div style="display:flex;flex-direction:column;gap:14px;padding:6px 0 24px;">
        <div style="background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.2);border-radius:12px;padding:14px;">
          <div style="display:flex;align-items:center;gap:8px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;color:#38bdf8;">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            <span>PrimeBuddy AI Code Insights</span>
          </div>
          <p style="margin:8px 0 0;font-size:13.5px;color:var(--ui-color-text-sub,#94a3b8);line-height:1.5;">
            ${state.interactiveSession && state.interactiveSession.isKilled
              ? 'Execution was killed manually by user. If your program entered an unexpected infinite loop or was awaiting input, review loop conditions or choice handlers.'
              : 'Diagnostics analyzed your latest run error. Below are quick fixes to run cleanly.'}
          </p>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;">
          <button type="button" class="bca-pressable" id="primecodeFixLoadCafeBtn"
            style="width:100%;text-align:left;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:inherit;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div style="font-weight:600;font-size:14px;">☕ Load Tested Practical Template</div>
              <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Load clean, verified interactive starter code</div>
            </div>
            <i class="fa-solid fa-arrow-rotate-right" style="color:#2563eb;"></i>
          </button>

          <button type="button" class="bca-pressable" id="primecodeFixClearConsoleBtn"
            style="width:100%;text-align:left;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:inherit;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div style="font-weight:600;font-size:14px;">🧹 Reset & Clear Console</div>
              <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Wipe killed process output and start fresh</div>
            </div>
            <i class="fa-solid fa-trash-can" style="color:#ef4444;"></i>
          </button>
        </div>
      </div>
    `;

    if (window.BCA_UI && window.BCA_UI.BottomSheet) {
      const sheet = new window.BCA_UI.BottomSheet({
        title: 'PrimeCode AI Fix & Diagnostics',
        content: fixHtml
      });
      sheet.open();

      setTimeout(() => {
        const loadBtn = document.getElementById('primecodeFixLoadCafeBtn');
        if (loadBtn) {
          loadBtn.addEventListener('click', () => {
            sheet.close();
            openPracticalTemplatesSheet();
          });
        }
        const clearBtn = document.getElementById('primecodeFixClearConsoleBtn');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            sheet.close();
            const clearAction = document.getElementById('primecodeConsoleClearBtn');
            if (clearAction) clearAction.click();
          });
        }
      }, 50);
    } else {
      openPracticalTemplatesSheet();
    }
  }

  // ---- BCA Practical Templates Sheet ----
  function openPracticalTemplatesSheet() {
    triggerHaptic(12);
    const lang = state.activeLang;
    const templates = BCA_PRACTICALS[lang] || [];

    if (templates.length === 0) {
      notify('Templates available for Java, Python, C, C++, PHP, MySQL & JS', 'info');
      return;
    }

    let itemsHtml = '<div style="display:flex;flex-direction:column;gap:10px;padding:8px 0 20px;">';
    templates.forEach((t, i) => {
      itemsHtml += `
        <button type="button" class="bca-pressable" data-template-idx="${i}"
          style="width:100%;text-align:left;padding:14px 16px;border-radius:12px;background:var(--ui-color-card-bg,#161e2e);border:1px solid rgba(255,255,255,0.08);color:inherit;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="font-family:\'Roboto Condensed\',sans-serif;font-weight:600;font-size:14.5px;">${t.name}</div>
          <i class="fa-solid fa-arrow-right" style="font-size:12px;color:#2563eb;flex-shrink:0;"></i>
        </button>
      `;
    });
    itemsHtml += '</div>';

    if (window.BCA_UI && window.BCA_UI.BottomSheet) {
      const sheet = new window.BCA_UI.BottomSheet({
        title: `${LANG_CONFIG[lang].name} Practical Templates`,
        content: itemsHtml
      });
      sheet.open();

      // Listen to template selection
      setTimeout(() => {
        document.querySelectorAll('[data-template-idx]').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.templateIdx, 10);
            const chosen = templates[idx];
            if (chosen) {
              setActiveCode(chosen.code, lang);
              saveCode(lang, chosen.code);
              notify(`Loaded: ${chosen.name}`, 'success');
            }
            sheet.close();
          });
        });
      }, 50);
    }
  }

  // ---- Options Menu Sheet ----
  function openOptionsMenu() {
    triggerHaptic(12);
    const lang = state.activeLang;
    const config = LANG_CONFIG[lang] || LANG_CONFIG.python;

    const contentHtml = `
      <div style="display:flex;flex-direction:column;gap:8px;padding:8px 0 20px;">
        <button type="button" id="optBcaTemplates" class="bca-pressable"
          style="width:100%;text-align:left;padding:14px 16px;border-radius:12px;background:var(--ui-color-card-bg,#161e2e);border:1px solid rgba(255,255,255,0.08);color:inherit;cursor:pointer;display:flex;align-items:center;gap:12px;">
          <i class="fa-solid fa-book-open" style="color:#2563eb;width:20px;text-align:center;font-size:16px;"></i>
          <div>
            <div style="font-family:'Roboto Condensed',sans-serif;font-weight:600;font-size:14.5px;">BCA Practical Templates</div>
            <div style="font-size:12px;color:#94a3b8;">Curated university practical programs</div>
          </div>
        </button>

        <button type="button" id="optFontSize" class="bca-pressable"
          style="width:100%;text-align:left;padding:14px 16px;border-radius:12px;background:var(--ui-color-card-bg,#161e2e);border:1px solid rgba(255,255,255,0.08);color:inherit;cursor:pointer;display:flex;align-items:center;gap:12px;">
          <i class="fa-solid fa-text-height" style="color:#2563eb;width:20px;text-align:center;font-size:16px;"></i>
          <div>
            <div style="font-family:'Roboto Condensed',sans-serif;font-weight:600;font-size:14.5px;">Editor Font Size: <span id="optCurrentFontSize">${state.fontSize}</span></div>
            <div style="font-size:12px;color:#94a3b8;">Tap to toggle (13.5px / 15px / 18px)</div>
          </div>
        </button>

        <button type="button" id="optResetCode" class="bca-pressable"
          style="width:100%;text-align:left;padding:14px 16px;border-radius:12px;background:var(--ui-color-card-bg,#161e2e);border:1px solid rgba(255,255,255,0.08);color:inherit;cursor:pointer;display:flex;align-items:center;gap:12px;">
          <i class="fa-solid fa-rotate-left" style="color:#2563eb;width:20px;text-align:center;font-size:16px;"></i>
          <div>
            <div style="font-family:'Roboto Condensed',sans-serif;font-weight:600;font-size:14.5px;">Reset to Starter Code</div>
            <div style="font-size:12px;color:#94a3b8;">Restore default template for ${config.name}</div>
          </div>
        </button>
      </div>
    `;

    if (window.BCA_UI && window.BCA_UI.BottomSheet) {
      const sheet = new window.BCA_UI.BottomSheet({
        title: 'PrimeCode Options',
        content: contentHtml
      });
      sheet.open();

      setTimeout(() => {
        // BCA Practical Templates
        const btnTemplates = document.getElementById('optBcaTemplates');
        if (btnTemplates) {
          btnTemplates.addEventListener('click', () => {
            sheet.close();
            setTimeout(openPracticalTemplatesSheet, 150);
          });
        }

        // Font size toggle
        const btnFont = document.getElementById('optFontSize');
        if (btnFont) {
          btnFont.addEventListener('click', () => {
            if (state.fontSize === '13.5px') state.fontSize = '15px';
            else if (state.fontSize === '15px') state.fontSize = '18px';
            else state.fontSize = '13.5px';

            const editor = document.getElementById('primecodeEditor');
            const lineNumbers = document.getElementById('primecodeLineNumbers');
            if (editor) editor.style.fontSize = state.fontSize;
            if (lineNumbers) lineNumbers.style.fontSize = state.fontSize;
            if (window.PrimeCodeMirror && window.PrimeCodeMirror.isReady) {
              window.PrimeCodeMirror.setFontSize(state.fontSize);
            }

            const label = document.getElementById('optCurrentFontSize');
            if (label) label.textContent = state.fontSize;
            notify(`Font size: ${state.fontSize}`, 'info');
          });
        }

        // Reset code
        const btnReset = document.getElementById('optResetCode');
        if (btnReset) {
          btnReset.addEventListener('click', () => {
            const defaultCode = STARTERS[lang] || '';
            setActiveCode(defaultCode, lang);
            saveCode(lang, defaultCode);
            notify('Reset to default starter template', 'info');
            sheet.close();
          });
        }
      }, 50);
    }
  }

  // ---- Export / Download File ----
  function exportCurrentFile() {
    triggerHaptic(12);
    const code = getActiveCode();
    const lang = state.activeLang;
    const config = LANG_CONFIG[lang] || LANG_CONFIG.python;
    const filename = lang === 'html' ? `${state.activeWebFile}.${state.activeWebFile === 'js' ? 'js' : state.activeWebFile === 'css' ? 'css' : 'html'}` : config.filename;

    try {
      const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify(`Exported ${filename} successfully!`, 'success');
    } catch (e) {
      navigator.clipboard.writeText(code);
      notify('Code copied to clipboard (download blocked)', 'info');
    }
  }

  // ---- Auto-Format Current Code ----
  function autoFormatCode() {
    triggerHaptic(12);
    const code = getActiveCode();
    if (!code) return;

    const lines = code.split('\n');
    let indentLevel = 0;
    const formatted = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) {
        formatted.push('');
        continue;
      }

      // Closing bracket reduces indent
      if (/^[}\]\)]/.test(line)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      formatted.push('  '.repeat(indentLevel) + line);

      // Opening bracket increases indent
      if (/[{\[\(]$/.test(line)) {
        indentLevel++;
      }
    }

    const formattedCode = formatted.join('\n');
    setActiveCode(formattedCode, state.activeLang);
    saveCode(state.activeLang, formattedCode);
    notify('Code formatted & indented! ✨', 'success');
  }

  // ---- Symbol Insertion at Cursor ----
  function insertSymbolAtCursor(textareaEl, symbol) {
    triggerHaptic(8);
    if (window.PrimeCodeMirror && window.PrimeCodeMirror.isReady && state.cmInitialized) {
      window.PrimeCodeMirror.insertSymbolAtCursor(symbol);
      const activeKey = state.activeLang === 'html' ? state.activeWebFile : state.activeLang;
      saveCode(activeKey, window.PrimeCodeMirror.getCode());
      return;
    }

    if (!textareaEl) return;
    textareaEl.focus();

    const start = textareaEl.selectionStart || 0;
    const end = textareaEl.selectionEnd || 0;
    const val = textareaEl.value;

    let insertText = symbol;
    let cursorOffset = symbol.length;

    if (symbol === '{ }') {
      insertText = '{\n  \n}';
      cursorOffset = 4;
    } else if (symbol === '( )') {
      insertText = '()';
      cursorOffset = 1;
    } else if (symbol === '[ ]') {
      insertText = '[]';
      cursorOffset = 1;
    } else if (symbol === '" "') {
      insertText = '""';
      cursorOffset = 1;
    } else if (symbol === "' '") {
      insertText = "''";
      cursorOffset = 1;
    } else if (symbol === 'Tab') {
      insertText = '  ';
      cursorOffset = 2;
    }

    textareaEl.value = val.substring(0, start) + insertText + val.substring(end);
    textareaEl.selectionStart = textareaEl.selectionEnd = start + cursorOffset;

    textareaEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ---- Initialize PrimeCode Event Handlers ----
  function initCodeLab() {
    // 1. Splash tap to skip
    const splashEl = document.getElementById('primecodeSplash');
    if (splashEl) {
      splashEl.addEventListener('click', () => {
        triggerHaptic(10);
        switchScreen('picker');
      });
    }

    // 2. Language Picker Back Button (returns to Study Desk)
    const pickerBackBtn = document.getElementById('primecodePickerBackBtn');
    if (pickerBackBtn) {
      pickerBackBtn.addEventListener('click', () => {
        triggerHaptic(10);
        closeCodeLab(true);
      });
    }

    // 3. Language Cards Click
    document.querySelectorAll('.primecode-lang-card').forEach(card => {
      card.addEventListener('click', () => {
        const lang = card.dataset.cardLang;
        const targetLang = lang === 'sqllab' ? 'mysql' : lang === 'webdev' ? 'html' : lang;
        openLanguage(targetLang);
      });
    });

    // 4. Request Language button
    const reqLangBtn = document.getElementById('primecodeRequestLangBtn');
    if (reqLangBtn) {
      reqLangBtn.addEventListener('click', () => {
        triggerHaptic(10);
        if (typeof window.openFeedback === 'function') window.openFeedback();
        else notify('Share requested languages in Feedback!', 'info');
      });
    }

    // 5. Open Full Compiler button
    const openAllBtn = document.getElementById('primecodeOpenAllLangsBtn');
    if (openAllBtn) {
      openAllBtn.addEventListener('click', () => {
        openLanguage('python');
      });
    }

    // 6. Workspace Header Back Button (returns to Language Picker)
    const backBtn = document.getElementById('primecodeBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        triggerHaptic(10);
        saveCode(state.activeLang === 'html' ? state.activeWebFile : state.activeLang, getActiveCode());
        switchScreen('picker');
      });
    }

    // 7. Segmented Nav Pills
    document.querySelectorAll('.primecode-segment-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        switchWorkspaceTab(pill.dataset.tab);
      });
    });

    // 8. Header Actions (Cloud export, Options menu, Desktop run)
    const exportBtn = document.getElementById('primecodeExportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportCurrentFile);

    const optionsBtn = document.getElementById('primecodeOptionsBtn');
    if (optionsBtn) optionsBtn.addEventListener('click', openOptionsMenu);

    const deskRunBtn = document.getElementById('primecodeDesktopRunBtn');
    if (deskRunBtn) {
      deskRunBtn.addEventListener('click', () => {
        if (state.interactiveSession && state.interactiveSession.active) {
          stopInteractiveExecution();
        } else {
          runPrimeCode();
        }
      });
    }

    // 9. File Bar Actions (Format, Practical Templates)
    const formatBtn = document.getElementById('primecodeFormatBtn');
    if (formatBtn) formatBtn.addEventListener('click', autoFormatCode);

    const addFileBtn = document.getElementById('primecodeAddFileBtn');
    if (addFileBtn) addFileBtn.addEventListener('click', openPracticalTemplatesSheet);

    // 10. Quick Symbols Bar
    document.querySelectorAll('.primecode-sym-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const editor = document.getElementById('primecodeEditor');
        insertSymbolAtCursor(editor, chip.dataset.sym);
      });
    });

    // 11. Code Editor Input & Keyboard Listeners
    const editor = document.getElementById('primecodeEditor');
    const lineNumbers = document.getElementById('primecodeLineNumbers');
    if (editor) {
      editor.addEventListener('input', () => {
        saveCode(state.activeLang === 'html' ? state.activeWebFile : state.activeLang, editor.value);
        updateLineNumbers(editor, lineNumbers);
      });

      editor.addEventListener('scroll', () => {
        if (lineNumbers) lineNumbers.scrollTop = editor.scrollTop;
      });

      // Keyboard enhancements: Tab key, bracket pairing
      editor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          insertSymbolAtCursor(editor, '  ');
        }
      });
    }

    // 12. Floating Action Buttons (FAB Assist, Run, Stop, Fix)
    const fabAssist = document.getElementById('primecodeFabAssist');
    if (fabAssist) fabAssist.addEventListener('click', openPracticalTemplatesSheet);

    const fabRun = document.getElementById('primecodeFabRun');
    if (fabRun) fabRun.addEventListener('click', runPrimeCode);

    const fabStop = document.getElementById('primecodeFabStop');
    if (fabStop) fabStop.addEventListener('click', stopInteractiveExecution);

    const fabFix = document.getElementById('primecodeFabFix');
    if (fabFix) fabFix.addEventListener('click', openAiFixSheet);

    // 13. Interactive Console Stdin Bar Submit
    const inputForm = document.getElementById('primecodeConsoleInputBar');
    if (inputForm) {
      inputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitInteractiveInput();
      });
    }

    const inputSubmit = document.getElementById('primecodeInteractiveSubmit');
    if (inputSubmit) {
      inputSubmit.addEventListener('click', (e) => {
        e.preventDefault();
        submitInteractiveInput();
      });
    }

    const interactiveInput = document.getElementById('primecodeInteractiveInput');
    if (interactiveInput) {
      interactiveInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitInteractiveInput();
        }
      });
      interactiveInput.addEventListener('focus', () => {
        setTimeout(syncVisualViewport, 60);
        setTimeout(syncVisualViewport, 200);
      });
      interactiveInput.addEventListener('blur', () => {
        setTimeout(syncVisualViewport, 60);
      });
    }

    // 14. Console Output Actions (Copy, Clear)
    const consoleCopy = document.getElementById('primecodeConsoleCopyBtn');
    if (consoleCopy) {
      consoleCopy.addEventListener('click', () => {
        triggerHaptic(10);
        const pre = document.getElementById('primecodeConsolePre');
        if (pre && pre.textContent) {
          navigator.clipboard.writeText(pre.textContent).then(() => {
            notify('Console output copied! 📋', 'success');
          });
        }
      });
    }

    const consoleClear = document.getElementById('primecodeConsoleClearBtn');
    if (consoleClear) {
      consoleClear.addEventListener('click', () => {
        triggerHaptic(10);
        if (state.interactiveSession && state.interactiveSession.active) {
          stopInteractiveExecution();
        }
        if (state.consoleStateByLang) {
          state.consoleStateByLang[state.activeLang] = null;
        }
        const pre = document.getElementById('primecodeConsolePre');
        if (pre) pre.innerHTML = '<span class="primecode-console-placeholder">No output yet &mdash; Run your code to see the output here.</span>';
        const badge = document.getElementById('primecodeConsoleStatusBadge');
        if (badge) badge.style.display = 'none';
        const inputBar = document.getElementById('primecodeConsoleInputBar');
        if (inputBar) inputBar.style.display = 'none';
        const floatingActions = document.getElementById('primecodeFloatingActions');
        if (floatingActions) floatingActions.classList.remove('with-input-bar');
        notify('Console cleared', 'info');
      });
    }

    // Tap anywhere in editor wrapper to focus active editor (mobile-friendly)
    const editorWrap = document.getElementById('primecodeEditorWrapper');
    if (editorWrap) {
      editorWrap.addEventListener('click', (e) => {
        if (!e.target.closest('#primecodeLineNumbers')) {
          if (window.PrimeCodeMirror && window.PrimeCodeMirror.isReady && state.cmInitialized) {
            window.PrimeCodeMirror.focus();
          } else {
            const ed = document.getElementById('primecodeEditor');
            if (ed && document.activeElement !== ed) ed.focus();
          }
        }
      });
    }

    // 15. Responsive resize & Visual Viewport handler (locks mobile keyboard jump)
    function syncVisualViewport() {
      const modal = document.getElementById('codeLabModal');
      const workspace = document.getElementById('primecodeWorkspace');
      if (modal && modal.classList.contains('open')) {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        if (window.visualViewport) {
          const vh = Math.round(window.visualViewport.height);
          modal.style.height = `${vh}px`;
          if (workspace && state.screen === 'workspace') {
            workspace.style.height = `${vh}px`;
          }
        }
        if (state.activeTab === 'console') {
          const consoleBody = document.getElementById('primecodeConsoleBody');
          if (consoleBody) {
            consoleBody.scrollTop = consoleBody.scrollHeight;
          }
        }
      }
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncVisualViewport);
      window.visualViewport.addEventListener('scroll', () => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });
    }

    window.addEventListener('primecodemirror:ready', () => {
      const codeKey = state.activeLang === 'html' ? state.activeWebFile : state.activeLang;
      const editor = document.getElementById('primecodeEditor');
      const currentCode = (editor && editor.value) ? editor.value : getSavedCode(codeKey);
      syncCodeMirror(state.activeLang, currentCode);
    });

    window.addEventListener('resize', () => {
      syncVisualViewport();
      switchWorkspaceTab(state.activeTab);
    });

    // Check hash for initial deep-link
    if (location.hash === '#primecode' || location.hash === '#codelab') {
      openCodeLab('splash');
    }
  }

  // Export functions globally
  window.openCodeLab = openCodeLab;
  window.closeCodeLab = closeCodeLab;
  window.openCodeLabRoute = openCodeLabRoute;
  window.openPrimeCodeLanguage = openLanguage;
  window.switchPrimeCodeTab = switchWorkspaceTab;
  window.runPrimeCode = runPrimeCode;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCodeLab);
  } else {
    initCodeLab();
  }

})();
