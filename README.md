<div align="center">

<img src="./og-image.png" alt="BCAPrime Banner" width="100%" />

# 👑 BCAPrime
### **The Ultimate Peer-to-Peer BCA Study Companion & Live Coding Ecosystem**

*Built by BCA students, for BCA students — no trackers, no paywalls, just pure academic momentum.*

[![Live App](https://img.shields.io/badge/Launch_BCAPrime-2563EB?style=for-the-badge&logo=vercel&logoColor=white)](https://bcaprime.vercel.app)
[![Version](https://img.shields.io/badge/Version-3.4.0-16A34A?style=for-the-badge)](#)
[![Stack](https://img.shields.io/badge/Stack-Vanilla_JS_%7C_Supabase_%7C_Vercel-0A0A0A?style=for-the-badge)](#tech-stack)
[![Community](https://img.shields.io/badge/Community-Peer--Powered-F59E0B?style=for-the-badge)](#contributing)

</div>

---

## 💡 Why BCAPrime Exists

Most students visit study portals just to download a PDF before an exam and leave. **BCAPrime was built to break that one-way habit.**

BCAPrime is a **collaborative, student-driven academic ecosystem** where seniors, juniors, and classmates actively build a shared knowledge bank together. Whether you are:

- **Uploading** handwritten notes or last night's sessional paper so your juniors don't struggle,
- **Practicing** C, C++, Java, Python, PHP, SQL, and Web Dev right from your phone inside **PrimeCode**,
- **Asking seniors** for project guidance or exam strategies, or
- **Inviting your batchmates** so your entire college community grows together —

Every contribution makes the platform stronger for the next batch. **Take what helps you today, share what helps someone tomorrow.**

---

## ✨ What's Inside BCAPrime?

### 💻 1. PrimeCode — Mobile-First Syllabus IDE

> *No laptop? No problem. Write, compile, and test BCA practical programs straight from your phone or browser.*

- **Strictly Focused on BCA Core:** Dedicated environments for **Python, Java, C, C++, PHP, MySQL, HTML (Multi-file Web Workspace), and JavaScript**.
- **CodeMirror 6 Syntax Highlighting:** VS Code–style rich colour themes (dark & light), bracket pair matching, active line highlight, and indentation guides.
- **Interactive Live Console:** Real-time `stdin` prompt handling for loops and menu-driven programs (`Scanner`, `scanf`, `cin`, `input()`), with live execution control (`▶ Run` / `■ Stop`).
- **Curated BCA Lab Templates:** Ready-to-run university practical programs alongside theme-adaptive Light/Dark modes.
- **Quick-Symbol Bar:** Tap `{ }`, `( )`, `[ ]`, `;`, `" "`, and more to insert symbols at the exact cursor position — mobile keyboard friendly.

### 📚 2. Crowdsourced Notes & PYQs

- **College & Semester Personalised:** Tailored to your specific institution (including *Avviare Educational Hub*, *Glocal University*, and community-submitted colleges) across **Semesters 1 to 6**.
- **PrimeFinder Smart Search:** Match by College + Semester + Subject, then filter by Notes / PYQs.
- **Continue Reading Tracker:** Automatically remembers the exact PDF and page number you left off on so you can resume in one tap.
- **Offline Support:** Files you've opened stay available without internet.

### 🤖 3. PrimeBuddy — Your Interactive Study Mascot

- A floating, physics-driven on-screen companion with a 3D rotating crown, free-roam drag, 4-wall ricochet fling physics, and mood reactions.
- Guides new students, highlights quick tools, and keeps study sessions engaging with smart contextual messages.
- Features a **Focus Timer**, nap mode, and auto reading-peek — long-press to access.

### 📝 4. AI-Assisted Subject Mock Tests

- Quick, exam-focused practice tests mapped to BCA subjects: **Discrete Mathematics, Automata Theory, DBMS, OOPs, Data Structures, Operating Systems**.
- Designed to test readiness before internals and externals.

### 🤝 5. Campus Community & Peer Support Hub

- **Ask a Senior:** Post doubts about subjects, minor/major projects, or NIMCET/MCA prep.
- **Juniors Request Board:** Request missing notes, practical files, or specific question papers.
- **Campus Lost & Found:** Report or recover misplaced ID cards, chargers, notebooks, and campus items.

### 🔐 6. Auth & Security

- **Google OAuth + Email/Password** via Firebase Authentication.
- **Dual verification** — hashed 6-digit OTP *and* a one-time verification link, both time-limited.
- **Device Linking** — WhatsApp-style: new devices need approval from an already-approved device via a code.
- **QR Code Login** — scan the desktop QR with your phone to approve sign-in instantly.

### 🔔 7. Web Push Notifications

- Alerts delivered **even when the app is closed**, with action buttons, sound, and vibration.
- **Targeted**: new approved material only notifies the matching college + semester subscribers.
- **Admin broadcasts** from the admin console.

---

## 📸 Product Preview

<div align="center">
  <table>
    <tr>
      <td align="center"><strong>Study Desk & Continue Reading</strong></td>
      <td align="center"><strong>PrimeCode Live Compiler</strong></td>
      <td align="center"><strong>Onboarding & College Hub</strong></td>
    </tr>
    <tr>
      <td><img src="./public/screenshots/study-desk.png" alt="Study Desk" width="260" /></td>
      <td><img src="./public/screenshots/primecode.png" alt="PrimeCode IDE" width="260" /></td>
      <td><img src="./public/screenshots/onboarding.png" alt="Onboarding" width="260" /></td>
    </tr>
  </table>
</div>

---

## 🚀 How Every Student Can Contribute

BCAPrime grows when students treat it as **their own community**:

1. **Upload Study Material:** Share clean PDFs, unit notes, lab manuals, or external PYQs for your semester.
2. **Invite Your Classmates:** Share [bcaprime.vercel.app](https://bcaprime.vercel.app) in your college WhatsApp/Telegram groups — more peers = faster doubt solving and more notes for everyone.
3. **Add Your College:** Don't see your institution listed during onboarding? Submit it directly in-app for instant review.
4. **Report Bugs & Suggest Features:** Use the in-app ★ feedback box or open a GitHub Issue to shape upcoming releases.

---

## 🛠️ Tech Stack

| Area | Technology |
|------|-----------|
| **Frontend** | Vanilla HTML / CSS / JavaScript, Tailwind CSS v4, CodeMirror 6, Font Awesome |
| **UI System** | Custom design system (`ui/`) — PressableScale, BottomSheet, Skeleton, EmptyState, Toast |
| **Authentication** | Firebase Authentication (email/password + Google OAuth) |
| **Database & Storage** | Supabase (PostgreSQL, Row Level Security, Storage) |
| **Serverless (email/OTP)** | Vercel Functions (Node.js) in `api/` |
| **Transactional Email** | Resend |
| **Push Notifications** | Web Push + VAPID via Supabase Edge Functions |
| **Code Execution** | Multi-language compiler & interactive `stdin` console pipeline |
| **Deployment** | Vercel |

---

## 🏗 Architecture

```
Browser (PWA)
   │
   ├── Firebase Auth ──────────────────── Student sign-in (email, Google, guest)
   │
   ├── Supabase (Postgres + RLS) ─────── Notes, PYQs, profiles, colleges, sessions
   │   └── Edge Functions ──────────────── Targeted push notifications
   │
   ├── Vercel Functions (api/) ─────────── OTP issue/verify, password reset, emails
   │
   └── Code Execution Pipeline ─────────── Multi-language compiler (PrimeCode)
```

---

## 📦 Local Setup

**Prerequisites:** Node.js ≥ 18, `npm`, accounts on Firebase, Supabase, and Vercel.

```bash
# 1. Clone the repository
git clone https://github.com/Duwebs/BCAprime.git
cd BCAprime

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Fill in your Supabase URL, Anon Key, Firebase config, and compiler endpoint

# 4. Run the development server (Vercel CLI handles serverless functions)
npx vercel dev
# Or serve statically for frontend-only work:
python3 -m http.server 3000
```

> **Local tip:** Always open the app at `http://localhost:<port>` (not `127.0.0.1` or a LAN IP) — OAuth providers don't reliably accept raw IP addresses.

### 🔑 Required Environment Variables

Set these as **Vercel environment variables** — never hardcode them in browser-facing files:

| Variable | Used For |
|----------|----------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase admin access |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin SDK (server only) |
| `RESEND_API_KEY` | Transactional email sending |
| `BCAPRIME_FROM_EMAIL` | Sender email address |
| `BCAPRIME_APP_URL` | App base URL (for email links) |
| `OTP_PEPPER` | Hash salt for OTP security |
| `NOTIFY_SECRET` | Admin push notification auth |
| `VAPID_PUBLIC_KEY` | Web Push (browser-safe) |
| `VAPID_PRIVATE_KEY` | Web Push (server secret only) |

### 📂 Project Structure

```
BCAprime/
├── index.html              # Main student app (library, finder, upload, community)
├── app.js                  # Core application logic
├── styles.css              # Main stylesheet
├── tailwind.css            # Tailwind CSS compiled output
├── primeBuddy.js / .css    # Floating study mascot
├── codelab.js / .css       # PrimeCode IDE (CodeMirror 6)
├── codemirror.js           # CodeMirror syntax engine
├── ui/                     # Shared design system (pressable, bottomSheet, skeleton…)
├── admin/                  # Admin console (HTML, JS, CSS)
├── analytics/              # Stats dashboard
├── api/                    # Vercel serverless functions (email, OTP, password)
├── supabase/               # SQL schema + Edge Functions
├── lib/                    # Shared utilities (colleges, subjects…)
├── public/                 # PWA icons
├── firebase-config.js      # Firebase web config (fill YOUR_… placeholders)
├── supabase-config.js      # Supabase client config
└── sw.js                   # Service Worker (PWA + offline caching)
```

---

## 🤝 Contributing

1. Fork the repo and create a feature branch (`git checkout -b feat/your-feature`).
2. Make your changes and test locally at `http://localhost:3000`.
3. Run `npm run build` to verify Tailwind rebuilds cleanly with no errors.
4. Open a pull request with a clear description of what you changed and why.
5. Keep PRs focused — avoid committing generated build artifacts or secrets.

> **Adding a new feature?** Update the **What's Inside** section above and bump the version in `package.json` + `whats-new.js` so the *What's New* modal surfaces it to returning users.

---

## 🔒 Security Notes

- **Never commit real credentials.** The Firebase web config (`firebase-config.js`) is intentionally browser-safe; Supabase and VAPID server keys are **not** — keep them in environment variables only.
- Authoritative access control lives in **Supabase RLS policies** and **Firebase Security Rules**, not in client-side code.
- Keep the **service-role key**, **VAPID private key**, and **Firebase service-account JSON** out of the repository entirely.

---

## 📄 License

This project is source-available for educational and community use. See [`LICENSE`](./LICENSE) for details.

---

<div align="center">

*Built for BCA students, by the community.*  
Questions or ideas? Open an [Issue](https://github.com/Duwebs/BCAprime/issues) or use the in-app ★ feedback form at [bcaprime.vercel.app](https://bcaprime.vercel.app).

</div>
