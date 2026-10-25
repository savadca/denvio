# Denvio

Notes, mock tests and community discussion for BDS students. React (Vite) frontend, Express + SQLite backend.

## Run

```bash
npm install
npm run dev        # API on :4000, React on http://localhost:5173
```

Production:

```bash
npm run build && npm start   # everything on http://localhost:4000
```

A first admin account is created on first start: **admin / admin123** (set `ADMIN_PASSWORD` before first start to choose another; change it in Settings).
Optional live job listings: get a free key at https://developer.adzuna.com and start with
`ADZUNA_APP_ID=… ADZUNA_APP_KEY=… npm start` (`ADZUNA_COUNTRY` defaults to `in`). LinkedIn has no public jobs API, so the app links to LinkedIn searches instead of copying its listings.

Node 22.5+ is required (uses the built-in `node:sqlite`). Data lives in `data/denvio.db`; uploaded files in `uploads/`.

## Features

- **Accounts** – username/password login, `user` and `admin` roles, profile page with avatar, bio, college, year.
- **Notes** – upload PDF/image/Word/PowerPoint/text (25 MB) with optional video and audio links. Uploads go to an admin review queue and only appear in the feed once approved. Like, save, download.
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
