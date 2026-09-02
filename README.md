# BCAprime
BCAprime Web App Study Platform.

## PWA install

The student library is installable as a PWA. Serve the project over HTTPS in production, or use `http://localhost` during development; service workers do not run from `file://` pages. On a supported browser, use the **Install app** button when it appears, or the browser's install option in the address bar/menu.

## Firebase setup (student authentication)

The student app, `index.html`, uses **Firebase Authentication** for login/signup (email/password, plus Google and Apple via popup). Supabase still handles uploads/downloads and the resource library.

1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com).
2. Go to **Project settings > Your apps > Web app**, register the web app, and copy the `firebaseConfig` values.
3. Paste those values into `firebase-config.js` (replace the `YOUR_...` placeholders for `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, and `appId`).
4. In **Authentication > Sign-in method**, enable **Email/Password**, and optionally **Google** and **Apple**.
5. In **Authentication > Settings > Authorized domains**, add the domain your app runs on (e.g. `bcaprime.vercel.app` or `localhost`). Entries are bare hostnames (no scheme, no port). The list is pre-populated with `localhost`, so during local development always open the app as `http://localhost:5501` — do **not** use `http://127.0.0.1:5501` or a LAN IP like `192.168.x.x`, because IP addresses are not reliably accepted for OAuth operations.
6. Reload `index.html` — login/signup now uses Firebase. While the placeholders are unfilled, the app shows “Firebase is not configured.”

> **If you see “This domain is not authorized for OAuth operations” when using Google/Apple sign-in (`auth/unauthorized-domain`):** the hostname in the address bar is missing from the Authorized domains list. Fix it by (a) switching to `http://localhost:5501` when testing locally, or (b) adding your custom/preview hostname under *Authentication → Settings → Authorized domains*, or (c) using an HTTPS tunnel (e.g. ngrok/cloudflared) with its hostname added when you must test from another device.

Note: The admin page (`admin.html`) uses **Supabase auth only** with an admin role (`app_metadata.role = 'admin'`). The old direct password bypass has been removed for security. Run `supabase-security-fix.sql` once to harden the database policies.

## Supabase setup

1. Open the Supabase project linked in `supabase-config.js`.
2. Open **SQL Editor** and run the complete contents of `supabase-schema.sql`.
3. **Run `supabase-security-fix.sql` too** — ye temporary open-moderation policies hata kar database lock karta hai.
4. Add approved rows to `public.resources` with a `file_url` pointing to your PDF storage.
5. Open `index.html` to verify approved rows appear in the student library.
6. In Supabase Authentication, create or confirm the admin user, then set its `app_metadata` to include `{ "role": "admin" }` (query is given inside `supabase-security-fix.sql`).
7. Open `admin.html`, sign in with that admin account, and verify pending uploads can be reviewed.

The admin page includes Supabase email/password login and signup. Signup creates an account, but only accounts with `app_metadata.role` set to `admin` can access the review dashboard or approve resources.

### Recommended architecture
- Use Firebase for: student login/signup (guest + email/password + Google/Apple).
- Use Supabase for: resource metadata, row approval status, admin dashboard, and user roles.
- Use Supabase Storage for: student notes and PYQ PDFs. This is the simplest production setup for this app.
- If you want a dedicated CDN or faster file delivery, Cloudinary or another file-hosting service can be used for the actual PDFs, while Supabase still stores the metadata.
- Blaze is optional but not required for this project; Supabase already covers the admin and database needs well.

The publishable key is safe for browser use. Never place a `service_role` key in either HTML file.

## Push notifications (new material & broadcast alerts)

Students can opt in from the bell icon (or the "Never miss an update" banner) and then receive Web Push notifications **even when the app is closed** — with the BCAPrime logo, action buttons ("Open now" / "Later"), vibration, and the system alert sound. While the app is open, a premium in-app toast with a soft chime plays instead.

### One-time setup

1. **Database** — run the `push_subscriptions` section of `supabase-schema.sql` in the Supabase SQL Editor (it creates the table + RLS policies).
2. **Install the Supabase CLI**: <https://supabase.com/docs/guides/cli/getting-started>, then `supabase login`.
3. **Link the project**: `supabase link --project-ref kjesjaakjddfxykisssh`
4. **Set the function secrets** (the VAPID keys are already generated — see below):

   ```
   supabase secrets set VAPID_PUBLIC_KEY=<apni public key — supabase-config.js mein hai>
   supabase secrets set VAPID_PRIVATE_KEY=<apni private key — vapid-keys-PRIVATE.txt mein>
   supabase secrets set VAPID_SUBJECT="mailto:admin@bcaprime.com"
   supabase secrets set NOTIFY_SECRET=<naya secret — admin.js ke ADMIN_NOTIFY_SECRET se same>
   ```

   > Change `NOTIFY_SECRET` to any long random string — but use the **same value** as `ADMIN_NOTIFY_SECRET` in `admin.js`, otherwise the admin page cannot authorise sends. The private key must never be placed in any browser-facing file.
5. **Deploy the function**:

   ```
   supabase functions deploy send-push
   ```

### Sending notifications

- **Manual broadcast**: open `admin.html` → *Send notification* panel → title + message, aur (optional) college + semester choose karo → **Send notification**. College/semester chhoda to sabko jaata hai.
## Authentication & transactional email (modern UX + anti-spam)

BCAPrime now uses **Vercel serverless functions** (Node.js, in `api/`) for everything that
must stay server-side — generating & emailing temporary passwords, issuing and verifying
6-digit OTPs, and sending **branded** verification / welcome / reset emails. Email is sent
through **Resend** so messages arrive in the inbox with the official BCAPrime logo instead of
the plain, generic Firebase template that was landing in Spam.

### What's covered

1. **Confirm Password** — all sign-up forms (landing gate, "sign up to continue" modal, and
   profile modal) now require re-typing the password and validate a match before submitting.
2. **Google sign-in automation** — after "Continue with Google", the backend verifies the
   account is Google-federated, generates a secure temporary password, sets it with the Admin
   SDK, and emails it (with the user's Name + Email and a prominent **"Set your own password"**
   reset button). This is idempotent and never re-emails returning users.
3. **Branded, inbox-safe emails** — one shared HTML template: clean table layout, `BCAPrime Team`
   sender name, absolute HTTPS logo URL, plain-text fallback, and a full footer.
4. **Dual verification — link AND 6-digit OTP** — the verification screen offers both. Codes are
   numeric, hashed server-side, expire in 12 minutes, and are one-time-use.
5. **Modern OTP popup** — on sign-up the user stays signed in and a sleek modal pops up instantly
   with 6 auto-focusing digit boxes (backspace navigation, paste-to-split, and auto-submit on the
   last digit), a resend countdown, and a fallback "use the link instead" option.

### New files

- `api/_lib/cors.js` — CORS helper + JSON responder + `withCors` wrapper.
- `api/_lib/firebaseAdmin.js` — lazily initialised Firebase Admin (service-account JSON).
- `api/_lib/resend.js` — thin Resend client wrapper.
- `api/_lib/email.js` — the single branded HTML email template + sender helper.
- `api/_lib/otp.js` — numeric OTP generation, HMAC hashing, store + constant-time verify.
- `api/google-welcome.js` — temp-password + welcome/reset email for Google sign-in.
- `api/send-otp.js` — issue + email a hashed 6-digit OTP.
- `api/verify-otp.js` — validate OTP; server-side only flips `emailVerified`.
- `api/forgot-password.js` — branded password-reset link email.

### Deployment (Vercel)

1. Add a **verified sending domain** in your email provider (see DNS below) and add a route-less
   `<domain>` for tests, or simply use `no-reply@` on a verified domain.
2. Deploy the functions with your static site (the `api/` folder is auto-detected):
   ```
   npx vercel --prod
   ```
3. Set these **project environment variables** in Vercel (Project → Settings → Environment Variables):
   ```
   RESEND_API_KEY                  = <Resend API key>
   BCAPRIME_FROM_EMAIL             = no-reply@bcaprime.com
   BCAPRIME_FROM_NAME              = BCAPrime Team
   BCAPRIME_APP_URL                = https://bcaprime.vercel.app
   FIREBASE_SERVICE_ACCOUNT_JSON   = <full contents of your Firebase service-account key JSON>
   SUPABASE_URL                    = https://kjesjaakjddfxykisssh.supabase.co
   SUPABASE_SERVICE_ROLE_KEY       = <Supabase service role key (server only — never in browser)>
   OTP_PEPPER                      = <any long random string used to HMAC the OTP>
   ```
4. Create the OTP table in Supabase (SQL Editor → run the `email_otps` section of
   `supabase-schema.sql`).

### Email deliverability — fixing the Spam folder (IMPORTANT)

Code alone can't keep mail out of Spam. For Gmail/Outlook to trust BCAPrime you must verify the
sending domain in **Resend → Domains** and add the DNS records it gives you. Typical additions
(example for `bcaprime.com`, adapt to your domain):

| Type | Name | Value (example) |
|------|------|-----------------|
| TXT  | `bcaprime.com` | `v=spf1 include:amazonses.com include:_spf.google.com ~all` (SPF — allow Resend + Firebase) |
| TXT  | `resend._domainkey` | DKIM: `k=rsa; p=<Resend public key>` |
| TXT  | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:report@bcaprime.com` |

After the records propagate, verify the domain in Resend. Also consider:
- Keep a **consistently branded From name/domain** (don't switch random senders).
- Add a `mailto:` reply-to and a real contact address in the footer (already in the template).
- Warm up the domain with a small send volume first if it's brand new.

Once the domain is verified, the green "verified sender" state is what pulls emails out of Spam.
- **Targeted auto-notify**: approving a resource sends the notification **sirf us college + semester ke subscribed users ko** — e.g. Avviare sem 1 ka upload sirf Avviare sem 1 wale students ko jaata hai. (`push_subscriptions` mein user ki enrolled `college` + `semester` subscribe time par save hoti hai; `send-push` Edge Function usi se filter karta hai.)
- **Bulk approve**: jitne resources approve kiye, agar sab same college + semester ke hain tabhi usi ko target karta hai; otherwise sabko.
- **Automatic**: approving one or many resources in the review table sends "New notes/PYQ available 📚" automatically (toggle in the same panel).

### Platform notes

- **Android/Chrome/desktop**: works fully, including app-closed delivery.
- **iOS Safari**: requires the site to be installed to the Home Screen first (**Share → Add to Home Screen**), then enable from the bell inside the installed PWA.
- Notification sound/vibration style is controlled by each OS; the custom chime plays only while the app is open.

## Account-bound college & semester + WhatsApp-style device linking

Ek account (email/Google/Apple) ab **poore devices par ek hi college + semester** rakhta hai — server-side `user_profiles` table (Firebase uid key). 

- **Conflict prevention**: laptop par DU set karke phone par Glocal wala galat scenario ab possible nahi. Jab bhi login hota hai, device ki local prefs server profile se **overwrite** ho jaati hain (server = source of truth). College/semester change karne par (`chooseSemester`, `selectCollege`, onboarding) wahi value account par save hoti hai, taaki har device sync ho.
- **New-device approval (WhatsApp-style)**: har browser ek stable `device_id` rakhta hai. **Pehla device auto-approve** hota hai (lockout nahi). Naya device login kare to `device_sessions` mein `pending` ho jaata hai aur us par ek code wala gate modal aata hai. Kisi already-approved device par ek floating banner aata hai ("Naya device login chahta hai" + code, Approve/Deny). Approve hone par naya device unlock ho jaata hai; deny hone par sign-out.
- Push notifications ab `uid` bhi target kar sakti hain (Edge Function me `uid` filter), taaki "naye device approve karo" wali alerts sirf us account ke devices ko jayein.

**SQL add-on (already-deployed DBs ke liye)**: `supabase-schema.sql` mein naye tables (`user_profiles`, `device_sessions`) aur `push_subscriptions.uid` column hain — unhe run karo (SQL Editor), phir `supabase functions deploy send-push`.

## WhatsApp-style QR Code Login (Desktop only, >=1024px)

Desktop auth screen ka right column ab **"Scan to log in"** QR interface dikhata hai (email/social form fallback toggle ke saath). Mobile view bilkul unchanged hai.

- **Flow**: Desktop mount par unique `qrSessionId` banata hai (3 min expiry) → Supabase `qr_login_sessions` table me pending row + QR code (payload: `<origin>/index.html?qr=<id>`) render hota hai. Desktop **Supabase Realtime broadcast** (`LOGIN_SUCCESS`/`LOGIN_DENIED` channel `qr-<id>` par) + 2s polling (fallback) dono se approval sunta hai.
- **Phone side**: logged-in phone camera/app se QR scan karta hai → `index.html?qr=<id>` khulta hai → URL param clean ho jata hai → agar phone logged-in hai to **Approve/Deny modal** aata hai; guest ho to pehle login karne ka message. Approve karne par row `approved` ho jati hai (uid/email/display_name ke saath) aur desktop ko broadcast milta hai.
- **Handshake completion**: Desktop row verify karta hai (status approved + not expired + not consumed), row consume karta hai (single-use), `device_sessions` me is device ko approve karta hai, aur app-level session set karke dashboard khul jata hai. Reload par session restore hota hai (`sessionStorage`); logout sab clear.
- **Note (architecture)**: project me custom `/api/auth/qr-login` server nahi hai, isliye "mobile sends request → server verifies → broadcasts LOGIN_SUCCESS" wala handshake Supabase se implement hua hai — phone ka DB update = verified request, realtime broadcast = signaling, row-consume = single-use guarantee. Firebase custom-token minting ke bina desktop session app-level synthetic session hai (wahi trust model jo device-linking use karta hai).
- QR rendering: `qrcodejs` CDN lib (vanilla equivalent of qrcode.react), lazy-loaded, graceful fallback (link text) agar CDN fail ho.

**Naya SQL zaroori hai**: `qr_login_sessions` table + policies (`supabase-schema.sql` ka QR section) run kiye bina desktop par console me 404s aayenge aur QR login kaam nahi karega.

