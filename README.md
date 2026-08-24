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

- **Manual broadcast**: open `admin.html` → *Send notification* panel → title + message → **Send to all users**.
- **Automatic**: approving one or many resources in the review table sends "New notes/PYQ available 📚" automatically (toggle in the same panel).

### Platform notes

- **Android/Chrome/desktop**: works fully, including app-closed delivery.
- **iOS Safari**: requires the site to be installed to the Home Screen first (**Share → Add to Home Screen**), then enable from the bell inside the installed PWA.
- Notification sound/vibration style is controlled by each OS; the custom chime plays only while the app is open.

