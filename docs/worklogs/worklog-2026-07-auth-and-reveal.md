# Work log — Auth + Mutual Photo Reveal (2026-07-28 → 07-29)

This session finished the two in-flight roadmap items — **mutual photo reveal with
consent** (was half-built) and **authentication + private member accounts** (new) —
and fixed the real bugs found along the way. Nothing here is committed; it's left
staged for you to commit.

---

## 1. Mutual photo reveal with consent — *finished*

### What it was
The previous commit (`feat: add photo reveal consent management to member state`)
added all the state, handlers, and save-plumbing but **never rendered any of it**,
and the backend **silently dropped** the two new fields, so consent never survived
a reload. In other words: it looked done in git, but did nothing.

### What was done
**Mobile — `apps/mobile/App.tsx`**
- Rebuilt the *Photo reveal rules* card into a real two-sided flow:
  `Request photo reveal` → status rows ("You requested" ✓ / "Waiting for {match} to
  agree") → `Confirm {match} agrees` → **Photos are open** + `Re-blind this match`.
- Wired the previously-dead code: `requestPhotoReveal`, `grantMatchRevealConsent`,
  `resetPhotoRevealConsent`, the `revealGateReady` gate, and `photoRevealOpened`.
- The hero image now actually reveals (shade lightens, pill → "Photo revealed")
  only once **both** sides have consented.

**Backend — `apps/dashboard/src/app/api/member-state/route.ts`**
- Added `matchRevealConsentGranted` and `photoRevealOpened` to the `MemberState`
  type, `createDefaultState`, and `normalizeState` so they persist.
- Added **coherence enforcement** on normalize: consent requires a request, and
  "opened" requires consent — an impossible/corrupt combination can't be stored.

### Bugs fixed along the way
- **Consent never persisted** — `normalizeState` rebuilds a whitelisted object and
  dropped any unknown field, so the mobile app's consent fields vanished on save.
- **Reveal reset was incomplete** — pausing reveal, changing the date spot, and
  accepting a date each cleared only `photoRevealRequested`, leaving
  `photoRevealOpened` true. Once the hero honored that flag, photos would have
  stayed "open" while paused. All three now route through `resetPhotoRevealConsent()`.

---

## 2. Authentication + private member accounts — *new*

Chosen approach (your decisions): **built-in backend auth** (no external provider)
and **`expo-secure-store`** for the mobile session.

### Backend
New files:
- `apps/dashboard/src/lib/auth.ts` — account store + crypto. Passwords hashed with
  **scrypt** (per-account random salt); session tokens are **HMAC-SHA256** signed,
  JWT-shaped (`base64url(payload).base64url(sig)`), 30-day expiry. All Node `crypto`,
  **no new dependencies**.
- `apps/dashboard/src/lib/http.ts` — shared CORS helper that allows the
  `Authorization` header (needed for the mobile client).
- `apps/dashboard/src/app/api/auth/register/route.ts`
- `apps/dashboard/src/app/api/auth/login/route.ts`
- `apps/dashboard/src/app/api/auth/session/route.ts`

Accounts persist to `apps/dashboard/.data/accounts.json` (git-ignored, same store
directory as member state).

**API contract**

| Route | Method | Body / Header | Success | Errors |
|---|---|---|---|---|
| `/api/auth/register` | POST | `{ email, password }` | `201 { token, memberId, email }` | `400` bad email / weak pw, `409` exists |
| `/api/auth/login` | POST | `{ email, password }` | `200 { token, memberId, email }` | `401` invalid (generic, no user enumeration) |
| `/api/auth/session` | GET | `Authorization: Bearer <token>` | `200 { memberId, email }` | `401` invalid/expired |
| `/api/member-state` | GET/PUT | `Authorization: Bearer <token>` | `200 <state>` | `401` missing/invalid token |

**Privacy change (the important part):** `member-state` no longer trusts a
`memberId` query/body value. It derives the member from the verified token, so a
spoofed `"memberId"` in the request body is **ignored**. `demo-member` is gone.

Config: set `ABIYASFAW_AUTH_SECRET` in the dashboard environment for a real signing
secret. A dev fallback secret is used when it's unset (fine for local, not prod).

### Mobile — `apps/mobile/App.tsx`
- Added `expo-secure-store` (`npx expo install`, SDK-57 compatible; config plugin
  added to `app.json`).
- Sign-in / register screen (email + password, mode toggle, inline validation and
  server errors).
- Session lifecycle: token stored in the keychain (localStorage on web via a
  `Platform`-aware helper), restored on launch via `/api/auth/session`, and a
  sign-out button in the header. A `401` from load or save auto-signs-out.
- All member-state fetch/save now send `Authorization: Bearer`. Save/load are
  gated on `authToken` + `memberStateLoaded`, so one account's state can't leak
  into another's on account switch.

### Doc bug fixed
`apps/mobile/README.md` still referenced the removed `EXPO_PUBLIC_ABIYASFAW_MEMBER_ID`
env var — updated to the account flow.

---

## Verification (all green)

| Check | Result |
|---|---|
| `apps/mobile` `tsc --noEmit` + IDE diagnostics | clean |
| `apps/dashboard` `tsc` + `eslint` + `next build` | clean; all 4 API routes registered |
| Expo web bundle (`expo export --platform web`) | built successfully (SecureStore resolves) |
| Live API smoke test (dev server + curl) | register `201` · duplicate `409` · weak pw `400` · wrong login `401` · session `200` · member-state no-token `401` · **spoofed `memberId` ignored** · consent persists · garbage token `401` |

---

## Files changed

**Modified**
- `apps/mobile/App.tsx`
- `apps/mobile/package.json`, `apps/mobile/package-lock.json`, `apps/mobile/app.json`
- `apps/dashboard/src/app/api/member-state/route.ts`
- `README.md`, `ROADMAP.md`, `apps/mobile/README.md`

**New**
- `apps/dashboard/src/lib/auth.ts`
- `apps/dashboard/src/lib/http.ts`
- `apps/dashboard/src/app/api/auth/register/route.ts`
- `apps/dashboard/src/app/api/auth/login/route.ts`
- `apps/dashboard/src/app/api/auth/session/route.ts`
- `docs/worklogs/worklog-2026-07-auth-and-reveal.md` (this file)

Suggested commits (if splitting): (1) finish mutual photo reveal + backend
persistence/coherence, (2) built-in auth + private accounts.

---

## Open tasks / follow-ups (from a scan of the codebase)

Ordered roughly by impact. None of these were introduced by this session unless noted.

### Product roadmap (not started)
- **#3 Unread chat / match inbox** — next roadmap item. The chat is currently a
  single conversation per selected match; there's no inbox, unread counts, or
  match-to-match threading.
- **#4 Push notifications** for prompt / chat / reveal events.
- **Database-backed candidates** — both apps still use hardcoded sample matches
  (`candidateMatches` in the mobile app; `queue` in the dashboard). Real accounts
  don't yet appear as matches for each other.

### Real bugs / gaps found while working
- **Dead bottom tabs (mobile).** The tab bar shows four tabs (Match, Talks, Dates,
  Me) but `selectableTab` maps everything except *Talks* to *Match*
  (`App.tsx`, tab bar near the end). Tapping **Dates** or **Me** does nothing — the
  Dates content lives inside the Match scroll and there is no Me screen. Either wire
  these tabs or drop them.
- **One-sided chat.** Only `member` messages are ever created; `match`/`host`
  replies never arrive, so conversations can't actually happen. Tied to #3.
- **`SafeAreaView` deprecation (pre-existing, app-wide).** `react-native` deprecated
  it in favor of `react-native-safe-area-context`. ~5 usages in `App.tsx`. Left
  untouched to avoid scope creep.

### Auth hardening (prototype-acceptable, note for production)
- No rate limiting / lockout on login attempts.
- No password reset / email verification (register + login only).
- Tokens are not revocable server-side before expiry (no session store); sign-out
  only clears the client. Fine for a prototype; revisit if this ships.
- Set `ABIYASFAW_AUTH_SECRET` before any non-local deployment.

---

# Follow-up (2026-07-29) — fixed the four pre-existing gaps

Done before continuing the roadmap, at the user's request.

### 1. Dead bottom tabs → all four wired
The tab bar routed everything except *Talks* back to *Match*. Now each tab is
selectable and renders distinct content (no card is duplicated across tabs):
- **Match** — ranked matches, blind hero, why-this-match, match lens.
- **Talks** — reveal-safe chat.
- **Dates** — reveal progress, photo-reveal rules, prompt exchange, voice prompt,
  first-date plan, safety controls.
- **Me** — *new* account card (email, member id, match source, sync, **Sign out**) +
  match-lens recap + dealbreakers + Edit onboarding.

### 2. One-sided chat → two-way (prototype)
Sending a non-held message now schedules a reveal-safe, on-topic reply from the
match (`buildMatchReply`, author `match`) after ~1.2s, so a conversation actually
happens. Held (moderated) messages get no reply. Timers are cleared on unmount.
Real cross-member delivery is still roadmap #3 — this is a prototype stand-in.

### 3. Hardcoded matches → real accounts match each other
- New `GET /api/candidates` (auth required) — returns other members who completed
  onboarding (excluding self), each as `{ id, profile, answeredPromptCount }`,
  read from the member-state file store.
- Mobile fetches candidates on sign-in and synthesizes a blind-match card from each
  real profile (`buildCandidateFromSummary` — derives handle/cues/intro/host note).
  The ranked list uses real members when any exist and falls back to the seed
  samples otherwise. The Match/Me headers show which source is in use.
- **Verified live** with two accounts: Alice and Bob each see the other (never
  themselves), with correct answered-prompt counts; `401` without a token.

### 4. `SafeAreaView` deprecation → migrated
Switched to `react-native-safe-area-context`: `App` now wraps `AppContent` in a
`SafeAreaProvider`, and every `SafeAreaView` comes from that package. The
deprecation warnings are gone.

### Files (follow-up)
- Modified: `apps/mobile/App.tsx`, `apps/mobile/package.json` + lock (added
  `react-native-safe-area-context`), `README.md`, `ROADMAP.md`, `apps/mobile/README.md`.
- New: `apps/dashboard/src/app/api/candidates/route.ts`.

### Verification (follow-up)
- Mobile `tsc --noEmit` + IDE diagnostics: clean (no more SafeAreaView warnings).
- Dashboard `tsc` + `eslint` + `next build`: clean; `/api/candidates` registered.
- Expo web bundle: builds.
- Live: two-account candidate matching, self-exclusion, and `401`-without-token.

### Note
Local `.data/` now contains a few test accounts/members from live testing (git-ignored,
not committed). They'll show up as candidates when you run the app locally. Delete
`apps/dashboard/.data/accounts.json` and `member-state.json` for a clean slate.

### Still open after this
- Real (not simulated) member-to-member chat delivery — roadmap #3.
- Move the file store to a real database; add geo/availability to candidate ranking.
- Auth hardening items listed above.

---

# Roadmap #3 (2026-07-31) — real member-to-member chat + unread inbox

Chat used to live inside each member's *private* member-state, so a message could never
reach the other person (the two-way feel was a local simulated reply). This replaces that
with a real shared conversation store and a match inbox.

### Backend
New shared store — the single source of truth for chat, so a message sent by one member
is actually delivered to the other:
- `apps/dashboard/src/lib/conversations.ts` — `.data/conversations.json` keyed by a stable
  participant-pair id. `sendMessage`, `getThread`, `markThreadRead`, `getInbox`, and
  `getHeldReviews`. Moderation-flagged messages are stored **held** and *withheld from the
  recipient* (the sender still sees their own; a host reviews them) — they never increment
  the peer's unread count.
- `apps/dashboard/src/lib/moderation.ts` — the chat moderation rules, extracted so the
  messages route and the member-state history share one authority (mobile keeps a
  compose-time copy purely as a hint).

New routes (auth required, identity from the bearer token):
| Route | Method | Purpose |
|---|---|---|
| `/api/messages` | `GET ?peerId=` | Thread with a peer, from my perspective (`author: 'me' \| 'them'`, `readAt`) |
| `/api/messages` | `POST` | Send `{ toMemberId, text }` → moderated, delivered or held |
| `/api/inbox` | `GET` | Conversation summaries + `unreadTotal` |
| `/api/inbox` | `POST` | `{ peerId }` → mark that thread read |

`chatMessages` was removed from member-state (type + default + normalize); the mobile app
no longer stores or sends it. The dashboard safety board (`page.tsx`) now reads held chat
from the conversation store via `getHeldReviews()` instead of scanning member-state.

### Mobile — `apps/mobile/App.tsx`
- Removed the simulated match reply (`buildMatchReply` + timers) entirely.
- Chat now sends to `POST /api/messages` and renders a live thread fetched from
  `GET /api/messages?peerId=<match id>` (a remote candidate's id **is** the peer's real
  memberId). The thread polls every ~4s while the Talks tab is open and marks the thread
  read on open; the inbox polls every ~6s while signed in.
- Unread badges: a red count on the **Talks** tab (total unread) and on each match row in
  the ranked list; read receipts ("Delivered" / "Read") on your own messages.
- Chat is honestly gated: against seed sample matches (no real backend member) the composer
  is disabled with "Live chat opens once you match with a real member."
- `401` on any chat call signs the member out, consistent with the rest of the app.

### Verification (all green)
| Check | Result |
|---|---|
| `apps/dashboard` `tsc` + `eslint` + `next build` | clean; `/api/messages` + `/api/inbox` registered |
| `apps/mobile` `tsc --noEmit` | clean |
| Expo web export | builds (948 KB) |
| Live two-account run (Alice ↔ Bob) | send → peer inbox unread `1` → thread shows `them` → mark-read clears to `0` → sender sees `readAt` (read receipt); Bob's reply reaches Alice (two-way); phone-number message **held**, withheld from Bob, unread stays `0`, and the dashboard `/` HTML renders it on the safety board; guards `401` (no token) / `400` (self-send, empty) |

### Still open after this
- Delivery is polling; swap to websockets or push for true real-time (ties into #4).
- Move the file store to a real database; add geo/availability to candidate ranking.
- Auth hardening items listed above.

---

# Real dashboard data (2026-08-01)

Push notifications (roadmap #4) need a physical device + EAS push token, which isn't
available in this environment, so we took the highest-value device-independent task
instead: make the ops console reflect **real** store data rather than hardcoded samples.
(Before this, only the safety board's held-chat rows were real; metrics, the member queue,
and the reveal workflow were all mock.)

### New — `apps/dashboard/src/lib/dashboard.ts`
Server-side aggregation (`getDashboardData()`) that reads the three `.data` stores and
derives everything the console shows:
- **Metrics** — Members onboarded (of registered), Prompt answers logged (+ avg/member),
  Reveal requests (+ mutually opened), Safety holds (held chat + reveal-before-prompt), with
  the Safety card tinted `watch` when non-zero.
- **Compatibility queue** — one row per onboarded member: name from the account email, short
  code, city, a cue synthesized from the profile, a readiness score (onboarding + prompts +
  voice + date + reveal), a derived status (`Onboarding` → `Needs prompt` → `Ready for host`
  → `Voice reveal ready` → `Date accepted` → `Reveal requested` → `Photos open`), prompt
  stage (`n/3`, "· reveal paused" when paused), languages, and profile tags. Sorted by
  readiness then recency, top 6.
- **Reveal workflow** — members who completed all prompts, members with a saved voice intro,
  and the most-requested hosted table.
- **Safety board** — held chat messages plus members who requested a reveal before finishing
  the prompt exchange.
Everything falls back to representative sample data when the store is empty, so a fresh
install still looks alive (`usingRealQueue` / `usingRealSafety` flags gate the copy).

Added `listAccountSummaries()` to `src/lib/auth.ts` (id/email/createdAt only — no salt/hash)
so the dashboard can map member ids to human names.

### `apps/dashboard/src/app/page.tsx`
Removed the hardcoded `metrics` / `queue` / `workflow` / `safetyReviews` and the local
held-chat reader; the page now awaits `getDashboardData()`. The prompt library and hosted-
date rooms remain curated content (no member data behind them yet). Reveal-workflow icons
stay in the page and are matched to the data by index.

### Verification (all green)
| Check | Result |
|---|---|
| `apps/dashboard` `tsc` + `eslint` + `next build` | clean |
| Live two-account seed (Selam + Nahom) → rendered `/` HTML | metrics compute from the store (onboarded/of-registered, prompt answers + avg, reveal requests + mutually opened, safety holds → `watch`); both members appear in the queue with real cities/status; the reveal-before-prompt flag and a held chat both render on the safety board; heading switches to "N blind profiles ready for review" |

### Still open after this
- Push notifications (#4) — needs a device + EAS push token (parked).
- Reports + real hosted-event inventory for the dashboard; move the file store to a database.
- Auth hardening items listed above.
