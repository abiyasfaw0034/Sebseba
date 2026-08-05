# Abiyasfaw Roadmap

## Built in the prototype

- Member onboarding for intention, city, language, faith comfort, family expectations, reveal pace, date style, and dealbreakers
- Local blind-match scoring from onboarding choices
- Ranked blind match browser with fit reasons
- Prompt-first matching before photos
- Voice prompt draft flow
- Photo reveal request rules
- Hosted first-date acceptance
- Safety pause and dealbreaker visibility
- Reveal-safe chat composer with contact/photo-pressure moderation holds
- Real member-to-member chat delivery with a shared conversation store, match inbox,
  unread badges (per match + Talks tab), read receipts, and host-held (withheld) messages
- Four working member tabs: Match (discovery), Talks (chat), Dates (reveal + date prep), Me (account + lens)
- Real member-to-member candidates (accounts match each other; seed samples used only when no real members exist)
- Operations dashboard prototype
- File-backed backend persistence for onboarding, prompt answers, reveal progress, hosted-date choices, and chat messages
- Dashboard safety board intake for held chat messages
- Operations console driven by real store data: metrics (onboarded, prompt answers,
  reveal requests, safety holds), a live compatibility queue of real members, reveal-workflow
  stats, and a safety board combining held chat + reveal-before-prompt flags (seed samples
  only when the store is empty)
- Hardened auth: server-side revocable sessions (each token carries a session id checked on
  every request), real sign-out and "sign out of all devices", per-device session listing,
  login rate-limiting (per email+IP and per IP), and a single-use password-reset flow that
  revokes all sessions on success
- Real hosted-event inventory and booking: a shared event store with seat capacity, members
  book/cancel a seat from the mobile Dates tab, and the ops console shows live seat fill from
  actual bookings (no more hardcoded rooms)
- Dashboard reports: booking totals, capacity fill, unique members booked, and a city
  breakdown, plus CSV export of members and events (export gated by an optional ops token)

## Next product steps

1. ~~Add authentication and private member accounts.~~ Done — email/password accounts
   with hashed passwords and signed session tokens; member-state is now private per account.
   Hardened since: revocable server-side sessions, sign-out / sign-out-everywhere, per-device
   session list, login rate-limiting, and single-use password reset. Remaining: deliver reset
   tokens by email (prototype returns them in dev only) and move the rate limiter to a shared
   store once the API runs on more than one process.
2. Replace local sample matches with database-backed ranked candidates. (Partly done:
   real accounts now match each other via `GET /api/candidates` off the file store;
   swap the file store for a database and add geo/availability filtering.)
3. ~~Upgrade prototype chat to real-time delivery with member-to-member replies.~~ Done —
   messages are delivered member-to-member through a shared conversation store
   (`GET/POST /api/messages`, `GET/POST /api/inbox`), with an inbox, unread counts, read
   receipts, and moderation holds. Delivery is short-interval polling; swap to
   websockets/push for true real-time.
4. Add real voice recording, playback, and consent controls.
5. Add image upload and verification. (Mutual photo-reveal consent gating is done;
   real image upload/verification still pending.)
6. ~~Add hosted venue/event inventory and booking.~~ Done — `src/lib/events.ts` backs a real
   event store (`.data/events.json`, seeded on first read); members book/cancel seats from the
   mobile Dates tab via `GET/POST /api/events`, with capacity enforced. Remaining: an admin UI
   to create/edit events (currently seeded/edited via the store file).
7. Connect the dashboard to reports, matches, events, and moderation queues. (Mostly done:
   the console reads real members, metrics, reveal workflow, and moderation/safety holds via
   `src/lib/dashboard.ts`; the hosted-dates panel now shows live seat fill from real bookings,
   and a reports section adds booking totals + a city breakdown with CSV export of members and
   events via `GET /api/reports/export`. Remaining: match-outcome reporting.)
8. Add push notifications for prompts, reveals, and date plans.
9. Prepare deployment for dashboard, API, and mobile builds.
