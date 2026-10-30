# Denvio

Notes, mock tests and community discussion for BDS students. React (Vite) frontend, Express + SQLite backend.

## Deploy on Vercel

1. In the Vercel project → **Storage**: create a **Neon (Postgres)** database and a **Blob** store, and connect both to the project. This adds `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` automatically.
2. **Settings → Environment Variables**: add `SESSION_SECRET` (long random string, e.g. `openssl rand -hex 32`) and `ADMIN_PASSWORD` (password for the first `admin` account). Optional: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ADZUNA_COUNTRY` for live jobs.
3. Push to GitHub. `vercel.json` builds the React app into `client/dist` and serves the Express API (`api/index.js`) as a function at `/api/*`. Tables and the admin account are created on the first request.

## Run locally

Needs Node 22 and a Postgres database. The easiest way is to reuse the Vercel ones:

```bash
npm install
npx vercel link && npx vercel env pull .env.local   # pulls DATABASE_URL, BLOB_READ_WRITE_TOKEN, ...
npm run dev        # API on :4000, React on http://localhost:5173
```

Or point `DATABASE_URL` in `.env.local` at any Postgres (e.g. `postgres://postgres:pass@localhost:5432/denvio`). File uploads need `BLOB_READ_WRITE_TOKEN`.

Optional live job listings: get a free key at https://developer.adzuna.com and set `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` (`ADZUNA_COUNTRY` defaults to `in`). LinkedIn has no public jobs API, so the app links to LinkedIn searches instead of copying its listings.

## Features

- **Accounts** – visitors can browse everything (notes, exam prep, question paper lists, mock test list, community, news, jobs, leaderboard, profiles) without an account. Signing up (username/password) is needed to upload, view or download files, like/save, take tests, post, reply and report; visitors see a "Sign up" prompt and come back to the same page after logging in. `user` and `admin` roles, profile page with avatar, bio, college, year.
- **Notes** – upload PDF/image/Word/PowerPoint/text (25 MB) with optional video and audio links. Several files can be picked at once; each becomes its own note with its own title. Uploads go to an admin review queue and only appear in the feed once approved. Like, save, download.
- **Exam Prep** – each exam has Notes, Question papers, Mock tests and Notifications tabs. Admins can add new exams (India PG entrance, abroad licensing, university or other), edit and delete them. *Question papers* are organised year → subject; university exams first pick the course year (First/Second/Third/Final year or a custom one). Subjects and course years come from a list with an "Other" option to type your own. Admins upload several files at once; everyone can view and download. Admins can also upload *predicted papers* for an upcoming exam year; these appear in a glowing area at the top of the tab, and the exam card, header and tab are highlighted while any exist.
- **Video/audio** – a "View video" / "Listen audio" button appears only if the uploader added a link *and* an admin enabled it. The player loads only when clicked (YouTube, Vimeo, Google Drive, Spotify, SoundCloud, direct .mp4/.mp3).
- **Mock tests** – admins build subject-wise MCQ tests with explanations; students take timed tests and review results.
- **Community** – discussions by subject with replies; report posts, comments or users.
- **Coins & levels** – admins award 💎 Diamond (100), 🥇 Gold (50), 🥈 Silver (25) or 🥉 Bronze (10) coins for a note, a discussion post or a user, with a reason. Points unlock levels (Fresher → Scholar 50 → Resident 150 → Specialist 400 → Professor 1000). Students get a celebration pop-up, a coin shelf on their profile, and a place on the Leaderboard (all time / this month).
- **Announcements** – admins publish colour-coded notices (Notice, Good news, Heads up, Urgent, Event) with an optional button link and end date. They appear as an animated bar on every page; students can minimise it to a floating bell, and it re-opens when something new is posted.
- **Dental News** – headlines from ScienceDaily, News-Medical and Dentistry.co.uk public RSS feeds (refreshed every 30 min), filterable by category; stories open on the publisher's site.
- **Jobs** – filter by classification (General Dentist, Internship, Orthodontist, Endodontist, Faculty, Government, …), job type and city. Shows jobs admins post (Admin → Jobs; the apply link can be a LinkedIn/Naukri URL), live openings from the Adzuna API when configured, and one-tap searches on LinkedIn, Naukri and Indeed.
- **Admin** – review uploads (preview file, preview/edit/enable video and audio links, approve or discard), manage approved notes, users (red list, block, remove, make admin), reports, and tests.
  - *Red list*: flagged user; can still read but cannot post or reply in the community.
  - *Block*: cannot log in (signed out immediately).
  - *Remove*: deletes the account and everything they uploaded.
