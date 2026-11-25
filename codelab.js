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
    sqlJsLoading: false
  };

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

  // Mascot Controller
  function setPrimeBuddyVisible(visible) {
    const buddyEl = document.querySelector('.prime-buddy-wrap') || document.getElementById('primeBuddy');
    if (buddyEl) {
      if (visible) {
        buddyEl.style.removeProperty('display');
        buddyEl.style.removeProperty('visibility');
        buddyEl.style.removeProperty('opacity');
      } else {
        buddyEl.style.setProperty('display', 'none', 'important');
        buddyEl.style.setProperty('visibility', 'hidden', 'important');
        buddyEl.style.setProperty('opacity', '0', 'important');
      }
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

      // Auto transition after 1.2s
      state.splashTimer = setTimeout(() => {
        if (state.screen === 'splash') {
          if (splashEl) {
            splashEl.classList.add('fade-out');
            setTimeout(() => {
              if (state.screen === 'splash') {
                document.body.classList.remove('primecode-splash-active');
                setPrimeBuddyVisible(true);
                switchScreen('picker');
              }
            }, 240);
          } else {
            document.body.classList.remove('primecode-splash-active');
            setPrimeBuddyVisible(true);
            switchScreen('picker');
          }
        }
      }, 1200);
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
    }
  }

  // Open & Close PrimeCode Modal
  function openCodeLab(directScreen = 'splash') {
    triggerHaptic(14);
    const modal = document.getElementById('codeLabModal');
    if (!modal) return;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setPrimeBuddyVisible(false);

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

    // 1. Configure Segmented Pill Switcher
    const pillCode = document.getElementById('primecodeTabCode');
    const pillConsole = document.getElementById('primecodeTabConsole');
    const pillIo = document.getElementById('primecodeTabIo');
    const pillPreview = document.getElementById('primecodeTabPreview');

    if (pillCode) pillCode.style.display = 'inline-flex';

    if (langKey === 'html') {
      if (pillConsole) pillConsole.style.display = 'none';
      if (pillIo) pillIo.style.display = 'none';
      if (pillPreview) pillPreview.style.display = 'inline-flex';
    } else if (langKey === 'mysql') {
      if (pillConsole) pillConsole.style.display = 'none';
      if (pillIo) pillIo.style.display = 'inline-flex';
      if (pillPreview) pillPreview.style.display = 'none';
    } else {
      // Compiler (python, java, c, cpp, php, javascript)
      if (pillConsole) pillConsole.style.display = 'inline-flex';
      if (pillIo) pillIo.style.display = 'inline-flex';
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

    // 3. Load Code into Editor
    const editor = document.getElementById('primecodeEditor');
    const lineNumbers = document.getElementById('primecodeLineNumbers');
    if (editor) {
      const codeKey = langKey === 'html' ? 'html' : langKey;
      editor.value = getSavedCode(codeKey);
      editor.style.fontSize = state.fontSize;
      if (lineNumbers) {
        lineNumbers.style.fontSize = state.fontSize;
        updateLineNumbers(editor, lineNumbers);
      }
    }

    // 4. Reset Output Badges & Bodies
    const consoleBadge = document.getElementById('primecodeConsoleStatusBadge');
    if (consoleBadge) consoleBadge.style.display = 'none';

    const ioBadge = document.getElementById('primecodeIoStatusBadge');
    if (ioBadge) ioBadge.style.display = 'none';

    const ioEmpty = document.getElementById('primecodeIoEmptyState');
    if (ioEmpty) ioEmpty.style.display = 'flex';

    const ioBody = document.getElementById('primecodeIoOutputBody');
    if (ioBody) ioBody.style.display = 'none';

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

    const isDesktop = window.innerWidth >= 768;
    const editorPane = document.getElementById('primecodePaneEditor');
    const outputPane = document.getElementById('primecodePaneOutput');
    const consoleView = document.getElementById('primecodeConsoleView');
    const ioView = document.getElementById('primecodeIoView');
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
        if (ioView) ioView.style.display = tab === 'io' ? 'flex' : 'none';
        if (previewView) previewView.style.display = tab === 'preview' ? 'flex' : 'none';
      }
    } else {
      // Desktop View (Split 2-Pane: Editor always visible on left)
      if (editorPane) editorPane.style.display = 'flex';
      if (outputPane) outputPane.style.display = 'flex';

      if (state.activeLang === 'html') {
        if (consoleView) consoleView.style.display = 'none';
        if (ioView) ioView.style.display = 'none';
        if (previewView) previewView.style.display = 'flex';
      } else if (state.activeLang === 'mysql') {
        if (consoleView) consoleView.style.display = 'none';
        if (ioView) ioView.style.display = 'flex';
        if (previewView) previewView.style.display = 'none';
      } else {
        // Compiler languages
        if (tab === 'io') {
          if (consoleView) consoleView.style.display = 'none';
          if (ioView) ioView.style.display = 'flex';
          if (previewView) previewView.style.display = 'none';
        } else {
          if (consoleView) consoleView.style.display = 'flex';
          if (ioView) ioView.style.display = 'none';
          if (previewView) previewView.style.display = 'none';
        }
      }
    }
  }

  // ---- HTML Multi-File Switching ----
  function switchWebFile(fileKey) {
    triggerHaptic(10);
    const editor = document.getElementById('primecodeEditor');
    if (editor) {
      // Save previous file
      saveCode(state.activeWebFile, editor.value);
      state.activeWebFile = fileKey;
      editor.value = getSavedCode(fileKey);
      const lineNumbers = document.getElementById('primecodeLineNumbers');
      updateLineNumbers(editor, lineNumbers);
    }

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
      saveCode(state.activeWebFile, editor.value);
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
      const query = editor.value.trim();
      if (!query) {
        notify('Please enter a SQL query', 'info');
        return;
      }
      saveCode('mysql', query);

      if (!state.sqlDb) {
        await initSqlDatabase();
      }

      const startTime = performance.now();
      const ioStatusBadge = document.getElementById('primecodeIoStatusBadge');
      const ioStatusText = document.getElementById('primecodeIoStatusText');
      const ioEmpty = document.getElementById('primecodeIoEmptyState');
      const ioBody = document.getElementById('primecodeIoOutputBody');
      const ioPre = document.getElementById('primecodeIoOutputPre');

      try {
        if (state.sqlDb) {
          const results = state.sqlDb.exec(query);
          const elapsed = (performance.now() - startTime).toFixed(1);

          if (!results || results.length === 0) {
            const tableText = 'Query executed successfully. (0 rows returned)';
            if (ioPre) ioPre.textContent = tableText;
            if (ioStatusText) ioStatusText.textContent = `Success · ${elapsed} ms`;
            if (ioStatusBadge) {
              ioStatusBadge.className = 'primecode-status-badge success';
              ioStatusBadge.style.display = 'inline-flex';
            }
          } else {
            const first = results[0];
            const tableText = formatSqlToAsciiTable(first.columns, first.values);
            if (ioPre) ioPre.textContent = tableText;
            if (ioStatusText) ioStatusText.textContent = `Success · ${elapsed} ms`;
            if (ioStatusBadge) {
              ioStatusBadge.className = 'primecode-status-badge success';
              ioStatusBadge.style.display = 'inline-flex';
            }
          }
          if (ioEmpty) ioEmpty.style.display = 'none';
          if (ioBody) ioBody.style.display = 'block';
          switchWorkspaceTab('io');
          notify('SQL query executed successfully!', 'success');
        } else {
          if (ioPre) ioPre.textContent = `-- SQLite engine ready. Sample table: students (id, name, semester, cgpa)\n${query}`;
          if (ioEmpty) ioEmpty.style.display = 'none';
          if (ioBody) ioBody.style.display = 'block';
          switchWorkspaceTab('io');
        }
      } catch (err) {
        const elapsed = (performance.now() - startTime).toFixed(1);
        if (ioPre) ioPre.textContent = `SQL Error: ${err.message || String(err)}`;
        if (ioStatusText) ioStatusText.textContent = `Error · ${elapsed} ms`;
        if (ioStatusBadge) {
          ioStatusBadge.className = 'primecode-status-badge error';
          ioStatusBadge.style.display = 'inline-flex';
        }
        if (ioEmpty) ioEmpty.style.display = 'none';
        if (ioBody) ioBody.style.display = 'block';
        switchWorkspaceTab('io');
        notify('SQL syntax error', 'error');
      }
      return;
    }

    // === 3. COMPILER LANGUAGES (Java, Python, C, C++, PHP, JavaScript) ===
    const code = editor.value;
    const stdinInput = document.getElementById('primecodeIoInput');
    const stdin = stdinInput ? stdinInput.value : '';
    const hasStdin = stdin.trim().length > 0;

    saveCode(lang, code);

    // Smart Input Prompt Detection:
    const inputCheck = detectInputCalls(code);
    if (inputCheck.needsInput && !hasStdin && !state.stdinWarnedOnce) {
      state.stdinWarnedOnce = true;
      triggerHaptic(18);

      switchWorkspaceTab('io');
      if (stdinInput) {
        stdinInput.placeholder = `Enter program inputs here (one per line, e.g. for ${inputCheck.keyword})...`;
        stdinInput.focus();
      }
      notify(`Input Required: Enter values for ${inputCheck.keyword} in the INPUT box and tap ▶ Run`, 'info');
      return;
    }

    state.stdinWarnedOnce = false;
    state.isExecuting = true;

    // UI Badges & Buttons state
    const fabRun = document.getElementById('primecodeFabRun');
    const deskRun = document.getElementById('primecodeDesktopRunBtn');
    const consoleBadge = document.getElementById('primecodeConsoleStatusBadge');
    const consoleStatusText = document.getElementById('primecodeConsoleStatusText');
    const consolePre = document.getElementById('primecodeConsolePre');

    const ioBadge = document.getElementById('primecodeIoStatusBadge');
    const ioStatusText = document.getElementById('primecodeIoStatusText');
    const ioEmpty = document.getElementById('primecodeIoEmptyState');
    const ioBody = document.getElementById('primecodeIoOutputBody');
    const ioPre = document.getElementById('primecodeIoOutputPre');

    if (fabRun) fabRun.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Running...</span>';
    if (deskRun) deskRun.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Running...</span>';

    if (consoleStatusText) consoleStatusText.textContent = 'Running...';
    if (consoleBadge) {
      consoleBadge.className = 'primecode-status-badge running';
      consoleBadge.style.display = 'inline-flex';
    }
    if (ioStatusText) ioStatusText.textContent = 'Running...';
    if (ioBadge) {
      ioBadge.className = 'primecode-status-badge running';
      ioBadge.style.display = 'inline-flex';
    }

    if (consolePre) consolePre.textContent = 'Connecting to execution engine...\n';

    // Switch to console view on run
    switchWorkspaceTab('console');

    const startTime = performance.now();

    try {
      // Smart Java filename resolution
      let javaFileName = 'Main.java';
      if (lang === 'java') {
        const javaClassMatch = code.match(/public\s+class\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
        if (javaClassMatch && javaClassMatch[1]) {
          javaFileName = `${javaClassMatch[1]}.java`;
        }
      }

      let executionResult = null;

      // 1. Primary Execution Engine: Wandbox (Fast, robust, full stdin support)
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
          body: JSON.stringify(wandboxPayload)
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
        console.warn('[PrimeCode] Wandbox runner error, attempting fallback:', err);
      }

      // 2. Secondary Fallback: Piston API
      if (!executionResult) {
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
            })
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
          console.warn('[PrimeCode] Secondary Piston fallback failed:', err);
        }
      }

      const elapsed = Math.round(performance.now() - startTime);

      if (executionResult) {
        const isSuccess = executionResult.exitCode === 0 && !executionResult.stderr;
        let outText = '';

        if (executionResult.stdout) {
          outText += executionResult.stdout;
        }
        if (executionResult.stderr) {
          if (outText) outText += '\n--- Error / Stderr ---\n';
          outText += executionResult.stderr;
        }
        if (!outText) {
          outText = isSuccess ? 'Program completed with no output (exit code 0).' : `Process exited with code ${executionResult.exitCode}.`;
        }

        // Render into both Console and I/O outputs
        if (consolePre) consolePre.textContent = outText;
        if (ioPre) ioPre.textContent = outText;
        if (ioEmpty) ioEmpty.style.display = 'none';
        if (ioBody) ioBody.style.display = 'block';

        const badgeClass = isSuccess ? 'primecode-status-badge success' : 'primecode-status-badge error';
        const badgeText = isSuccess ? `Success · ${elapsed} ms` : `Exit code ${executionResult.exitCode} · ${elapsed} ms`;
        const iconHtml = isSuccess ? '<i class="fa-solid fa-check"></i> ' : '<i class="fa-solid fa-circle-exclamation"></i> ';

        if (consoleStatusText) consoleStatusText.innerHTML = `${iconHtml}${badgeText}`;
        if (consoleBadge) {
          consoleBadge.className = badgeClass;
          consoleBadge.style.display = 'inline-flex';
        }

        if (ioStatusText) ioStatusText.innerHTML = `${iconHtml}${badgeText}`;
        if (ioBadge) {
          ioBadge.className = badgeClass;
          ioBadge.style.display = 'inline-flex';
        }

        if (isSuccess) {
          notify('Code executed successfully!', 'success');
        } else {
          notify('Program exited with error', 'error');
        }
      } else {
        const fallbackMsg = 'Execution service is unreachable. Please verify your internet connection.';
        if (consolePre) consolePre.textContent = fallbackMsg;
        if (ioPre) ioPre.textContent = fallbackMsg;
        if (ioEmpty) ioEmpty.style.display = 'none';
        if (ioBody) ioBody.style.display = 'block';
      }
    } catch (err) {
      console.error('[PrimeCode] Run error:', err);
      const errMsg = `Execution failed: ${err.message || String(err)}`;
      if (consolePre) consolePre.textContent = errMsg;
      if (ioPre) ioPre.textContent = errMsg;
      if (ioEmpty) ioEmpty.style.display = 'none';
      if (ioBody) ioBody.style.display = 'block';
    } finally {
      state.isExecuting = false;
      if (fabRun) fabRun.innerHTML = '<i class="fa-solid fa-play"></i> <span>Run</span>';
      if (deskRun) deskRun.innerHTML = '<i class="fa-solid fa-play"></i> <span>Run</span>';
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
              const editor = document.getElementById('primecodeEditor');
              if (editor) {
                editor.value = chosen.code;
                saveCode(lang, chosen.code);
                const lineNumbers = document.getElementById('primecodeLineNumbers');
                updateLineNumbers(editor, lineNumbers);
                notify(`Loaded: ${chosen.name}`, 'success');
              }
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
          <i class="fa-solid fa-book-open" style="color:#38bdf8;width:20px;text-align:center;"></i>
          <div>
            <div style="font-family:\'Roboto Condensed\',sans-serif;font-weight:600;font-size:14.5px;">BCA Practical Templates</div>
            <div style="font-size:12px;color:#94a3b8;">Curated university practical programs</div>
          </div>
        </button>

        <button type="button" id="optResetCode" class="bca-pressable"
          style="width:100%;text-align:left;padding:14px 16px;border-radius:12px;background:var(--ui-color-card-bg,#161e2e);border:1px solid rgba(255,255,255,0.08);color:inherit;cursor:pointer;display:flex;align-items:center;gap:12px;">
          <i class="fa-solid fa-rotate-left" style="color:#f59e0b;width:20px;text-align:center;"></i>
          <div>
            <div style="font-family:\'Roboto Condensed\',sans-serif;font-weight:600;font-size:14.5px;">Reset to Starter Code</div>
            <div style="font-size:12px;color:#94a3b8;">Restore default template for ${config.name}</div>
          </div>
        </button>

        <button type="button" id="optFontSize" class="bca-pressable"
          style="width:100%;text-align:left;padding:14px 16px;border-radius:12px;background:var(--ui-color-card-bg,#161e2e);border:1px solid rgba(255,255,255,0.08);color:inherit;cursor:pointer;display:flex;align-items:center;gap:12px;">
          <i class="fa-solid fa-text-height" style="color:#a855f7;width:20px;text-align:center;"></i>
          <div>
            <div style="font-family:\'Roboto Condensed\',sans-serif;font-weight:600;font-size:14.5px;">Font Size: <span id="optCurrentFontSize">${state.fontSize}</span></div>
            <div style="font-size:12px;color:#94a3b8;">Tap to toggle (13.5px / 15px / 18px)</div>
          </div>
        </button>

        <button type="button" id="optCopyCode" class="bca-pressable"
          style="width:100%;text-align:left;padding:14px 16px;border-radius:12px;background:var(--ui-color-card-bg,#161e2e);border:1px solid rgba(255,255,255,0.08);color:inherit;cursor:pointer;display:flex;align-items:center;gap:12px;">
          <i class="fa-regular fa-copy" style="color:#22c55e;width:20px;text-align:center;"></i>
          <div>
            <div style="font-family:\'Roboto Condensed\',sans-serif;font-weight:600;font-size:14.5px;">Copy All Code</div>
            <div style="font-size:12px;color:#94a3b8;">Copy current file to clipboard</div>
          </div>
        </button>

        <button type="button" id="optExportFile" class="bca-pressable"
          style="width:100%;text-align:left;padding:14px 16px;border-radius:12px;background:var(--ui-color-card-bg,#161e2e);border:1px solid rgba(255,255,255,0.08);color:inherit;cursor:pointer;display:flex;align-items:center;gap:12px;">
          <i class="fa-solid fa-download" style="color:#2563eb;width:20px;text-align:center;"></i>
          <div>
            <div style="font-family:\'Roboto Condensed\',sans-serif;font-weight:600;font-size:14.5px;">Export / Download File</div>
            <div style="font-size:12px;color:#94a3b8;">Save ${config.filename} to device</div>
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

        // Reset code
        const btnReset = document.getElementById('optResetCode');
        if (btnReset) {
          btnReset.addEventListener('click', () => {
            const editor = document.getElementById('primecodeEditor');
            if (editor) {
              const defaultCode = STARTERS[lang] || '';
              editor.value = defaultCode;
              saveCode(lang, defaultCode);
              const lineNumbers = document.getElementById('primecodeLineNumbers');
              updateLineNumbers(editor, lineNumbers);
              notify('Reset to default starter template', 'info');
            }
            sheet.close();
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

            const label = document.getElementById('optCurrentFontSize');
            if (label) label.textContent = state.fontSize;
            notify(`Font size: ${state.fontSize}`, 'info');
          });
        }

        // Copy code
        const btnCopy = document.getElementById('optCopyCode');
        if (btnCopy) {
          btnCopy.addEventListener('click', () => {
            const editor = document.getElementById('primecodeEditor');
            if (editor) {
              navigator.clipboard.writeText(editor.value).then(() => {
                notify('Code copied to clipboard! 📋', 'success');
              });
            }
            sheet.close();
          });
        }

        // Export file
        const btnExport = document.getElementById('optExportFile');
        if (btnExport) {
          btnExport.addEventListener('click', () => {
            sheet.close();
            exportCurrentFile();
          });
        }
      }, 50);
    }
  }

  // ---- Export / Download File ----
  function exportCurrentFile() {
    triggerHaptic(12);
    const editor = document.getElementById('primecodeEditor');
    if (!editor) return;

    const lang = state.activeLang;
    const config = LANG_CONFIG[lang] || LANG_CONFIG.python;
    const filename = lang === 'html' ? `${state.activeWebFile}.${state.activeWebFile === 'js' ? 'js' : state.activeWebFile === 'css' ? 'css' : 'html'}` : config.filename;

    try {
      const blob = new Blob([editor.value], { type: 'text/plain;charset=utf-8' });
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
      navigator.clipboard.writeText(editor.value);
      notify('Code copied to clipboard (download blocked)', 'info');
    }
  }

  // ---- Auto-Format Current Code ----
  function autoFormatCode() {
    triggerHaptic(12);
    const editor = document.getElementById('primecodeEditor');
    if (!editor) return;

    const code = editor.value;
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

    editor.value = formatted.join('\n');
    saveCode(state.activeLang, editor.value);
    const lineNumbers = document.getElementById('primecodeLineNumbers');
    updateLineNumbers(editor, lineNumbers);
    notify('Code formatted & indented! ✨', 'success');
  }

  // ---- Symbol Insertion at Cursor ----
  function insertSymbolAtCursor(textareaEl, symbol) {
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
    triggerHaptic(10);
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
        const editor = document.getElementById('primecodeEditor');
        if (editor) saveCode(state.activeLang, editor.value);
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
    if (deskRunBtn) deskRunBtn.addEventListener('click', runPrimeCode);

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
        state.stdinWarnedOnce = false;
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

    // 12. Floating Action Buttons (FAB Assist & Run)
    const fabAssist = document.getElementById('primecodeFabAssist');
    if (fabAssist) fabAssist.addEventListener('click', openPracticalTemplatesSheet);

    const fabRun = document.getElementById('primecodeFabRun');
    if (fabRun) fabRun.addEventListener('click', runPrimeCode);

    // 13. Console Output Actions (Copy, Clear)
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
        const pre = document.getElementById('primecodeConsolePre');
        if (pre) pre.innerHTML = '<span class="primecode-console-placeholder">Console cleared. Press \'▶ Run\' to execute.</span>';
        const badge = document.getElementById('primecodeConsoleStatusBadge');
        if (badge) badge.style.display = 'none';
        notify('Console cleared', 'info');
      });
    }

    // 14. I/O Output Actions (Copy)
    const ioCopy = document.getElementById('primecodeIoCopyBtn');
    if (ioCopy) {
      ioCopy.addEventListener('click', () => {
        triggerHaptic(10);
        const pre = document.getElementById('primecodeIoOutputPre');
        if (pre && pre.textContent) {
          navigator.clipboard.writeText(pre.textContent).then(() => {
            notify('Output copied to clipboard! 📋', 'success');
          });
        }
      });
    }

    // 15. Responsive resize handler (sync split pane)
    window.addEventListener('resize', () => {
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
