# sfis — Stone Field International School

An independent website project based on the approved green-and-gold design. The original Stone Field project is a read-only reference. Selected school media were copied into this project; there are no dependencies on files in the old project.

## Preview and update

Requires Node.js 22+ and dependencies installed with `npm install`.

- `npm run build` refreshes the website from the editable content and templates.
- `npm start` serves it at http://127.0.0.1:8766.
- `npm run check` checks JavaScript syntax.

## Editing guide

- `content/site.json`: school copy, contact number, admissions note, seven activities, FAQs and founder articles. Article body fields contain the original article HTML.
- `src/index.html`, `src/home.html`, `src/footer.html`: page structure.
- `src/styles.css`: colours, spacing, desktop and phone layouts.
- `src/app.js`: mobile navigation and video player behaviour.
- `dist/assets/`: independent copies of school photos and the campus video.
- `dist/`: complete website, ready for static hosting. Run the build after source/content edits.

The homepage, founder blog index, and both founder article pages are implemented. Navigation points to homepage sections. Enquiry buttons open WhatsApp with a draft; visitors send it themselves. Call and directions links use the reference project's public contact details. The registration form saves enquiries through the server API to the dedicated SFIS database.

Campus imagery is labelled as illustrative and admissions are described as planned for December 2026, following the reference FAQ. Review these details when the school timeline changes.

## Parent interest registration — dedicated SFIS database

The homepage banner opens `register.html`. The server endpoint `api/interest.js` validates and saves submissions to `sfis.parent_interests`. There is no public endpoint that lists parents or children.

Create a NEW Neon PostgreSQL database/project for SFIS. Do not use the Genesis connection. Put its connection string in `.env.local` as `DATABASE_URL`; this file is ignored by Git. Then run `npm run db:setup` once and restart `npm start`. Until configured, submissions return an unavailable error and never pretend to be saved. The local preview is now connected to the user-provided SFIS Neon database; its schema has been initialized.

For Vercel, use the same dedicated SFIS `DATABASE_URL` in project environment variables. The committed `vercel.json` sets the build/output paths; the `api` folder provides the server function. Never place credentials in `dist`, client JavaScript or GitHub. Run the schema setup against SFIS before accepting real enquiries. Nothing has been deployed.

The form stores the eight displayed parent/child fields, explicit admissions-contact consent, consent version, creation time, and status. Submission IDs prevent double inserts on retries. A per-mobile hourly submission cap and a hidden spam trap provide basic abuse protection. Run `node --test tests/interest.test.mjs` for server validation tests. A live API submission and database read-back passed on 2026-09-27, including duplicate-retry protection. The synthetic test record was removed afterward. Local start/setup commands prefer IPv4 and disable network family auto-selection to avoid connection timeouts on this Mac.
