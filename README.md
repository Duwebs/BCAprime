# BCAprime
BCAprime Web App Study Platform.

## PWA install

The student library is installable as a PWA. Serve the project over HTTPS in production, or use `http://localhost` during development; service workers do not run from `file://` pages. On a supported browser, use the **Install app** button when it appears, or the browser's install option in the address bar/menu.

## Supabase setup

1. Open the Supabase project linked in `supabase-config.js`.
2. Open **SQL Editor** and run the complete contents of `supabase-schema.sql`.
3. Add approved rows to `public.resources` with a `file_url` pointing to your PDF storage.
4. Open `index.html` to verify approved rows appear in the student library.
5. In Supabase Authentication, create or confirm the admin user, then set its `app_metadata` to include `{ "role": "admin" }`.
6. Open `admin.html`, sign in with that admin account, and verify pending uploads can be reviewed.

The admin page includes Supabase email/password login and signup. Signup creates an account, but only accounts with `app_metadata.role` set to `admin` can access the review dashboard or approve resources.

Both the student Profile and admin login also support Google and Apple sign-in. Enable Google and Apple under Supabase **Authentication > Providers**, and add these redirect URLs: `https://bcaprime.vercel.app/` and `https://bcaprime.vercel.app/admin.html`.

### Recommended architecture
- Use Supabase for: admin dashboard, metadata, status, row approval, auth, and user roles.
- Use Supabase Storage for: student notes and PYQ PDFs. This is the simplest production setup for this app.
- If you want a dedicated CDN or faster file delivery, Cloudinary or another file-hosting service can be used for the actual PDFs, while Supabase still stores the metadata.
- Blaze is optional but not required for this project; Supabase already covers the admin and database needs well.

The publishable key is safe for browser use. Never place a `service_role` key in either HTML file. The current admin page keeps local demo uploads working, while cloud admin writes should be enabled only after Supabase Auth and an admin role are configured.
