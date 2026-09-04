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
5. In **Authentication > Settings > Authorized domains**, add the domain your app runs on (e.g. `bcaprime.vercel.app` or `localhost`).
6. Reload `index.html` — login/signup now uses Firebase. While the placeholders are unfilled, the app shows “Firebase is not configured.”

Note: The admin page (`admin.html`) keeps using Supabase auth with an admin role — it is separate from the student account.

## Supabase setup

1. Open the Supabase project linked in `supabase-config.js`.
2. Open **SQL Editor** and run the complete contents of `supabase-schema.sql`.
3. Add approved rows to `public.resources` with a `file_url` pointing to your PDF storage.
4. Open `index.html` to verify approved rows appear in the student library.
5. In Supabase Authentication, create or confirm the admin user, then set its `app_metadata` to include `{ "role": "admin" }`.
6. Open `admin.html`, sign in with that admin account, and verify pending uploads can be reviewed.

The admin page includes Supabase email/password login and signup. Signup creates an account, but only accounts with `app_metadata.role` set to `admin` can access the review dashboard or approve resources.

### Recommended architecture
- Use Firebase for: student login/signup (guest + email/password + Google/Apple).
- Use Supabase for: resource metadata, row approval status, admin dashboard, and user roles.
- Use Supabase Storage for: student notes and PYQ PDFs. This is the simplest production setup for this app.
- If you want a dedicated CDN or faster file delivery, Cloudinary or another file-hosting service can be used for the actual PDFs, while Supabase still stores the metadata.
- Blaze is optional but not required for this project; Supabase already covers the admin and database needs well.

The publishable key is safe for browser use. Never place a `service_role` key in either HTML file.
