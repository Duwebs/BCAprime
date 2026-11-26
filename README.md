<div align="center">

<img src="./og-image.png" alt="BCAPrime — The Ultimate BCA Study Ecosystem" width="100%" />

# 👑 BCAPrime
### **The Peer-to-Peer BCA Study Companion & Live Coding Ecosystem**

*Built by BCA students, for BCA students — no trackers, no paywalls, just pure academic momentum.*

[![Live App](https://img.shields.io/badge/Launch_BCAPrime-2563EB?style=for-the-badge&logo=vercel&logoColor=white)](https://bcaprime.vercel.app)
[![Version](https://img.shields.io/badge/Version-3.4.0-16A34A?style=for-the-badge)](#)
[![Stack](https://img.shields.io/badge/Stack-Supabase_%7C_Vercel_%7C_Tailwind_v4-0A0A0A?style=for-the-badge)](#tech-stack)
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
- **PrimeFinder Smart Search:** Match by College + Semester + Subject, then filter by Notes / PYQs / All.
- **Continue Reading Tracker:** Automatically remembers the exact PDF and page number you left off on so you can resume in one tap.
- **Offline Support:** Files you've opened stay available without internet via the Service Worker cache.

### 🤖 3. PrimeBuddy — Your Interactive Study Mascot

- A floating, physics-driven on-screen companion with a 3D rotating crown, free-roam drag, 4-wall ricochet fling physics, and mood reactions.
- Guides new students, highlights quick tools, and keeps study sessions engaging with smart contextual messages.
- Features a **Focus Timer**, nap mode, and auto reading-peek — long-press to access.

### 📝 4. AI-Assisted Subject Mock Tests

- Quick, exam-focused practice tests mapped to BCA subjects: **Discrete Mathematics, Automata Theory, DBMS, OOPs, Data Structures, Operating Systems**.
- Designed to test readiness before internals and externals.

### 🤝 5. Campus Community & Peer Support Hub

- **Ask a Senior:** Post doubts about subjects, minor/major projects, or NIMCET/MCA prep — seniors who have already cleared them answer directly.
- **Juniors Request Board:** Request missing notes, practical files, or specific question papers from your batch or seniors.
- **Campus Lost & Found:** Report or recover misplaced ID cards, chargers, notebooks, and campus items.

### 🔐 6. Auth & Security — 100% Supabase

- **Google & LinkedIn OAuth + Email/Password** — all powered by Supabase Auth (`supabaseClient.auth.signInWithOAuth`).
- **Dual verification** — hashed 6-digit OTP *and* a one-time verification link, both time-limited, issued via Vercel serverless functions backed by Supabase.
- **Device Linking** — WhatsApp-style: new devices need a code from an already-approved device.
- **QR Code Login** — scan the desktop QR with your phone to approve sign-in instantly. Sessions stored in Supabase.
- **Row Level Security (RLS)** — all data access is enforced at the PostgreSQL level; no client-side gates.

### 🔔 7. Web Push Notifications

- Alerts delivered **even when the app is closed**, with action buttons, sound, and vibration.
- **Targeted**: new approved material only notifies the matching college + semester subscribers.
- **Admin broadcasts** from the admin console.
- Powered by **Supabase Edge Functions** (`send-push`, `notify-seniors`, `notify-lostfound`).

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
3. **Add Your College:** Don't see your institution listed during onboarding? Submit it directly in-app for instant admin review.
4. **Report Bugs & Suggest Features:** Use the in-app ★ feedback box or open a GitHub Issue to shape upcoming releases.

---

## 🛠️ Tech Stack

| Area | Technology |
|------|-----------|
| **Frontend** | Vanilla HTML / CSS / JavaScript, Tailwind CSS v4, CodeMirror 6, Font Awesome |
| **UI System** | Custom design system (`ui/`) — PressableScale, BottomSheet, Skeleton, EmptyState, Toast |
| **Authentication** | **Supabase Auth** — email/password, Google OAuth, LinkedIn OAuth |
| **Database** | **Supabase** (PostgreSQL + Row Level Security) |
| **File Storage** | **Supabase Storage** |
| **Serverless Functions** | Vercel Functions (`api/`) — OTP issue/verify, password reset, welcome email |
| **Edge Functions** | **Supabase Edge Functions** — `send-push`, `notify-seniors`, `notify-lostfound`, `sign-resource`, `telegram-new-user` |
| **Transactional Email** | Resend |
| **Push Notifications** | Web Push + VAPID via Supabase Edge Functions |
| **Code Execution** | Multi-language compiler & interactive `stdin` console pipeline |
| **Deployment** | Vercel |

---

## 🏗 Architecture

```
Browser (PWA + Service Worker)
   │
   ├── Supabase Auth ──────────────────── All sign-in: email, Google OAuth, LinkedIn OAuth
   │
   ├── Supabase (Postgres + RLS) ──────── Notes, PYQs, profiles, colleges, device sessions,
   │   │                                  push subscriptions, QR login, OTPs
   │   └── Edge Functions ─────────────── Push notifications, resource signing,
   │       send-push / notify-seniors      Telegram admin alerts
   │       notify-lostfound / sign-resource
   │
   ├── Supabase Storage ───────────────── PDF notes, PYQ files, profile avatars
   │
   ├── Vercel Functions (api/) ─────────── OTP issue/verify, password reset,
   │   send-otp / verify-otp               Google welcome email (Resend)
   │   forgot-password / google-welcome
   │
   └── Code Execution Pipeline ─────────── Multi-language compiler (PrimeCode)
```

---

## 📦 Local Setup

**Prerequisites:** Node.js ≥ 18, `npm`, a Supabase project, and a Vercel account.

```bash
# 1. Clone the repository
git clone https://github.com/Duwebs/BCAprime.git
cd BCAprime

# 2. Install dependencies
npm install

# 3. Configure environment variables
# Copy the example file and fill in your Supabase credentials
cp .env.example .env.local

# 4. Run the development server
npm run dev
# This runs: generate-env.js → generate-sitemap.js → vercel dev
# Or serve statically for frontend-only work:
python3 -m http.server 3000
```

> **Local tip:** Always open the app at `http://localhost:<port>` (not `127.0.0.1` or a LAN IP) — Supabase OAuth redirects only work with `localhost`.

### 🔑 Required Environment Variables

Set these as **Vercel environment variables** — never hardcode them in browser-facing files:

| Variable | Used For |
|----------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL (safe to expose in browser build) |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable key (safe to expose in browser build) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase admin access (Vercel Functions) |
| `RESEND_API_KEY` | Transactional email sending |
| `BCAPRIME_FROM_EMAIL` | Sender email address |
| `BCAPRIME_APP_URL` | App base URL (for email links & redirects) |
| `OTP_PEPPER` | Hash salt for OTP security |
| `NOTIFY_SECRET` | Admin push notification auth |
| `VAPID_PUBLIC_KEY` | Web Push public key (browser-safe) |
| `VAPID_PRIVATE_KEY` | Web Push private key (server secret — never in browser) |

> There are **no Firebase variables**. Auth, storage, and all data are handled exclusively by Supabase.

### 📂 Project Structure

```
BCAprime/
├── index.html              # Main student app (library, finder, upload, community)
├── app.js                  # Core application logic
├── styles.css              # Main stylesheet
├── tailwind.css            # Tailwind CSS compiled output
├── tailwind.input.css      # Tailwind source (import root)
├── primeBuddy.js / .css    # Floating study mascot & physics
├── codelab.js / .css       # PrimeCode IDE (CodeMirror 6)
├── codemirror.js           # CodeMirror syntax engine & language packs
├── supabase-config.js      # Supabase client config (URL + anon key)
├── ui/                     # Shared design system
│   ├── config.js           # Design tokens (spacing, radius, animation, z-index)
│   ├── ui.css              # CSS custom properties
│   ├── pressable.js        # PressableScale + haptics
│   ├── bottomSheet.js      # Native-feel bottom sheet
│   ├── skeleton.js         # Shimmer loading skeletons
│   ├── emptyState.js       # Empty state component
│   └── toast.js            # Toast notification system
├── admin/                  # Admin console (HTML, JS, CSS)
├── analytics/              # Stats dashboard
├── api/                    # Vercel serverless functions
│   ├── _lib/supabaseAuth.js  # Server-side Supabase auth helpers
│   ├── send-otp.js           # OTP generation & email
│   ├── verify-otp.js         # OTP verification
│   ├── forgot-password.js    # Password reset link
│   ├── google-welcome.js     # OAuth welcome email
│   ├── resource.js           # Resource signing/fetching
│   └── generate-quiz.js      # Mock test generation
├── supabase/               # Supabase backend
│   ├── migrations/         # SQL schema migrations
│   ├── analytics-dashboard.sql
│   └── functions/          # Edge Functions
│       ├── send-push/          # Web push delivery
│       ├── notify-seniors/     # Senior notification on new requests
│       ├── notify-lostfound/   # Lost & Found alerts
│       ├── sign-resource/      # Signed storage URLs
│       └── telegram-new-user/  # Telegram admin alerts
├── lib/                    # Shared utilities
│   └── colleges.js         # Approved college constants
├── scripts/                # Build scripts
│   ├── generate-env.js     # Writes env.js from Vercel env vars
│   └── generate-sitemap.js # Generates sitemap.xml
├── public/                 # PWA icons
└── sw.js                   # Service Worker (PWA + offline caching)
```

---

## 🤝 Contributing

1. Fork the repo and create a feature branch (`git checkout -b feat/your-feature`).
2. Make your changes and test locally at `http://localhost:3000`.
3. Run `npm run build` to verify Tailwind rebuilds cleanly with no errors.
4. Open a pull request with a clear description of what changed and why.
5. Keep PRs focused — avoid committing generated build artifacts or secrets.

> **Shipping a new feature?** Update the **What's Inside** section in `README.md`, bump the version in `package.json`, and add an entry in `whats-new.js` so the *What's New* modal surfaces it to returning users. See [`AGENTS.md`](./AGENTS.md) for the full agent contribution rules.

---

## 🔒 Security Notes

- **No Firebase anywhere.** Auth, storage, and all data are handled exclusively by Supabase. `firebase-config.js` is a tombstone file left in the repo only because file deletion is unavailable in the current environment — it loads nothing.
- **Never commit real credentials.** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are publishable and safe in the browser build; `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, and `RESEND_API_KEY` are server secrets — keep them in Vercel environment variables only.
- **Authoritative access control lives in Supabase RLS policies**, not in client-side code.

---

## 📄 License

This project is source-available for educational and community use. See [`LICENSE`](./LICENSE) for details.

---

<div align="center">

*Built for BCA students, by the community.*  
Questions or ideas? Open an [Issue](https://github.com/Duwebs/BCAprime/issues) or use the in-app ★ feedback form at [bcaprime.vercel.app](https://bcaprime.vercel.app).

</div>
