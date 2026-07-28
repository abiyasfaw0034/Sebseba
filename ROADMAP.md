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
- Four working member tabs: Match (discovery), Talks (chat), Dates (reveal + date prep), Me (account + lens)
- Real member-to-member candidates (accounts match each other; seed samples used only when no real members exist)
- Operations dashboard prototype
- File-backed backend persistence for onboarding, prompt answers, reveal progress, hosted-date choices, and chat messages
- Dashboard safety board intake for held chat messages

## Next product steps

1. ~~Add authentication and private member accounts.~~ Done — email/password accounts
   with hashed passwords and signed session tokens; member-state is now private per account.
2. Replace local sample matches with database-backed ranked candidates. (Partly done:
   real accounts now match each other via `GET /api/candidates` off the file store;
   swap the file store for a database and add geo/availability filtering.)
3. Upgrade prototype chat to real-time delivery with member-to-member replies. (Chat is
   two-way in the prototype via a simulated match reply; real cross-member delivery pending.)
4. Add real voice recording, playback, and consent controls.
5. Add image upload and verification. (Mutual photo-reveal consent gating is done;
   real image upload/verification still pending.)
6. Add hosted venue/event inventory and booking.
7. Connect the dashboard to reports, matches, events, and moderation queues.
8. Add push notifications for prompts, reveals, and date plans.
9. Prepare deployment for dashboard, API, and mobile builds.
