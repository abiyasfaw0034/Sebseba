# Abiyasfaw Mobile

Expo React Native prototype for the member-facing blind match experience.

## What is included

- First-run onboarding for intention, city, language, faith comfort, family expectations, reveal pace, date style, and dealbreakers
- Local blind-match ranking based on onboarding choices
- Blind profile preview
- Match browser with fit score and match reasons
- Match-lens summary based on onboarding choices
- Cultural cue selection
- Prompt answer progress
- Voice prompt draft flow
- Voice reveal readiness
- Photo reveal rules gated by prompts, voice intro, and hosted date acceptance
- Hosted first-date choices
- Mutual photo-reveal consent flow (request, mutual approval, re-blind)
- Safety pause control
- Real member-to-member chat with a match inbox: unread badges (Talks tab + per match),
  read receipts, and moderation holds (flagged messages are withheld and sent to host review)
- Email/password sign-in and registration with a private per-account session
- Backend-backed profile and prompt answer persistence when the dashboard API is running

## Run

```bash
npm run start
npm run web
npm run android
npm run ios
```

From the repository root:

```bash
npm run mobile:start
npm run mobile:web
```

## Accounts

The app now requires a member account. On first launch you register or sign in
with an email and password; the session token is stored in `expo-secure-store`
(the device keychain, or `localStorage` on web) and restored on the next launch.
Member state is private to the signed-in account. Start the dashboard API with
`npm run dev` from the repository root so registration and sign-in work.

## Persistence

The app saves member state to the dashboard API at `http://localhost:3000/api/member-state` by default. Every request is authenticated with the session token, and the member is derived from that token (no member id is sent in the URL).

For device testing, set `EXPO_PUBLIC_ABIYASFAW_API_URL` to a reachable dashboard URL, for example `http://192.168.1.25:3000`. To test multiple members, register more than one account and sign in as each.

## Chat

Chat is real member-to-member delivery, not a simulation. Messages go through the
dashboard's shared conversation store (`/api/messages`, `/api/inbox`), so a message from one
account is delivered to the other. Open **Talks** with a real match selected to see the
thread; unread counts appear on the Talks tab and each match row, and your sent messages
show a Delivered/Read receipt. A message that trips a moderation rule (contact details,
off-app or photo pressure) is held for host review and is not delivered to the match. Live
chat is available only against real matched members — seed sample matches show a disabled
composer. Delivery is short-interval polling today; websockets/push is a later step.
