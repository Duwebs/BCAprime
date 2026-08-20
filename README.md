# BCAprime
BCAprime Web App Study Platform.

## Supabase setup

1. Open the Supabase project linked in `supabase-config.js`.
2. Open **SQL Editor** and run the complete contents of `supabase-schema.sql`.
3. Add approved rows to `public.resources` with a `file_url` pointing to your PDF storage.
4. Open `index.html` to verify approved rows appear in the student library.
5. Open `admin.html` to verify resource records appear in the admin table.

### Recommended architecture
- Use Supabase for: admin dashboard, metadata, status, row approval, auth, and user roles.
- Use Supabase Storage for: student notes and PYQ PDFs. This is the simplest production setup for this app.
- If you want a dedicated CDN or faster file delivery, Cloudinary or another file-hosting service can be used for the actual PDFs, while Supabase still stores the metadata.
- Blaze is optional but not required for this project; Supabase already covers the admin and database needs well.

The publishable key is safe for browser use. Never place a `service_role` key in either HTML file. The current admin page keeps local demo uploads working, while cloud admin writes should be enabled only after Supabase Auth and an admin role are configured.
