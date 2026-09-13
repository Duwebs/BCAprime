# BCAPrime

**BCAPrime** is a free, community-driven study platform built for **BCA students**. It brings your whole BCA study routine into one place — browse and share **notes & previous-year question papers (PYQs)**, organised by **college and semester**, and get help from the community when you're stuck.

Everything works in the browser and is **installable as a PWA**, so you can use it on your phone or laptop, online or offline.

> **Maintainers:** this README intentionally uses generic placeholders (`<your-project>`, `<your-domain>`) instead of production secrets. Never commit real API keys, Firebase service-account JSON, Supabase project refs, VAPID **private** keys, or personal contact details.

---

## 🚀 Features

### 📚 Study library
- **PrimeFinder — smart search** — find material by matching **College + Semester + Subject**; then filter by type (**Notes / PYQs / All**).
- **Notes & PYQ library** — vetted study material organised by college and semester.
- **Subject cards** — pin your own subjects for one-tap browsing; add custom subjects not in the list.
- **Save for later** — bookmark resources you want to keep close.
- **Offline support** — files you've already opened/downloaded stay available even without internet.

### 🙌 Community
- **Share material** — upload notes or PYQs so other students can use them (goes through admin moderation).
- **Ask seniors / Help juniors** — juniors request notes & PYQs; seniors in the same college + semester can step in and fulfill.
- **Lost & Found** — a dedicated space to report and find lost items around campus.
- **Feedback & bug reports** — report issues or suggest ideas straight from the app.

### 🔐 Accounts & security
- **Flexible sign-in** — email/password plus **Google** sign-in (Firebase Authentication).
- **Dual verification** — a hashed **6-digit OTP** *and* a verification link, both one-time-use and time-limited.
- **Branded emails** — welcome, verify, and password-reset emails sent through **Resend** with official branding (kept out of Spam).
- **Duplicate username protection** — no two students can claim the same username.
- **Account-bound college & semester** — your college + semester sync across every device you sign in with.
- **WhatsApp-style device linking** — new devices need approval from an already-approved device (with a code), so your account stays yours.
- **QR code login** — scan the desktop login QR with your phone to approve sign-in (plus an in-app QR scanner).

### 🔔 Notifications
- **Web Push** — get alerts **even when the app is closed**, with action buttons, sound, and vibration.
- **Targeted alerts** — new approved material notifies only the matching **college + semester** subscribers.
- **Admin broadcasts** — announcements sent out from the admin panel.

### 🛠 Admin panel (separate)
- **Moderation** — review, approve, or reject submitted notes/PYQs.
- **Bulk approve** — approve several resources at once (auto-notifies subscribers when targeting matches).
- **Broadcast & analytics** — send notifications and view usage/upload statistics.

### ⚙️ Platform
- **Installable PWA** — add to home screen and use like a native app.
- **Dark / light theme** — auto-flips with time of day; manual override supported.
- **What's New modal** — returning users see a summary of each new release.
- **Privacy Policy & Terms** pages included.
---

## 🧱 Tech stack

| Area | Technology |
|------|-----------|
| Frontend | Vanilla HTML/CSS/JS, Tailwind CSS + custom styles, Font Awesome |
| Authentication | Firebase Authentication (email/password + Google) |
| Database & storage | Supabase (Postgres, RLS policies, Storage) |
| Serverless (email/OTP) | Vercel Functions (Node.js) in `api/` |
| Transactional email | Resend |
| Push notifications | Web Push with VAPID keys via Supabase Edge Functions |
| Dev platform | Node.js, npm |

## 🏗 Architecture (recommended)

- **Firebase** → student sign-in (guest, email/password, Google).
- **Supabase** → resource metadata, moderation status, user profiles, device sessions, and storage of student notes/PYQs.
- **Vercel Functions** → anything that must stay server-side (temporary-password generation, OTP issue/verify, password-reset emails).
- **Supabase Edge Functions** → targeted push notifications.
---

## 🛠 Getting started (local dev)

**Prerequisites:** Node.js + npm, and accounts for Firebase, Supabase, and Vercel.

1. **Clone & install**
   ```bash
   git clone <your-repo-url>
   cd <your-project>
   npm install
   ```

2. **Firebase (student auth)** — create a project in the Firebase Console, register a web app, and paste your config into `firebase-config.js` (replace the `YOUR_...` placeholders). Enable **Email/Password** and optionally **Google** in *Authentication → Sign-in method*.

3. **Supabase (data + admin)** — open the project linked in `supabase-config.js`, then run the SQL files in this order in the **SQL Editor**:
   - `supabase-schema.sql` — core tables (resources, user_profiles, device_sessions, push_subscriptions, email_otps, qr_login_sessions, …)
   - `supabase-security-fix.sql` — hardens the DB / removes temporary open-moderation policies

4. **Admin role** — create the admin user, then set `app_metadata.role = 'admin'` (query included in `supabase-security-fix.sql`).

5. **Serverless email (Vercel)** — deploy with `npx vercel --prod` and set the environment variables listed under *Configuration & secrets* below.

6. **Push notifications (optional)** — deploy the Edge Functions (`supabase functions deploy send-push notify-seniors`), then set the VAPID **public** key. The **private** key is a server secret only — never in any browser file.

> **Local tip:** open the app as `http://localhost:<port>` (not `127.0.0.1` or a LAN IP), because OAuth doesn't reliably accept IP addresses.
---

### 🔑 Configuration & secrets

Set these as **environment variables / secrets** — never hardcode them in browser-facing files:

- **Firebase:** `FIREBASE_SERVICE_ACCOUNT_JSON` (server only)
- **Supabase:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only)
- **Email:** `RESEND_API_KEY`, `BCAPRIME_FROM_EMAIL`, `BCAPRIME_FROM_NAME`, `BCAPRIME_APP_URL`
- **Security:** `OTP_PEPPER`, `NOTIFY_SECRET` (must match `ADMIN_NOTIFY_SECRET` in `admin.js`)
- **Push:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (private = server secret only)

### 📂 Project structure

```
<your-project>/
├─ index.html          # Student app (library, finder, upload, senior help)
├─ admin.html          # Admin panel
├─ admin/              # Admin UI (css, js, service worker)
├─ api/                # Vercel serverless functions (email, OTP, password)
├─ supabase/           # SQL schema + Edge Functions (send-push, notify-seniors)
├─ analytics/          # Analytics dashboard
├─ assets/             # Logos & public images
├─ firebase-config.js  # Firebase web config (fill YOUR_... placeholders)
├─ supabase-config.js  # Supabase client config
├─ styles.css          # Main stylesheet
└─ sw.js               # Service worker (PWA + offline)
```

### 🤝 Contributing

1. Fork the repo and create a feature branch.
2. Make your changes and test locally.
3. Open a pull request describing what you changed and why.
4. Keep pull requests focused; avoid committing generated files or secrets.

> **New feature?** Add it to the **Features** section above and bump the app version in `whats-new.js` so the *What's New* modal shows it to returning users.

### 🔒 Security notes

- Never commit real credentials. The web config in `firebase-config.js` is safe to ship, but API keys are **not** security boundaries — keep authoritative rules in Supabase RLS / Firebase security rules.
- Keep the **service-role key**, **VAPID private key**, and **Firebase service-account JSON** out of the repo and off the browser entirely.
- Keep open-moderation policies off in production (see `supabase-security-fix.sql`).

### 📄 License

Include the license file that applies to your project here.

---

*Built for BCA students, by the community. Questions or ideas? Open an issue or use the in-app feedback form.*